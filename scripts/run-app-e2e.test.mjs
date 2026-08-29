import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createPlaywrightLaunch, runPlaywrightLaunch } from './run-app-e2e.mjs';

test('creates the same shell-independent Playwright launch contract on every platform', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    const launch = createPlaywrightLaunch({
      target: 'winUnpacked',
      args: ['--config', 'e2e-blackbox/playwright.config.ts', '--workers=1'],
      cwd: '/workspace/packages/app',
      environment: { SIMULATED_PLATFORM: platform },
      execPath: '/runtime/node',
      resolveCli: () => '/workspace/playwright-cli.js',
    });

    assert.equal(launch.command, '/runtime/node');
    assert.deepEqual(launch.args, [
      '/workspace/playwright-cli.js',
      '--config',
      'e2e-blackbox/playwright.config.ts',
      '--workers=1',
    ]);
    assert.equal(launch.env.PLOTFLOW_BLACKBOX_TARGET, 'winUnpacked');
    assert.equal(launch.env.SIMULATED_PLATFORM, platform);
  }
});

test('rejects an unknown target before starting Playwright', () => {
  assert.throws(
    () =>
      createPlaywrightLaunch({
        target: 'unknown',
        args: [],
        resolveCli: () => '/workspace/playwright-cli.js',
      }),
    /Unsupported blackbox target/,
  );
});

test('returns the child exit code without translating it', async () => {
  const child = new EventEmitter();
  const spawnProcess = () => {
    queueMicrotask(() => child.emit('exit', 7, null));
    return child;
  };
  const result = await runPlaywrightLaunch(
    {
      command: '/runtime/node',
      args: ['/workspace/playwright-cli.js'],
      cwd: '/workspace/packages/app',
      env: {},
    },
    spawnProcess,
  );
  assert.deepEqual(result, { code: 7, signal: null });
});
