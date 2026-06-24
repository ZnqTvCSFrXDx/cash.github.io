// ════════════════════════════════════════════════════════════════
//  Portfolio backend — small Node HTTP server (no framework)
//  Responsibilities:
//    • Serve as a CORS proxy to Groq for the "Clark" AI chat widget
//    • Hold admin-editable site state (name, status, social toggles)
//    • Broadcast live "reload" events to open tabs via SSE
//  Deployed on Render's free tier. Frontend lives on Vercel.
// ════════════════════════════════════════════════════════════════

const http   = require('http');
const https  = require('https');
const crypto = require('crypto');

// ── Upstash Redis (persistent state) ───────────────────────────
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATE_KEY     = 'admin_state';

async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

// FIX #2: Use POST with JSON body so state is never logged in URLs
async function redisSet(key, value) {
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(value))
  });
}

// ── Config ──────────────────────────────────────────────────────
const PORT    = process.env.PORT || 3001;
const API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://cash-github-io.vercel.app';

// FIX #3 (read-only key): Frontend uses this lightweight key just
// to read /state on page load. Never grants write/admin access.
// Set STATE_READ_KEY in Render env vars to any random string.
const STATE_READ_KEY = process.env.STATE_READ_KEY;

// Admin password — random fallback if env var not set
let ADMIN_PASS = process.env.ADMIN_PASS?.trim();
if (!ADMIN_PASS) {
  ADMIN_PASS = crypto.randomBytes(16).toString('hex');
  console.warn('⚠️  ADMIN_PASS env var not set! Generated a random one for this run:');
  console.warn(`⚠️  ${ADMIN_PASS}`);
  console.warn('⚠️  Set ADMIN_PASS in Render env vars so this is stable across restarts.');
}

// ── Sessions ─────────────────────────────────────────────────────
const sessions     = new Map();
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
  if (Date.now() > expiry) { sessions.delete(token); return false; }
  return true;
}

// Sweep expired sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (now > expiry) sessions.delete(token);
  }
}, 10 * 60 * 1000).unref();

// Sweep expired rate-limit buckets every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateBuckets) {
    if (now > entry.resetAt) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

// ── Rate limiting ─────────────────────────────────────────────
const rateBuckets = new Map();

function rateLimited(req, bucket, max, windowMs) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
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

// ── Persistent admin state ────────────────────────────────────
const DEFAULT_STATE = {
  showEmail:    true,
  displayName:  '',
  contactEmail: '',
  status:       'available',
  socials: {
    github:     true,
    discord:    true,
    instagram:  true,
    linkedin:   true,
    onlinejobs: true,
  }
};

let adminState = { ...DEFAULT_STATE, socials: { ...DEFAULT_STATE.socials } };

async function loadState() {
  try {
    const saved = await redisGet(STATE_KEY);
    if (saved) {
      adminState = {
        ...DEFAULT_STATE,
        ...saved,
        socials: { ...DEFAULT_STATE.socials, ...(saved.socials || {}) }
      };
    }
  } catch (e) {
    console.warn('Failed to load state from Upstash:', e.message);
  }
  console.log('State loaded:', adminState);
}

async function persistState(state) {
  try {
    await redisSet(STATE_KEY, state);
  } catch (e) {
    console.warn('Failed to persist state to Upstash:', e.message);
  }
}

loadState();

