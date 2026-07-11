/* global console, process */

import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versions = ['0.1', '0.2'];
const checkOnly = process.argv.includes('--check');

for (const version of versions) {
  const source = resolve(root, 'packages', 'core', 'schema', version, 'story.json');
  const target = resolve(root, 'website', 'public', 'schema', version, 'story.json');

  if (!checkOnly) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }

  const [sourceBytes, targetBytes] = await Promise.all([
    readFile(source),
    readFile(target),
  ]);
  if (!sourceBytes.equals(targetBytes)) {
    throw new Error(`Schema mirror is stale: ${version}/story.json`);
  }
}

console.log(checkOnly ? 'Story schema mirrors are current.' : 'Story schemas synchronized.');
