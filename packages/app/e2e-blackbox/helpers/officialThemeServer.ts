import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { basename, dirname, join } from 'node:path';

export interface OfficialThemeServer {
  readonly server: Server;
  readonly registryUrl: string;
  readonly close: () => Promise<void>;
}

export async function startOfficialThemeServer(zipPath: string, options: { hashMismatch?: boolean } = {}): Promise<OfficialThemeServer> {
  const zip = await readFile(zipPath);
  const actualHash = createHash('sha256').update(zip).digest('hex');
  const sha256 = options.hashMismatch ? `0${actualHash.slice(1)}` : actualHash;
  const zipName = basename(zipPath);
  const manifestUrl = '/themes/plotflow-neon-dossier/manifest.json';
  const bundleUrl = `/themes/plotflow-neon-dossier/${zipName}`;

  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (url === '/data/official-themes.json') {
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        themes: [{
          id: 'plotflow-neon-dossier',
          name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
          version: '1.0.0',
          channel: 'stable',
          priceLabel: '免费主题',
          manifestUrl: `${origin}${manifestUrl}`,
          bundleUrl: `${origin}${bundleUrl}`,
          sha256,
          minAppVersion: '0.1.0',
          themeApiVersion: 1,
          previewUrl: `${origin}/themes/plotflow-neon-dossier/assets/preview.svg`,
          changelog: '官方远程 ZIP 代码主题黑盒 fixture。',
        }],
      }));
      return;
    }

    if (url === bundleUrl) {
      response.setHeader('content-type', 'application/zip');
      response.end(zip);
      return;
    }

    if (url === manifestUrl) {
      void readFile(join(dirname(zipPath), 'manifest.json'), 'utf-8')
        .then((content) => {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(content);
        })
        .catch(() => {
          response.statusCode = 404;
          response.end('not found');
        });
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = (server.address() as { port: number }).port;
  return {
    server,
    registryUrl: `http://127.0.0.1:${port}/data/official-themes.json`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