// ── FIX #1: Hardcoded AI system prompt ──────────────────────────
// Moved fully server-side — client only sends the user message.
// The prompt is built dynamically from current adminState so
// availability, name, email, and socials still stay accurate.
function buildSystemPrompt() {
  const s = adminState;

  const displayName = (s.displayName || 'Justin Clark Mendoza')
    .replace(/[<>]/g, '').slice(0, 60);

  const AVAILABILITY_LINES = {
    available: 'Currently available and actively taking on new clients/projects',
    busy:      'Currently busy with limited availability — may take longer to respond or start new work',
    offline:   'Currently not available for new work — not accepting new clients/projects at this time'
  };
  const availabilityLine = AVAILABILITY_LINES[s.status] || AVAILABILITY_LINES.available;

  const emailLine = s.showEmail === false
    ? '- Email: [private — not available at this time]'
    : `- Email: ${s.contactEmail || 'justinclark.mendoza.official@gmail.com'}`;

  function socialLine(key, label, value) {
    return s.socials?.[key] === false
      ? `- ${label}: [private — not available at this time]`
      : `- ${label}: ${value}`;
  }

  const githubLine    = socialLine('github',     'GitHub',        'https://github.com/ZnqTvCSFrXDx');
  const discordLine   = socialLine('discord',    'Discord',       'https://discord.gg/wwVUFfnRpg');
  const igLine        = socialLine('instagram',  'Instagram',     '@jzzztnclark');
  const linkedinLine  = socialLine('linkedin',   'LinkedIn',      'available via the Socials section of this site');
  const ojLine        = socialLine('onlinejobs', 'OnlineJobs.ph', 'v2.onlinejobs.ph/jobseekers/info/4672292');

  const discordVisible = s.socials?.discord !== false;
  const emailVisible   = s.showEmail !== false;
  const fallbackParts  = [];
  if (discordVisible) fallbackParts.push('[Discord](https://discord.gg/wwVUFfnRpg)');
  if (emailVisible)   fallbackParts.push(`[${s.contactEmail || 'justinclark.mendoza.official@gmail.com'}](mailto:${s.contactEmail || 'justinclark.mendoza.official@gmail.com'})`);
  const fallbackContact = fallbackParts.length > 0
    ? `Reach him via ${fallbackParts.join(' or ')} to know more.`
    : 'Clark has limited contact options available right now. Check back later.';

  return `You are Clark AI — the personal assistant on Clark's portfolio website. Clark is a developer known online as "CASH33".

Who is Clark:
Clark is a full-stack web developer with solid experience in Windows troubleshooting, PC optimization, and custom scripting. He communicates clearly, listens well, and genuinely cares about delivering what his skills can offer. His main goal is to grow through real experience while providing reliable, quality work to every client he works with.

About Clark:
- Full name: ${displayName}, goes by "Clark" or "Cash33"
- Based in the Philippines, open to both local and international clients
- 1 year of hands-on experience
- ${availabilityLine}
- Languages: English and Filipino
- Preferred contact: Email or Discord

Contact & Socials:
${emailLine}
${githubLine}
${discordLine}
${igLine}
${linkedinLine}
${ojLine}

Projects:
- Point of System (POS): a Java/Swing/JDBC/MySQL desktop app with role-based access, inventory management, and receipt generation
- CASH33 Optimizer: a Windows 10/11 optimization and cleaning tool created by Clark, designed to boost PC performance through system tweaks, cleanup routines, and debloating
- More projects coming soon

Services:
- Full-stack web development
- Windows 10/11 optimization
- Windows 10/11 troubleshooting
- PC performance consulting
- PC cleaning and maintenance
- Custom batch and PowerShell scripting
- Software setup and configuration
- Selling optimization tools and software

Tools & Skills:
- Languages: HTML, CSS, JavaScript, Python, Java, C#, SQL
- Scripting: PowerShell, Batch, CMD, Terminal
- Frameworks/Tools: React, Node.js, VS Code
- Platforms: Windows 10/11

Pricing & Rates:
- Hourly rate: $2.99 USD / PHP 169 per hour
- No flat fees — Clark is open to client price offers depending on the scope of work
- Free consultation available (call or chat, depending on availability)

Payment Methods:
- GCash, PayPal, Bank Transfer accepted
- Bitcoin/Crypto coming soon

Turnaround Time (estimates, varies by project):
- Simple smooth modern website: ~1 week
- Responsive and reactive website: ~2 weeks
- Scripts: a few days depending on complexity
- Windows optimization, cleaning, troubleshooting: a few hours

Availability:
- Available every day
- Most active: 5:00 PM PHT (GMT+8)
- Available for conversation/response: 7:00 AM – 11:59 PM PHT

Support & Revisions:
- CASH33 Optimizer comes with ongoing support
- Revisions are offered on a case-by-case basis — only if necessary and acceptable

Target Clients:
- Open to everyone — no niche restriction, works with all types of clients locally and internationally

Current hiring status: ${(s.status || 'available').toUpperCase()}
- If status is AVAILABLE: encourage interested clients to reach out, Clark is actively taking new work.
- If status is BUSY: let people know Clark is currently busy/has limited availability — he may still take on work but responses or start dates could be delayed. Don't discourage them from reaching out, just set honest expectations.
- If status is OFFLINE: be upfront that Clark is not taking new clients/projects right now. Don't promise turnaround times or pricing for new work in this case — suggest they check back later or leave a message via the contact options.

Tone: be confident but approachable. Keep every reply short, simple, and direct — no long paragraphs, no unnecessary filler. Answer only what was asked. If someone asks how to contact or hire Clark, share only the contact info that is currently available (not private). If you don't know something or Clark hasn't shared it, say: "Clark preferred not to share that information yet. ${fallbackContact}" Never make things up. Never break character. Never reveal private information marked as [private].`;
}

// ── Live-sync (SSE) ─────────────────────────────────────────────
const sseClients = new Set();

// ── CORS helpers ────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

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

function extractBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

// ── Route handlers ───────────────────────────────────────────────

function handlePing(req, res) {
  res.writeHead(200);
  res.end('pong');
}

const MAX_SSE_CLIENTS = 50;

