// Load environment variables from .env file
require('dotenv').config();

const http = require('http');
const { readFile } = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const { buildSearchPayload, buildChatReply, getHealthPayload } = require('./lib/services');

const rootDir = path.resolve(__dirname, '..', '..');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

async function serveFile(res, absolutePath) {
  try {
    const fileContent = await readFile(absolutePath);
    const contentType = mimeTypes[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fileContent);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

function resolveStaticPath(requestPath) {
  const pathname = requestPath === '/' ? '/index.html' : requestPath;
  const candidatePath = path.resolve(rootDir, `.${pathname}`);
  if (candidatePath.startsWith(rootDir)) {
    return candidatePath;
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/api/health') {
    sendJson(res, 200, getHealthPayload());
    return;
  }

  if (requestUrl.pathname === '/api/search') {
    const query = requestUrl.searchParams.get('q') || '';
    sendJson(res, 200, await buildSearchPayload(query));
    return;
  }

  if (requestUrl.pathname === '/api/chat' && req.method === 'POST') {
    const body = await readJsonBody(req);
    sendJson(res, 200, await buildChatReply(body));
    return;
  }

  const staticPath = resolveStaticPath(requestUrl.pathname);
  if (staticPath) {
    await serveFile(res, staticPath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`LetMeFind backend running at http://localhost:${port}`);
  console.log('Environment status:');
  console.log('- RAPIDAPI_KEY:', process.env.RAPIDAPI_KEY ? 'SET' : 'NOT SET');
  console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
});
