import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appOut = resolve(root, 'packages', 'app', 'out');

if (!appOut.startsWith(resolve(root, 'packages', 'app'))) {
  throw new Error(`Refusing to clean unexpected path: ${appOut}`);
}

await rm(appOut, { recursive: true, force: true });
