import { test, expect, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const MAIN_JS = join(PROJECT_ROOT, 'out', 'main', 'main.js');
const MODE_KEY = 'plotflow:workspaceMode';
const VERSION_KEY = 'plotflow:workspaceModePreferenceVersion';
const CURRENT_VERSION = '2';

test('migrates legacy Split once, then preserves an explicit current-version Split preference', async () => {
  if (!existsSync(MAIN_JS)) {
    throw new Error(`Build output not found: ${MAIN_JS}. Run pnpm build first.`);
  }
  const userDataDir = await mkdtemp(join(tmpdir(), 'plotflow-workspace-mode-e2e-'));
  const app = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env as Record<string, string>,
      NODE_ENV: 'test',
      PLOTFLOW_TEST_USER_DATA_DIR: userDataDir,
    },
  });

  try {
    const page = await app.firstWindow();
    await page.waitForSelector('.app-shell', { timeout: 20_000 });
    await page.evaluate(({ modeKey, versionKey }) => {
      window.localStorage.setItem(modeKey, 'split');
      window.localStorage.removeItem(versionKey);
    }, { modeKey: MODE_KEY, versionKey: VERSION_KEY });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('home-surface').locator('.button--primary').first().click();

    await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
    await expect(page.getByTestId('workspace-mode-graph-lab')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((key) => window.localStorage.getItem(key), MODE_KEY)).toBe('graphLab');
    expect(await page.evaluate((key) => window.localStorage.getItem(key), VERSION_KEY)).toBe(CURRENT_VERSION);

    await page.getByTestId('workspace-mode-split').click();
    await expect(page.locator('.split-workspace')).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), MODE_KEY)).toBe('split');
    expect(await page.evaluate((key) => window.localStorage.getItem(key), VERSION_KEY)).toBe(CURRENT_VERSION);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('home-surface').locator('.button--primary').first().click();
    await expect(page.locator('.split-workspace')).toBeVisible();
    await expect(page.getByTestId('workspace-mode-split')).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await app.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
});
