#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLACKBOX_TARGETS = new Set(['winUnpacked', 'installedExe']);

function resolvePlaywrightCli(cwd) {
  const requireFromPackage = createRequire(resolve(cwd, 'package.json'));
  return requireFromPackage.resolve('@playwright/test/cli');
}

export function createPlaywrightLaunch({
  target,
  args,
  cwd = process.cwd(),
  environment = process.env,
  execPath = process.execPath,
  resolveCli = resolvePlaywrightCli,
}) {
  if (!BLACKBOX_TARGETS.has(target)) {
    throw new Error(`Unsupported blackbox target: ${target || '(missing)'}`);
  }

  return {
    command: execPath,
    args: [resolveCli(cwd), ...args],
    cwd,
    env: { ...environment, PLOTFLOW_BLACKBOX_TARGET: target },
  };
}

export function runPlaywrightLaunch(launch, spawnProcess = spawn) {
  return new Promise((resolveExit, reject) => {
    const child = spawnProcess(launch.command, launch.args, {
      cwd: launch.cwd,
      env: launch.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}

async function main() {
  const [target = '', ...args] = process.argv.slice(2);
  const launch = createPlaywrightLaunch({ target, args });
  const result = await runPlaywrightLaunch(launch);
  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }
  process.exitCode = result.code ?? 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
