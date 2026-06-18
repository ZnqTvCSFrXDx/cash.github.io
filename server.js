const http     = require('http');
const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const nodemailer = require('nodemailer');

// ── Config ─────────────────────────────────────────
const PORT       = process.env.PORT || 3001;
const API_KEY    = process.env.GROQ_API_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS || '013301516002';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const STATE_FILE = path.join(__dirname, 'admin_state.json');

// ── Mailer ─────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'MISSING');
console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? 'SET' : 'MISSING');

// ── Persistent state ───────────────────────────────
const DEFAULT_STATE = {
  showEmail:   true,
  displayName: '',
  status:      'available',
  socials: {
    github:     true,
    discord:    true,
    instagram:  true,
    linkedin:   true,
    onlinejobs: true,
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return { ...DEFAULT_STATE, ...saved, socials: { ...DEFAULT_STATE.socials, ...(saved.socials || {}) } };
    }
  } catch (e) { console.warn('Failed to load state:', e.message); }
  return { ...DEFAULT_STATE, socials: { ...DEFAULT_STATE.socials } };
}

function persistState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
  catch (e) { console.warn('Failed to persist state:', e.message); }
}

let adminState = loadState();
console.log('State loaded:', adminState);

// ── SSE clients ────────────────────────────────────
const sseClients = new Set();

// ── Helpers ────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Route handlers ─────────────────────────────────
function handlePing(req, res) {
  res.writeHead(200); res.end('pong');
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('retry: 3000\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

function handleGetState(req, res) {
  json(res, 200, adminState);
}

async function handleReload(parsed, res) {
  if (parsed.password !== ADMIN_PASS) { res.writeHead(403); res.end(); return; }
  const senderId = parsed.sessionId || '';
  sseClients.forEach(client =>
    client.write(`event: reload\ndata: ${JSON.stringify({ from: senderId })}\n\n`)
  );
  console.log(`Reload broadcast to ${sseClients.size} client(s)`);
  json(res, 200, { ok: true, clients: sseClients.size });
}

async function handleSetState(parsed, res) {
  if (parsed.password !== ADMIN_PASS) { json(res, 403, { error: 'Unauthorized' }); return; }
  const patch = parsed.state || {};
  adminState = {
    ...adminState,
    ...patch,
    socials: { ...adminState.socials, ...(patch.socials || {}) }
  };
  persistState(adminState);
  console.log('State updated + persisted:', adminState);
  json(res, 200, { ok: true });
}

async function handleContact(parsed, res) {
  const { name, email, subject, message } = parsed;
  if (!name || !email || !subject || !message) {
    json(res, 400, { error: 'Missing fields' }); return;
  }
  try {
    await mailer.sendMail({
      from:    `"${name}" <${process.env.GMAIL_USER}>`,
      to:      process.env.GMAIL_USER,
      replyTo: email,
      subject: `[Portfolio] ${subject}`,
      text:    `From: ${name} <${email}>\n\n${message}`,
    });
    console.log('Email sent successfully');
    json(res, 200, { ok: true });
  } catch (e) {
    console.error('Mailer error:', e.message);
    json(res, 500, { error: e.message });
  }
}

async function handleAI(parsed, res) {
  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    json(res, 400, { error: 'Missing messages array' }); return;
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

// ── Server ─────────────────────────────────────────
http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET routes
  if (req.method === 'GET') {
    if (req.url === '/ping')   return handlePing(req, res);
    if (req.url === '/events') return handleSSE(req, res);
    if (req.url === '/state')  return handleGetState(req, res);
    res.writeHead(200); res.end('OK'); return;
  }

  // POST routes — read body first
  if (req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; }
      catch (e) { res.writeHead(400); res.end('Bad JSON'); return; }

      console.log('POST', req.url);

      if (req.url === '/reload')  return handleReload(parsed, res);
      if (req.url === '/state')   return handleSetState(parsed, res);
      if (req.url === '/contact') return handleContact(parsed, res);
      if (req.url === '/')        return handleAI(parsed, res);

      json(res, 404, { error: 'Not found' });
    });
    return;
  }

  res.writeHead(405); res.end('Method Not Allowed');

}).listen(PORT, () => console.log(`Proxy running on :${PORT}`));
