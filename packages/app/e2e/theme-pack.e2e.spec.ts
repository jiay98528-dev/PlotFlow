import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_JS = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');

const THEME_STORY = `---
plotflow: 0.1
title: Official Theme E2E
author: QA
---

# 第一章
## 节点：起点
你站在蓝图工作台前。

[选项] 查看四周 -> 节点：树林

## 节点：树林
线缆通向另一个叙事节点。
`;

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(`构建产物未找到: ${MAIN_JS}。请先执行 pnpm build。`);
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
  return { app, page };
}

async function loadStory(page: Page): Promise<void> {
  await page.evaluate((content) => {
    window.__test_store__?.setEditorContent(content);
    window.__test_store__?.setWorkspaceMode('graphLab');
    window.__test_store__?.setTheme('plotflow-narrative-workbench');
    window.__test_store__?.setHomeSurfaceOpen(false);
  }, THEME_STORY);
  await expect(page.getByTestId('graph-lab-workspace')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.react-flow__node').filter({ hasText: '起点' })).toBeVisible({ timeout: 20_000 });
}

async function closeElectronApp(app: ElectronApplication | undefined, page: Page | undefined): Promise<void> {
  if (!app) return;

  await page?.close({ runBeforeUnload: false }).catch(() => {});

  const closeResult = await Promise.race([
    app.close().then(() => 'closed' as const).catch(() => 'closed' as const),
    new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), 5_000);
    }),
  ]);

  if (closeResult === 'timeout') {
    await app.evaluate(({ app: electronApp }) => {
      electronApp.exit(0);
    }).catch(() => {});
  }
}

test.describe('Official Theme Center E2E', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    const launched = await launchApp();
    app = launched.app;
    page = launched.page;
    await page.evaluate(() => {
      window.localStorage.removeItem('plotflow:themeId');
    });
    await loadStory(page);
  });

  test.afterAll(async () => {
    await closeElectronApp(app, page);
  });

  test('opens Home and Theme Center without exposing local theme import', async () => {
    await page.getByTestId('toolbar-home').click();
    await expect(page.getByTestId('home-surface')).toBeVisible();
    await page.getByTestId('home-open-theme-center').click();

    const themeCenter = page.getByTestId('theme-center');
    await expect(themeCenter).toBeVisible();
    await expect(themeCenter.getByText('官方主题中心')).toBeVisible();
    await expect(themeCenter.getByRole('heading', { name: '叙事工作台' })).toBeVisible();
    await expect(themeCenter.getByText('浏览官方免费主题')).toBeVisible();
    await expect(page.getByText('导入主题包')).toHaveCount(0);
    await expect(page.getByText('.pf-theme')).toHaveCount(0);

    await themeCenter.getByRole('button', { name: '完成' }).click();
    await page.evaluate(() => window.__test_store__?.setHomeSurfaceOpen(false));
  });

  test('applies narrative workbench theme and verifies node/edge renderers', async () => {
    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const workbenchCard = page.locator('.official-theme-card').filter({ hasText: '叙事工作台' });
    await expect(workbenchCard).toBeVisible({ timeout: 5_000 });
    await expect(workbenchCard.getByTestId('theme-center-apply')).toBeDisabled();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-narrative-workbench');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('[data-official-node-theme="plotflow-narrative-workbench"]').first()).toBeVisible();
    await expect(page.locator('[data-official-node-variant="workbench"]').first()).toBeVisible();
    await expect(page.locator('.official-graph-node--workbench').first()).toBeVisible();
    await expect(page.locator('[data-official-edge-theme="plotflow-narrative-workbench"]')).toHaveCount(1);

    const paperColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--theme-graph-lab-paper').trim(),
    );
    expect(paperColor).toContain('oklch');
  });
});
