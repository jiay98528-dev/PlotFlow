import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Invoked only by CreateProcess on the private desktop in windows-e2e-background.ps1.
// No shell or window is opened; Electron inherits that desktop from this process.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [desktop, output, pattern = '.', snapshotMode = 'compare'] = process.argv.slice(2);
if (!/^FableviaE2E-[a-f0-9]+$/.test(desktop ?? '') || process.env.PLOTFLOW_BACKGROUND_DESKTOP !== desktop) {
  throw new Error('Use windows-e2e-background.ps1 to create the isolated desktop first.');
}
const relative = path.relative(path.join(root, '.tmp'), path.resolve(output));
if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must stay under project .tmp.');
fs.mkdirSync(path.join(output, 'profile'), { recursive: true });
const require = createRequire(path.join(root, 'packages/app/package.json'));
const log = fs.openSync(path.join(output, 'run.log'), 'w');
fs.writeFileSync(path.join(output, 'desktop.txt'), desktop, 'utf8');
const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', 'e2e/playwright.config.ts', '--workers=1', '--output', path.join(output, 'results'), '--grep', pattern, ...(snapshotMode === 'update' ? ['--update-snapshots'] : [])], {
  cwd: path.join(root, 'packages/app'), windowsHide: true,
  env: { ...process.env, PLOTFLOW_TEST_USER_DATA_DIR: path.join(output, 'profile') },
  stdio: ['ignore', log, log],
});
child.on('error', (error) => {
  fs.writeFileSync(path.join(output, 'startup-error.txt'), String(error), 'utf8');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  const result = code ?? 1;
  fs.writeFileSync(path.join(output, 'exit-code.txt'), String(result), 'utf8');
  fs.closeSync(log);
  process.exitCode = result;
});
