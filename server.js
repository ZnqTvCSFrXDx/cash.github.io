const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const API_KEY    = process.env.GROQ_API_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS || '013301516002';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'MISSING');
console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? 'SET' : 'MISSING');

// ── Persistent state via JSON file ──
const STATE_FILE = path.join(__dirname, 'admin_state.json');

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
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const saved = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...saved,
        socials: { ...DEFAULT_STATE.socials, ...(saved.socials || {}) }
      };
    }
  } catch(e) { console.warn('Failed to load state file:', e.message); }
  return { ...DEFAULT_STATE, socials: { ...DEFAULT_STATE.socials } };
}

function persistState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch(e) { console.warn('Failed to persist state:', e.message); }
}

let adminState = loadState();
console.log('State loaded:', adminState);

// ── SSE clients ──
const sseClients = new Set();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Ping ──
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong'); return;
  }

  // ── SSE ──
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── GET state ──
  if (req.method === 'GET' && req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(adminState)); return;
  }

  // ── Fallback GET ──
  if (req.method === 'GET') { res.writeHead(200); res.end('OK'); return; }

  // ── All POSTs: read body first ──
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    console.log('POST', req.url, body);

    let parsed;
    try { parsed = body ? JSON.parse(body) : {}; }
    catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

    // ── POST /reload ──
    if (req.url === '/reload') {
      if (parsed.password !== ADMIN_PASS) { res.writeHead(403); res.end(); return; }
      const senderId = parsed.sessionId || '';
      sseClients.forEach(client =>
        client.write(`event: reload\ndata: ${JSON.stringify({ from: senderId })}\n\n`)
      );
      console.log(`Reload broadcast to ${sseClients.size} client(s)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: sseClients.size }));
      return;
    }

    // ── POST /state ──
    if (req.url === '/state') {
      if (parsed.password !== ADMIN_PASS) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' })); return;
      }
      const patch = parsed.state || {};
      adminState = {
        ...adminState,
        ...patch,
        socials: { ...adminState.socials, ...(patch.socials || {}) }
      };
      persistState(adminState);
      console.log('State updated + persisted:', adminState);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true })); return;
    }

    // ── POST /contact ──
    if (req.url === '/contact') {
      const { name, email, subject, message } = parsed;
      if (!name || !email || !subject || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing fields' })); return;
      }
      try {
        await mailer.sendMail({
          from: `"${name}" <${process.env.GMAIL_USER}>`,
          to: process.env.GMAIL_USER,
          replyTo: email,
          subject: `[Portfolio] ${subject}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        });
        console.log('Email sent successfully');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true })); return;
      } catch(e) {
        console.error('Mailer error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message })); return;
      }
    }

    // ── POST / (AI chat proxy) ──
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown route or missing messages' })); return;
    }

    const payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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
          const json = JSON.parse(data);
          const reply = json.choices?.[0]?.message?.content || 'No response.';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: [{ text: reply }] }));
        } catch(e) {
          res.writeHead(500); res.end(JSON.stringify({ error: 'Parse error' }));
        }
      });
    });
    proxy.on('error', err => {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    });
    proxy.write(payload);
    proxy.end();
  });

}).listen(process.env.PORT || 3001, () => console.log('Proxy running'));