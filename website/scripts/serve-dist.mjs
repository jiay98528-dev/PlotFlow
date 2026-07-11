import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, '..');
const root = path.join(websiteRoot, 'dist');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4177);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function safePath(urlPath) {
  const normalized = decodeURIComponent(urlPath.split('?')[0] || '/');
  const requestPath = normalized === '/' ? '/index.html' : normalized;
  const file = path.join(root, requestPath);
  if (!file.startsWith(root)) {
    return null;
  }
  return file;
}

const server = createServer(async (request, response) => {
  const candidate = safePath(request.url ?? '/');
  if (!candidate) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(candidate);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(candidate)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch (_error) {
    const hasExtension = path.extname(candidate) !== '';
    if (hasExtension) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const fallback = await readFile(path.join(root, 'index.html'));
    response.writeHead(200, { 'Content-Type': contentTypes['.html'] });
    response.end(fallback);
  }
});

server.listen(port, host, () => {
  console.log(`PlotFlow website preview: http://${host}:${port}/`);
});
