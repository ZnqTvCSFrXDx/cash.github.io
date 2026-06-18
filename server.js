const http = require('http');
const https = require('https');

const API_KEY = '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';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET') { res.writeHead(200); res.end('OK'); return; }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    console.log('Body received:', body);
    if (!body || !body.trim()) { res.writeHead(200); res.end('OK'); return; }
    let parsed;
    try { parsed = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('Bad JSON'); return; }
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
      console.log('Groq raw response:', data);
        const json = JSON.parse(data);
        console.log('Groq parsed:', JSON.stringify(json, null, 2));
        const reply = json.choices?.[0]?.message?.content || 'No response.';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ text: reply }] }));
      });
    });
    proxy.write(payload);
    proxy.end();
  });
}).listen(process.env.PORT || 3001, () => console.log('Proxy running'));