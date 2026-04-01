const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3030;

const ENDPOINTS = {
  test: { host: 'mydataapidev.aade.gr', path: '/SendInvoices' },
  prod: { host: 'mydataapidev.aade.gr', path: '/SendInvoices' },
};

function httpsPost({ host, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path, method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, aade-user-id, Ocp-Apim-Subscription-Key, x-env');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('myDATA Proxy OK');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/send') {
    res.writeHead(404); res.end('Not found'); return;
  }

  const env = req.headers['x-env'] === 'prod' ? 'prod' : 'test';
  const endpoint = ENDPOINTS[env];
  const userId = req.headers['aade-user-id'] || '';
  const subKey = req.headers['ocp-apim-subscription-key'] || '';

  if (!userId || !subKey) { res.writeHead(400); res.end('Missing credentials'); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const result = await httpsPost({
        host: endpoint.host,
        path: endpoint.path,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(body),
          'aade-user-id': userId,
          'Ocp-Apim-Subscription-Key': subKey,
        },
        body,
      });
      // Log the full response for debugging
      console.log(`[${new Date().toISOString()}] ${env.toUpperCase()} → HTTP ${result.status}`);
      console.log(`RESPONSE: ${result.body}`);
      res.writeHead(result.status, { 'Content-Type': 'application/xml' });
      res.end(result.body);
    } catch (err) {
      console.error('Error:', err.message);
      res.writeHead(502); res.end('Proxy error: ' + err.message);
    }
  });
});

server.listen(PORT, () => console.log(`myDATA Proxy running on port ${PORT}`));
