import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT ?? 8081);
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = join(process.cwd(), 'dist');

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.map', 'application/json; charset=utf-8'],
]);

createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const decodedPath = normalize(decodeURIComponent(requestUrl.pathname)).replace(/^\/+/, '');
  const candidate = join(DIST, decodedPath);

  try {
    const filePath = await resolveFile(candidate);
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', CONTENT_TYPES.get(extname(filePath)) ?? 'application/octet-stream');
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(DIST, 'index.html'));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(body);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Missing dist/index.html. Run npm run web:build first.');
    }
  }
}).listen(PORT, HOST, () => {
  process.stdout.write(`Serving ${DIST} at http://${HOST}:${PORT}\n`);
});

async function resolveFile(candidate) {
  if (!candidate.startsWith(DIST)) {
    throw new Error('Path traversal blocked');
  }

  const fileStats = await stat(candidate);
  if (fileStats.isFile()) {
    return candidate;
  }

  throw new Error('Not a file');
}