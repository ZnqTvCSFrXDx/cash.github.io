// ════════════════════════════════════════════════════════════════
//  Portfolio backend — small Node HTTP server (no framework)
//  Responsibilities:
//    • Serve as a CORS proxy to Groq for the "Clark" AI chat widget
//    • Hold admin-editable site state (name, status, social toggles)
//    • Broadcast live "reload" events to open tabs via SSE
//  Deployed on Render's free tier. Frontend lives on GitHub Pages.
// ════════════════════════════════════════════════════════════════

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const STATE_FILE = path.join(__dirname, 'admin_state.json');

// Frontend origin — used to lock down admin-only routes. Override
// via env if the GitHub Pages URL ever changes.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://cash-github-io.vercel.app';

// SECURITY: never hardcode a real password fallback. If ADMIN_PASS
// isn't set in the environment, generate a random one at boot and
// print it once — admin login simply won't work with a guessable
// default, instead of silently working with a known leaked one.
let ADMIN_PASS = process.env.ADMIN_PASS?.trim();
if (!ADMIN_PASS) {
  ADMIN_PASS = crypto.randomBytes(16).toString('hex');
  console.warn('⚠️  ADMIN_PASS env var not set! Generated a random one for this run:');
  console.warn(`⚠️  ${ADMIN_PASS}`);
  console.warn('⚠️  Set ADMIN_PASS in Render env vars so this is stable across restarts.');
}

// ── Sessions ──────────────────────────────────────────────────
// SECURITY: Admin login now happens server-side only. The client never holds
// the password after the initial /login call — it gets a random opaque token
// instead, valid for SESSION_TTL_MS. The token is kept only in a JS closure
// (not sessionStorage/localStorage) so it dies when the tab closes.
const sessions = new Map(); // token -> expiresAt
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Periodically sweep expired sessions so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (now > expiry) sessions.delete(token);
  }
}, 10 * 60 * 1000).unref();

// ── Rate limiting ─────────────────────────────────────────────
// Simple in-memory fixed-window limiter, keyed by IP + bucket name.
// Good enough for a single-instance Render free-tier server.
const rateBuckets = new Map(); // `${ip}:${bucket}` -> { count, resetAt }

function rateLimited(req, bucket, max, windowMs) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const key = `${ip}:${bucket}`;
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, entry);
  }
  entry.count++;
  return entry.count > max;
}

// NOTE: contact form no longer goes through this server — it posts
// directly to Formspree from the frontend (script.js), so the old
// Nodemailer/Gmail mailer + /contact route were removed as dead code.

// ── Persistent admin state ──────────────────────────────────────
// Site settings the admin panel can toggle live (name, status pill,
// which social links show, etc). Persisted to disk so it survives
// server restarts, since Render's free tier has no database.

const DEFAULT_STATE = {
  showEmail: true,
  displayName: '',
  status: 'available',
  socials: {
    github: true,
    discord: true,
    instagram: true,
    linkedin: true,
    onlinejobs: true,
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        socials: { ...DEFAULT_STATE.socials, ...(saved.socials || {}) }
      };
    }
  } catch (e) {
    console.warn('Failed to load state:', e.message);
  }
  return { ...DEFAULT_STATE, socials: { ...DEFAULT_STATE.socials } };
}

function persistState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('Failed to persist state:', e.message);
  }
}

let adminState = loadState();
console.log('State loaded:', adminState);

// ── Live-sync (SSE) ──────────────────────────────────────────────
// Open tabs subscribe to /events. When the admin saves a change,
// /reload pings every subscriber so all open tabs refresh in sync.

const sseClients = new Set();

// ── Small response helpers ──────────────────────────────────────

