import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MOJIBAKE = /锛|鈥|鏂|缁|鐨|妫|鍙|浠|妗|绔|鏍|瀵|浣|璇/g;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'out', 'release', 'dist', 'dist-static']);

// Euro currency symbols are valid prose, not evidence of corrupted encoding.
const LEGACY_BUDGETS = new Map();

function collectMarkdown(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectMarkdown(absolute, files);
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
  }
  return files;
}

const failures = [];
for (const absolute of collectMarkdown(ROOT)) {
  const relative = path.relative(ROOT, absolute).replaceAll('\\', '/');
  const count = fs.readFileSync(absolute, 'utf8').match(MOJIBAKE)?.length ?? 0;
  const budget = LEGACY_BUDGETS.get(relative) ?? 0;
  if (count > budget) failures.push(`${relative}: ${count} markers (budget ${budget})`);
}

if (failures.length > 0) {
  console.error('Mojibake documentation gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Documentation mojibake gate passed; no legacy budget increased.');
