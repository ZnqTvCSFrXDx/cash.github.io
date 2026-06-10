const http = require('http');
const https = require('https');

const API_KEY = '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';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url !== '/' && req.url !== '') { res.writeHead(404); res.end(); return; }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    console.log('Body received:', body);
    const parsed = JSON.parse(body);
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
        const reply = json.choices?.[0]?.message?.content || 'No response.';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ text: reply }] }));
      });
    });
    proxy.write(payload);
    proxy.end();
  });
}).listen(3001, () => console.log('Proxy running on http://localhost:3001'));