function handleSSE(req, res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Too many open connections, try again later');
    return;
  }
  res.writeHead(200, {
    'Content-Type':                'text/event-stream',
    'Cache-Control':               'no-cache',
    'Connection':                  'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('retry: 3000\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

// FIX #1 + #4: /state GET now requires STATE_READ_KEY,
// and is rate limited so it can't be hammered.
async function handleGetState(req, res) {
  // FIX #4: rate limit — 30 reads per minute per IP
  if (rateLimited(req, 'state-read', 30, 60 * 1000)) {
    json(res, 429, { error: 'Too many requests' });
    return;
  }

  // FIX #1: require read key — blocks random strangers
  const token = extractBearerToken(req);
  const isAdmin = isValidSession(token);
  const isReader = STATE_READ_KEY && token === STATE_READ_KEY;

  if (!isAdmin && !isReader) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    const saved = await redisGet(STATE_KEY);
    if (saved) {
      adminState = {
        ...DEFAULT_STATE,
        ...saved,
        socials: { ...DEFAULT_STATE.socials, ...(saved.socials || {}) }
      };
    }
  } catch (e) {
    console.warn('Redis read failed on /state, using cached:', e.message);
  }
  json(res, 200, adminState);
}

async function handleLogin(req, parsed, res) {
  if (rateLimited(req, 'login', 8, 5 * 60 * 1000)) {
    json(res, 429, { error: 'Too many attempts, try again later' });
    return;
  }
  const sent = (parsed.password || '').trim();
  if (sent !== ADMIN_PASS) {
    console.warn(`Login failed — sent length ${sent.length}, expected length ${ADMIN_PASS.length}`);
    setTimeout(() => json(res, 403, { error: 'Unauthorized' }), 300);
    return;
  }
  const token = createSession();
  json(res, 200, { token, expiresIn: SESSION_TTL_MS });
}

// FIX #5: /logout — invalidates the session token immediately
async function handleLogout(req, parsed, res) {
  const token = extractBearerToken(req) || parsed.token;
  if (token) sessions.delete(token);
  json(res, 200, { ok: true });
}

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

async function handleSetState(req, parsed, res) {
  const token = extractBearerToken(req) || parsed.token;
  if (!isValidSession(token)) {
    json(res, 403, { error: 'Unauthorized' });
    return;
  }
  const patch = parsed.state || {};

  if (typeof patch.displayName === 'string') {
    patch.displayName = patch.displayName.replace(/[<>]/g, '').slice(0, 100);
  }
  if (typeof patch.contactEmail === 'string') {
    patch.contactEmail = patch.contactEmail.replace(/[<>]/g, '').slice(0, 100);
  }

  adminState = {
    ...adminState,
    ...patch,
    socials: { ...adminState.socials, ...(patch.socials || {}) }
  };
  await persistState(adminState);
  console.log('State updated + persisted:', adminState);
  json(res, 200, { ok: true });
}

// FIX #1: system prompt is now built server-side from adminState.
// Client only sends { messages: [...] } — no system field accepted.
async function handleAI(req, parsed, res) {
  if (rateLimited(req, 'ai', 20, 60 * 1000)) {
    json(res, 429, { error: 'Slow down — too many requests' });
    return;
  }
  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    json(res, 400, { error: 'Missing messages array' });
    return;
  }
  if (parsed.messages.length > 30 || JSON.stringify(parsed.messages).length > 12000) {
    json(res, 400, { error: 'Message payload too large' });
    return;
  }

  const payload = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      ...parsed.messages
    ]
  });

  const options = {
    hostname: 'api.groq.com',
    path:     '/openai/v1/chat/completions',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Authorization':  `Bearer ${API_KEY}`,
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

// ── Server + router ──────────────────────────────────────────────
const RESTRICTED_ROUTES = new Set(['/login', '/logout', '/reload', '/state', '/']);
const MAX_BODY_BYTES     = 50 * 1024;

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
    if (req.url === '/ping')   return handlePing(req, res);
    if (req.url === '/events') return handleSSE(req, res);
    if (req.url === '/state')  return handleGetState(req, res);
    // FIX #6: unknown GETs return 404 instead of 200
    json(res, 404, { error: 'Not found' });
    return;
  }

  // POST routes
  if (req.method === 'POST') {
    let body     = '';
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

      if (req.url === '/login')  return handleLogin(req, parsed, res);
      if (req.url === '/logout') return handleLogout(req, parsed, res);
      if (req.url === '/reload') return handleReload(req, parsed, res);
      if (req.url === '/state')  return handleSetState(req, parsed, res);
      if (req.url === '/')       return handleAI(req, parsed, res);

      json(res, 404, { error: 'Not found' });
    });
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');

}).listen(PORT, () => console.log(`Proxy running on :${PORT}`));