function setCors(res) {
  // Public GET routes (ping/events/state-read) stay open to any origin —
  // that data isn't sensitive and the site needs it to load.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

// Stricter CORS for admin/mutating routes — only the real frontend
// origin may call these (defense in depth on top of token auth).
function setStrictCors(req, res) {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Extract token from "Authorization: Bearer <token>" header.
// Falls back to body field for backwards compat during rollout.
function extractBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// ── Route handlers ────────────────────────────────────────────────

// GET /ping — lightweight keep-alive / wake-up check for Render's
// free-tier cold starts.
function handlePing(req, res) {
  res.writeHead(200);
  res.end('pong');
}

// GET /events — opens an SSE stream; client stays subscribed until
// it disconnects.
const MAX_SSE_CLIENTS = 50; // plenty for real visitors, blocks abuse

function handleSSE(req, res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Too many open connections, try again later');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('retry: 3000\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

// GET /state — returns the current admin-editable site state.
function handleGetState(req, res) {
  json(res, 200, adminState);
}

// POST /login — exchanges the admin password for a short-lived
// session token. This is the ONLY place the password is checked;
// the client never stores the password itself afterward.
async function handleLogin(req, parsed, res) {
  if (rateLimited(req, 'login', 8, 5 * 60 * 1000)) {
    json(res, 429, { error: 'Too many attempts, try again later' });
    return;
  }
  const sent = (parsed.password || '').trim();
  if (sent !== ADMIN_PASS) {
    console.warn(`Login failed — sent length ${sent.length}, expected length ${ADMIN_PASS.length}`);
    // Small delay to blunt brute-force/timing attacks.
    setTimeout(() => json(res, 403, { error: 'Unauthorized' }), 300);
    return;
  }
  const token = createSession();
  json(res, 200, { token, expiresIn: SESSION_TTL_MS });
}

// POST /reload — admin-only. Broadcasts a "reload" event to every
// connected SSE client (so other open tabs refresh after a change).
async function handleReload(req, parsed, res) {
  const token = extractBearerToken(req) || parsed.token;
  if (!isValidSession(token)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const senderId = parsed.sessionId || '';
  sseClients.forEach(client =>
    client.write(`event: reload\ndata: ${JSON.stringify({ from: senderId })}\n\n`)
  );
  console.log(`Reload broadcast to ${sseClients.size} client(s)`);
  json(res, 200, { ok: true, clients: sseClients.size });
}

// POST /state — admin-only. Merges a partial state patch into the
// persisted admin state.
async function handleSetState(req, parsed, res) {
  const token = extractBearerToken(req) || parsed.token;
  if (!isValidSession(token)) {
    json(res, 403, { error: 'Unauthorized' });
    return;
  }
  const patch = parsed.state || {};

  // Defense in depth: even though the frontend now renders this as
  // plain text, strip angle brackets server-side too and cap length
  // so a stolen/expired-but-replayed token can't be used to stuff
  // huge or markup-bearing values into persisted state.
  if (typeof patch.displayName === 'string') {
    patch.displayName = patch.displayName.replace(/[<>]/g, '').slice(0, 100);
  }

  adminState = {
    ...adminState,
    ...patch,
    socials: { ...adminState.socials, ...(patch.socials || {}) }
  };
  persistState(adminState);
  console.log('State updated + persisted:', adminState);
  json(res, 200, { ok: true });
}

// POST / — proxies chat messages to Groq so the API key never ships
// to the browser. Powers the "Clark" AI widget.
async function handleAI(req, parsed, res) {
  if (rateLimited(req, 'ai', 20, 60 * 1000)) {
    json(res, 429, { error: 'Slow down — too many requests' });
    return;
  }
  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    json(res, 400, { error: 'Missing messages array' });
    return;
  }
  // Cap payload size so this can't be used to run up Groq usage/cost.
  if (parsed.messages.length > 30 || JSON.stringify(parsed.messages).length > 12000) {
    json(res, 400, { error: 'Message payload too large' });
    return;
  }

  const payload = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: parsed.system || '' },
      ...parsed.messages
    ]
  });

  const options = {
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const proxy = https.request(options, r => {
    let data = '';
    r.on('data', d => data += d);
    r.on('end', () => {
      try {
        const reply = JSON.parse(data).choices?.[0]?.message?.content || 'No response.';
        json(res, 200, { content: [{ text: reply }] });
      } catch (e) {
        json(res, 500, { error: 'Parse error' });
      }
    });
  });
  proxy.on('error', err => json(res, 500, { error: err.message }));
  proxy.write(payload);
  proxy.end();
}

// ── Server + router ────────────────────────────────────────────
// No framework — just a manual method/url switch. Routes are listed
// in the order a request is most likely to hit them.

const RESTRICTED_ROUTES = new Set(['/login', '/reload', '/state', '/']);
const MAX_BODY_BYTES = 50 * 1024; // 50KB is plenty for these payloads

http.createServer((req, res) => {
  if (RESTRICTED_ROUTES.has(req.url) && req.method !== 'GET') {
    setStrictCors(req, res);
  } else {
    setCors(res);
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET routes
  if (req.method === 'GET') {
    if (req.url === '/ping') return handlePing(req, res);
    if (req.url === '/events') return handleSSE(req, res);
    if (req.url === '/state') return handleGetState(req, res);
    res.writeHead(200);
    res.end('OK');
    return;
  }

  // POST routes — body must be fully read before parsing
  if (req.method === 'POST') {
    let body = '';
    let tooLarge = false;
    req.on('data', d => {
      body += d;
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        res.writeHead(413);
        res.end('Payload too large');
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (tooLarge) return;
      let parsed;
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (e) {
        res.writeHead(400);
        res.end('Bad JSON');
        return;
      }

      console.log('POST', req.url);

      if (req.url === '/login') return handleLogin(req, parsed, res);
      if (req.url === '/reload') return handleReload(req, parsed, res);
      if (req.url === '/state') return handleSetState(req, parsed, res);
      if (req.url === '/') return handleAI(req, parsed, res);

      json(res, 404, { error: 'Not found' });
    });
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');

}).listen(PORT, () => console.log(`Proxy running on :${PORT}`));
