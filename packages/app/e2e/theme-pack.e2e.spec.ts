import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { createHash } from 'crypto';
import { createServer, type Server } from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_JS = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');
const REMOTE_THEME_ROOT = path.join(PROJECT_ROOT, 'website', 'public', 'themes', 'plotflow-neon-dossier');
const REMOTE_THEME_ZIP = path.join(REMOTE_THEME_ROOT, 'plotflow-neon-dossier-1.0.0.pf-official-theme.zip');

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

async function startOfficialThemeServer(): Promise<{ server: Server; registryUrl: string }> {
  const bundleBytes = fs.readFileSync(REMOTE_THEME_ZIP);
  const sha256 = createHash('sha256').update(bundleBytes).digest('hex');

  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    if (url === '/data/official-themes.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        themes: [
          {
            id: 'plotflow-neon-dossier',
            name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
            version: '1.0.0',
            channel: 'stable',
            priceLabel: '免费主题',
            manifestUrl: 'http://127.0.0.1:0/themes/plotflow-neon-dossier/manifest.json',
            bundleUrl: 'http://127.0.0.1:0/themes/plotflow-neon-dossier/plotflow-neon-dossier-1.0.0.pf-official-theme.zip',
            sha256,
            minAppVersion: '0.1.0',
            themeApiVersion: 1,
            previewUrl: 'http://127.0.0.1:0/themes/plotflow-neon-dossier/assets/preview.svg',
            changelog: '官方远程 ZIP 代码主题 E2E fixture。',
          },
        ],
      }).replaceAll('127.0.0.1:0', request.headers.host ?? '127.0.0.1'));
      return;
    }
    if (url === '/themes/plotflow-neon-dossier/plotflow-neon-dossier-1.0.0.pf-official-theme.zip') {
      response.writeHead(200, { 'content-type': 'application/zip' });
      response.end(bundleBytes);
      return;
    }
    if (url === '/themes/plotflow-neon-dossier/manifest.json') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(fs.readFileSync(path.join(REMOTE_THEME_ROOT, 'manifest.json')));
      return;
    }
    if (url === '/themes/plotflow-neon-dossier/assets/preview.svg') {
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' });
      response.end(fs.readFileSync(path.join(REMOTE_THEME_ROOT, 'assets', 'preview.svg')));
      return;
    }
    response.writeHead(404);
    response.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('无法启动官方主题测试服务器');
  }
  return {
    server,
    registryUrl: `http://127.0.0.1:${address.port}/data/official-themes.json`,
  };
}

