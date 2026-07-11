import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, '..');
const staticDir = path.join(websiteRoot, 'static');
const publicDir = path.join(websiteRoot, 'public');
const distDir = path.join(websiteRoot, 'dist-static');

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });
await cp(staticDir, distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

console.log(`Built static website at ${path.relative(process.cwd(), distDir)}`);
