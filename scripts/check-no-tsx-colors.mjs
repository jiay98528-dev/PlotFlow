import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGETS = [join(ROOT, 'packages', 'app', 'src')];
const FILE_RE = /\.(ts|tsx)$/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_RE = /\brgba?\s*\(/;

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!FILE_RE.test(entry.name)) continue;
    checkFile(fullPath);
  }
}

function checkFile(filePath) {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (HEX_RE.test(line) || RGB_RE.test(line)) {
      violations.push(`${relative(ROOT, filePath)}:${index + 1}: ${line.trim()}`);
    }
  });
}

for (const target of TARGETS) {
  walk(target);
}

if (violations.length > 0) {
  console.error('TS/TSX files must not contain hard-coded hex/rgb colors. Move fallbacks to CSS/theme tokens.');
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log('No TS/TSX hard-coded colors found.');
