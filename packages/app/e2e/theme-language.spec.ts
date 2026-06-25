import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_JS = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(`Build output not found: ${MAIN_JS}. Run pnpm build first.`);
  }

  const app = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env as Record<string, string>,
      NODE_ENV: 'test',
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  await page.evaluate(() => {
    window.localStorage.removeItem('plotflow:theme');
    window.localStorage.removeItem('plotflow:accent');
    window.localStorage.removeItem('plotflow:officialTheme');
    window.localStorage.removeItem('plotflow:themePack');
    window.localStorage.removeItem('plotflow:language');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  return { app, page };
}

async function closeElectronApp(app: ElectronApplication | undefined, page: Page | undefined): Promise<void> {
  if (!app) return;
  await page?.close({ runBeforeUnload: false }).catch(() => {});
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

test.describe('Theme and language E2E', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    const launched = await launchApp();
    app = launched.app;
    page = launched.page;
  });

  test.afterAll(async () => {
    await closeElectronApp(app, page);
  });

  test('uses official themes as the only visible appearance switch', async () => {
    await expect(page.getByTestId('toolbar-theme-center')).toBeVisible();
    await expect(page.getByRole('button', { name: /亮色|暗色|Light|Dark/i })).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.+/);

    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const nightwatchCard = page.locator('[data-official-theme-card-id="plotflow-blueprint-nightwatch"]');
    await nightwatchCard.getByTestId('theme-center-apply').click();

    await expect(page.locator('html')).toHaveAttribute('data-official-theme', 'plotflow-blueprint-nightwatch');
    await expect(page.locator('html')).toHaveAttribute('data-theme-pack', 'plotflow-blueprint-nightwatch');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.+/);

    expect(await page.evaluate(() => window.localStorage.getItem('plotflow:officialTheme'))).toBe('plotflow-blueprint-nightwatch');
    expect(await page.evaluate(() => window.localStorage.getItem('plotflow:theme'))).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem('plotflow:accent'))).toBeNull();
  });

  test('keeps language switching independent from theme selection', async () => {
    const languageSelect = page.locator('select.language-select');

    await languageSelect.selectOption('en-US');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByTestId('toolbar-export')).toContainText('Export');

    await languageSelect.selectOption('zh-CN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('html')).toHaveAttribute('data-official-theme', 'plotflow-blueprint-nightwatch');
  });

  test('migrates legacy dark preference to Blueprint Nightwatch', async () => {
    await page.evaluate(() => {
      window.localStorage.removeItem('plotflow:officialTheme');
      window.localStorage.removeItem('plotflow:themePack');
      window.localStorage.setItem('plotflow:theme', 'dark');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 20_000 });

    await expect(page.locator('html')).toHaveAttribute('data-official-theme', 'plotflow-blueprint-nightwatch');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
