import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'out', 'renderer', 'assets');
const ENTRY_BUDGET_BYTES = 3 * 1024 * 1024;

const files = readdirSync(ASSETS_DIR).filter((file) => file.endsWith('.js'));
const entryFiles = files.filter((file) => /^index-[A-Za-z0-9_-]+\.js$/.test(file));
const reports = files
  .map((file) => ({ file, size: statSync(join(ASSETS_DIR, file)).size }))
  .sort((a, b) => b.size - a.size);

for (const item of reports) {
  const mb = (item.size / 1024 / 1024).toFixed(2);
  console.log(`${item.file}: ${mb} MB`);
}

const oversized = entryFiles
  .map((file) => ({ file, size: statSync(join(ASSETS_DIR, file)).size }))
  .filter((item) => item.size > ENTRY_BUDGET_BYTES);

if (oversized.length > 0) {
  console.error(`Renderer entry chunk exceeds ${(ENTRY_BUDGET_BYTES / 1024 / 1024).toFixed(1)} MB raw budget.`);
  process.exit(1);
}
