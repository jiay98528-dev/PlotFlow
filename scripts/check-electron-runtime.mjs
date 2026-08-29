import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

function fail(message) {
  console.error(`Electron runtime preflight failed: ${message}`);
  console.error(
    'Run `pnpm rebuild electron` with network access, then retry the source E2E command.',
  );
  process.exit(1);
}

let packageDirectory;
try {
  packageDirectory = dirname(require.resolve('electron/package.json'));
} catch {
  fail('the electron package is not installed.');
}

const pathFile = join(packageDirectory, 'path.txt');
if (!existsSync(pathFile)) {
  fail(`missing ${pathFile}. The package postinstall did not download the Electron binary.`);
}

const relativeExecutable = readFileSync(pathFile, 'utf8').trim();
if (!relativeExecutable) {
  fail(`${pathFile} is empty.`);
}

const executablePath = process.env['ELECTRON_OVERRIDE_DIST_PATH']
  ? resolve(process.env['ELECTRON_OVERRIDE_DIST_PATH'], relativeExecutable)
  : isAbsolute(relativeExecutable)
    ? relativeExecutable
    : join(packageDirectory, 'dist', relativeExecutable);

if (!existsSync(executablePath)) {
  fail(`the configured Electron executable does not exist: ${executablePath}`);
}

console.log(`Electron runtime ready: ${executablePath}`);