async function launchApp(env: Record<string, string> = {}): Promise<{ app: ElectronApplication; page: Page }> {
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(`构建产物未找到: ${MAIN_JS}。请先执行 pnpm build。`);
  }

  const app = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env as Record<string, string>,
      NODE_ENV: 'test',
      ...env,
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
  let server: Server;
  let testUserDataDir: string;

  test.beforeAll(async () => {
    const officialThemeServer = await startOfficialThemeServer();
    server = officialThemeServer.server;
    testUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plotflow-theme-e2e-'));
    const launched = await launchApp({
      PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL: officialThemeServer.registryUrl,
      PLOTFLOW_TEST_USER_DATA_DIR: testUserDataDir,
    });
    app = launched.app;
    page = launched.page;
    await page.evaluate(() => {
      window.localStorage.removeItem('plotflow:themeId');
    });
    await loadStory(page);
  });

  test.afterAll(async () => {
    await closeElectronApp(app, page);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (testUserDataDir) {
      fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
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

    await page.getByTestId('theme-center').getByRole('button', { name: '完成' }).click();
  });

  test('applies engine telemetry theme from Theme Center and verifies Graph Lab shell', async ({ page: _unusedPage }, testInfo) => {
    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const telemetryCard = page.locator('[data-theme-card-id="plotflow-engine-telemetry"]');
    await expect(telemetryCard).toBeVisible({ timeout: 5_000 });
    await telemetryCard.getByTestId('theme-center-apply').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-engine-telemetry');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('theme-center')).toHaveAttribute('data-theme-surface', 'engine-telemetry-theme-center-surface');

    await page.getByTestId('theme-center').locator('.theme-center__footer .button').click();

    await expect(page.locator('[data-theme-surface="engine-telemetry-graph-lab-shell"]')).toBeVisible();
    await expect(page.locator('.graph-lab-rail')).toBeVisible();
    await expect(page.locator('.graph-lab__canvas')).toBeVisible();
    await expect(page.locator('.graph-lab-inspector')).toBeVisible();
    await expect(page.locator('[data-official-node-theme="plotflow-engine-telemetry"]').first()).toBeVisible();
    await expect(page.locator('[data-official-node-variant="engine-telemetry"]').first()).toBeVisible();
    await expect(page.locator('.official-graph-node--engine-telemetry').first()).toBeVisible();
    await expect(page.locator('[data-official-edge-theme="plotflow-engine-telemetry"]')).toHaveCount(1);

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-slice')).toBeVisible({ timeout: 10_000 });
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector('.graph-lab-rail')?.getBoundingClientRect();
      const canvas = document.querySelector('.graph-lab__canvas')?.getBoundingClientRect();
      const inspector = document.querySelector('.graph-lab-inspector')?.getBoundingClientRect();
      const drawer = document.querySelector('[data-testid="graph-lab-source-drawer"]')?.getBoundingClientRect();
      const textarea = document.querySelector('[data-testid="graph-lab-chapter-source-slice"]')?.getBoundingClientRect();
      if (!rail || !canvas || !inspector || !drawer || !textarea) return null;
      const centerElement = document.elementFromPoint(textarea.left + textarea.width / 2, textarea.top + textarea.height / 2);
      return {
        rail: { x: rail.x, y: rail.y, width: rail.width, height: rail.height },
        canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
        inspector: { x: inspector.x, y: inspector.y, width: inspector.width, height: inspector.height },
        drawer: { x: drawer.x, y: drawer.y, width: drawer.width, height: drawer.height },
        textarea: { x: textarea.x, y: textarea.y, width: textarea.width, height: textarea.height },
        centerInDrawer: Boolean(centerElement?.closest('[data-testid="graph-lab-source-drawer"]')),
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry!.drawer.x).toBeGreaterThanOrEqual(geometry!.rail.x + geometry!.rail.width - 1);
    expect(geometry!.drawer.y).toBeGreaterThanOrEqual(geometry!.canvas.y + geometry!.canvas.height - 1);
    expect(geometry!.drawer.y).toBeGreaterThanOrEqual(geometry!.inspector.y + geometry!.inspector.height - 1);
    expect(geometry!.drawer.width).toBeGreaterThan(geometry!.canvas.width * 0.7);
    expect(geometry!.textarea.width).toBeGreaterThan(240);
    expect(geometry!.textarea.height).toBeGreaterThan(120);
    expect(geometry!.centerInDrawer).toBe(true);

    const workspaceShot = await page.getByTestId('graph-lab-workspace').screenshot();
    expect(workspaceShot.length).toBeGreaterThan(5_000);
    fs.writeFileSync(testInfo.outputPath('engine-telemetry-graph-lab-shell.png'), workspaceShot);
    await testInfo.attach('engine-telemetry-graph-lab-shell.png', {
      body: workspaceShot,
      contentType: 'image/png',
    });
  });

  test('downloads and applies an official remote code theme package', async () => {
    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const remoteCard = page.getByTestId('official-remote-theme-card').filter({ hasText: '霓虹档案' });
    await expect(remoteCard).toBeVisible({ timeout: 10_000 });
    await expect(remoteCard.getByText('免费主题')).toBeVisible();

    await remoteCard.getByTestId('theme-center-remote-action').click();
    const installedRemoteCard = page.locator('.official-theme-card').filter({ hasText: '远程代码包' });
    await expect(installedRemoteCard).toBeVisible({ timeout: 20_000 });

    await expect(remoteCard.getByTestId('theme-center-remote-action')).toContainText('启用', { timeout: 20_000 });
    await remoteCard.getByTestId('theme-center-remote-action').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-neon-dossier', { timeout: 20_000 });
    await expect(page.locator('[data-theme-surface="neon-dossier-graph-lab-shell"]')).toBeVisible();
    await expect(page.locator('[data-remote-slot="neon-dossier-node"]').first()).toBeVisible();
    await expect(page.locator('[data-remote-slot="neon-dossier-edge"]').first()).toBeVisible();
  });
});
