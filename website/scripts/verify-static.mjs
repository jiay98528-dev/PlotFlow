import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, '..');
const distDir = path.join(websiteRoot, 'dist-static');

const requiredFiles = [
  'index.html',
  'app.js',
  'styles.css',
  path.join('data', 'project-status.json'),
];

for (const file of requiredFiles) {
  await readFile(path.join(distDir, file), 'utf8');
}

const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const js = await readFile(path.join(distDir, 'app.js'), 'utf8');
const css = await readFile(path.join(distDir, 'styles.css'), 'utf8');
const readJson = async (filePath) => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
};
const status = await readJson(path.join(distDir, 'data', 'project-status.json'));

const assertions = [
  [html.includes('维叙（Fablevia）'), 'index.html should include the localized Fablevia title'],
  [js.includes('Fablevia'), 'static app should include the product name'],
  [js.includes('.mdstory'), 'static app should include the source file extension'],
  [js.includes('Graph Lab'), 'static app should include Graph Lab'],
  [js.includes('Windows'), 'static app should include Windows'],
  [
    js.includes('From the first .mdstory file to a usable export'),
    'English guide copy should exist',
  ],
  [!js.match(/没有BUG|无 BUG|bug-free/i), 'copy should not claim bug-free status'],
  [css.includes('--color-paper'), 'CSS tokens should exist'],
  [typeof status.summary.version === 'string', 'project status should have a software version'],
  [status.releaseGates.length >= 5, 'project status should include release gates'],
  [
    status.releaseGates.some((gate) => gate.name === 'pnpm.cmd test' && gate.detail),
    'unit check must carry current detail',
  ],
];

const failed = assertions.filter(([passed]) => !passed);
if (failed.length > 0) {
  for (const [, message] of failed) {
    console.error(`FAIL: ${message}`);
  }
  process.exit(1);
}

console.log('Static website verification passed');
