import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEnvironment, validatePackResult } from './review-contract.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function walk(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, absolute));
    else if (!['SHA256SUMS.txt', 'pack-manifest.json'].includes(entry.name)) files.push(absolute);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

const evidenceDir = path.resolve(argument('evidence-dir') ?? '');
const resultPath = path.join(evidenceDir, 'result.json');
const environmentPath = path.join(evidenceDir, 'environment.json');
const [result, environment] = await Promise.all([
  readFile(resultPath, 'utf8').then(JSON.parse),
  readFile(environmentPath, 'utf8').then(JSON.parse),
]);
const errors = validatePackResult(result);
if (errors.length > 0) throw new Error(`Invalid pack result:\n- ${errors.join('\n- ')}`);
const environmentBlockers = validateEnvironment(environment);
if (environmentBlockers.length > 0) {
  throw new Error(`Environment is not authoritative:\n- ${environmentBlockers.join('\n- ')}`);
}
if (environment.revision !== result.revision) throw new Error('Environment and result revisions do not match.');

const files = await walk(evidenceDir);
const records = [];
for (const file of files) {
  const bytes = await readFile(file);
  const info = await stat(file);
  records.push({
    path: path.relative(evidenceDir, file).replaceAll(path.sep, '/'),
    bytes: info.size,
    sha256: sha256(bytes),
  });
}
const videos = records.filter((record) => /\.(mkv|mp4|webm)$/i.test(record.path));
if (videos.length === 0) throw new Error('Evidence pack has no OBS or Playwright video.');

await writeFile(
  path.join(evidenceDir, 'SHA256SUMS.txt'),
  `${records.map((record) => `${record.sha256} *${record.path}`).join('\n')}\n`,
  'utf8',
);
await writeFile(
  path.join(evidenceDir, 'pack-manifest.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    pack: result.pack,
    status: result.status,
    revision: result.revision,
    files: records,
  }, null, 2)}\n`,
  'utf8',
);
console.log(`Finalized ${result.pack}: ${records.length} files, ${videos.length} video(s).`);
