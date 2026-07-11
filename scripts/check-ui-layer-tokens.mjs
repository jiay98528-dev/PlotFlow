import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'packages', 'app', 'src');
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    const checks = [
      { regex: /zIndex\s*:\s*[0-9]+/g, reason: 'numeric zIndex' },
      { regex: /var\(--z-[^,)]+,\s*[^)]+\)/g, reason: 'z-index token fallback' },
    ];
    for (const check of checks) {
      for (const match of source.matchAll(check.regex)) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        violations.push(`${path.relative(process.cwd(), absolute)}:${line} ${check.reason}`);
      }
    }
  }
}

walk(ROOT);
if (violations.length > 0) {
  console.error('Semantic UI layer gate failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Semantic UI layer gate passed.');
