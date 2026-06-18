const http = require('http');
const https = require('https');

const API_KEY = process.env.GROQ_API_KEY;
const ADMIN_PASS = process.env.ADMIN_PASS || '013301516002';

// ── SSE clients (for live reload broadcast) ──
const sseClients = new Set();

// ── In-memory admin state (persists while server is awake) ──
let adminState = {
  showEmail:   true,
  displayName: '',
  socials: {
    github:     true,
    discord:    true,
    instagram:  true,
    linkedin:   true,
    onlinejobs: true,
  }
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Keep-alive ping ──
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong'); return;
  }

  // ── SSE: visitors connect here for live reload ──
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000

');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── Broadcast reload to all visitors (admin only) ──
  if (req.method === 'POST' && req.url === '/reload') {
    let body2 = '';
    req.on('data', d => body2 += d);
    req.on('end', () => {
      let p; try { p = JSON.parse(body2); } catch(e) { res.writeHead(400); res.end(); return; }
      if (p.password !== ADMIN_PASS) { res.writeHead(403); res.end(); return; }
      sseClients.forEach(client => client.write('event: reload
data: 1

'));
      console.log(`Reload broadcast to ${sseClients.size} client(s)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: sseClients.size }));
    });
    return;
  }

  // ── Get current state (public) ──
  if (req.method === 'GET' && req.url === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(adminState)); return;
  }

  // ── Fallback GET ──
  if (req.method === 'GET') { res.writeHead(200); res.end('OK'); return; }

  // ── All POST routes ──
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    if (!body || !body.trim()) { res.writeHead(200); res.end('OK'); return; }
    let parsed;
    try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }

    // ── Save admin state ──
    if (req.url === '/state') {
      if (parsed.password !== ADMIN_PASS) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' })); return;
      }
      adminState = { ...adminState, ...parsed.state };
      console.log('Admin state updated:', adminState);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true })); return;
    }

    // ── AI chat proxy ──
    const payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: parsed.system },
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
        const json = JSON.parse(data);
        const reply = json.choices?.[0]?.message?.content || 'No response.';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ text: reply }] }));
      });
    });
    proxy.on('error', err => {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    });
    proxy.write(payload);
    proxy.end();
  });
}).listen(process.env.PORT || 3001, () => console.log('Proxy running'));
