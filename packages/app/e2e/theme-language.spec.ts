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
    window.localStorage.removeItem('plotflow:themeId');
    window.localStorage.removeItem('plotflow:language');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  await dismissHomeIfVisible(page);
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

async function dismissHomeIfVisible(page: Page): Promise<void> {
  const home = page.getByTestId('home-surface');
  await home.waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
  if (!(await home.isVisible().catch(() => false))) return;
  const graphLabCard = home.getByTestId('home-open-graph-lab');
  if (await graphLabCard.isVisible().catch(() => false)) {
    await graphLabCard.click();
  } else {
    await home.locator('.button--primary').first().click();
  }
  await home.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
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

  test('enables workbench, then resets to Prism Foundry and verifies persistence', async () => {
    await expect(page.getByTestId('toolbar-theme-center')).toBeVisible();
    await expect(page.getByRole('button', { name: /亮色|暗色|Light|Dark/i })).toHaveCount(0);

    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const workbenchCard = page.locator('.official-theme-card').filter({ hasText: '叙事工作台' });
    const prismCard = page.locator('[data-theme-card-id="plotflow-prism-foundry"]');
    await expect(workbenchCard).toBeVisible({ timeout: 5_000 });
    await expect(prismCard.getByTestId('theme-center-apply')).toBeDisabled();
    await expect(workbenchCard.getByTestId('theme-center-apply')).toBeEnabled();
    await workbenchCard.getByTestId('theme-center-apply').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-narrative-workbench');
    expect(await page.evaluate(() => window.localStorage.getItem('plotflow:themeId'))).toBe('plotflow-narrative-workbench');

    await page.getByTestId('theme-center-reset').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-prism-foundry');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(await page.evaluate(() => window.localStorage.getItem('plotflow:themeId'))).toBe('plotflow-prism-foundry');
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
    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-prism-foundry');
  });

  test('migrates legacy dark preference to Prism Foundry', async () => {
    await page.evaluate(() => {
      window.localStorage.removeItem('plotflow:themeId');
      window.localStorage.removeItem('plotflow:officialTheme');
      window.localStorage.removeItem('plotflow:themePack');
      window.localStorage.setItem('plotflow:theme', 'dark');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-shell', { timeout: 20_000 });

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-prism-foundry');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
