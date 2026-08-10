import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
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
    res.setHeader(
      'Content-Type',
      CONTENT_TYPES.get(extname(filePath)) ?? 'application/octet-stream'
    );
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

  // `expo export` writes static routes as sibling files -- /equipment becomes
  // equipment.html, not equipment/index.html. Without the .html attempt every
  // route but "/" fell through to the SPA fallback, so the browser was handed
  // the home page's markup for every deep link and only recovered once the
  // client-side router hydrated.
  for (const attempt of [candidate, `${candidate}.html`, join(candidate, 'index.html')]) {
    try {
      const fileStats = await stat(attempt);
      if (fileStats.isFile()) return attempt;
    } catch {
      // Try the next shape.
    }
  }

  // Dynamic routes -- e.g. recipe/[id] -- export as a literal `[id].html`
  // file, so a hard refresh on /recipe/123 has no literal match above and
  // fell through to the outer index.html fallback: the browser got the home
  // page's markup for a route it has nothing to do with. Look for a
  // bracketed sibling in the same directory before giving up.
  const dynamicMatch = await resolveDynamicSibling(candidate);
  if (dynamicMatch) return dynamicMatch;

  throw new Error('Not a file');
}

async function resolveDynamicSibling(candidate) {
  let entries;
  try {
    entries = await readdir(dirname(candidate));
  } catch {
    return null;
  }

  const bracketed = entries.find((entry) => /^\[.+\]\.html$/.test(entry));
  return bracketed ? join(dirname(candidate), bracketed) : null;
}
