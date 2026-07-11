import { test, expect, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { createHash } from 'crypto';
import { createServer, type Server } from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compositeOnBackground, contrastRatio, type RgbaColor, type RgbColor } from '../src/theme/contrast';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_JS = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');
const REMOTE_THEME_ROOT = path.join(PROJECT_ROOT, 'website', 'public', 'themes', 'plotflow-neon-dossier');
const REMOTE_THEME_ZIP = path.join(REMOTE_THEME_ROOT, 'plotflow-neon-dossier-1.0.0.pf-official-theme.zip');
const FONT_ENV_SNAPSHOTS = new Set([
  'narrative-workbench-390x844.png',
  'prism-foundry-source-open-1440x900.png',
  'engine-telemetry-source-390x844.png',
]);

function visualSnapshotName(name: string): string {
  const fontEnvironment = process.env['PLOTFLOW_VISUAL_FONT_ENV'];
  if (!fontEnvironment || !FONT_ENV_SNAPSHOTS.has(name)) return name;
  const safeEnvironment = fontEnvironment.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return name.replace(/\.png$/, `-${safeEnvironment}.png`);
}

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

interface PrismContrastPalette {
  readonly paper: RgbaColor;
  readonly reader: RgbaColor;
  readonly ink: RgbaColor;
  readonly muted: RgbaColor;
  readonly primaryText: RgbaColor;
  readonly primarySurface: RgbaColor;
  readonly warningText: RgbaColor;
  readonly dangerText: RgbaColor;
  readonly focusRing: RgbaColor;
}

function opaque(color: RgbaColor, background: RgbColor): RgbColor {
  return compositeOnBackground(color, background);
}

async function readPrismContrastPalette(page: Page): Promise<PrismContrastPalette> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable for contrast checks.');

    const readColor = (declaration: string) => {
      const probe = document.createElement('span');
      probe.style.color = declaration;
      probe.style.position = 'absolute';
      probe.style.pointerEvents = 'none';
      document.body.append(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();

      context.clearRect(0, 0, 1, 1);
      context.fillStyle = computed;
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return {
        red: data[0] ?? 0,
        green: data[1] ?? 0,
        blue: data[2] ?? 0,
        alpha: (data[3] ?? 255) / 255,
      };
    };

    return {
      paper: readColor('var(--theme-prism-paper)'),
      reader: readColor('var(--theme-prism-reader-surface)'),
      ink: readColor('var(--theme-prism-ink)'),
      muted: readColor('var(--theme-prism-muted)'),
      primaryText: readColor('var(--color-text-on-accent)'),
      primarySurface: readColor('var(--theme-prism-violet)'),
      warningText: readColor('var(--theme-prism-warning-ink)'),
      dangerText: readColor('var(--theme-prism-danger-ink)'),
      focusRing: readColor('var(--theme-prism-focus-ring)'),
    };
  });
}

async function expectCompactCommandbarActions(page: Page): Promise<void> {
  for (const testId of [
    'graph-lab-palette-toggle',
    'graph-lab-inspector-toggle',
    'graph-lab-undo',
    'graph-lab-redo',
    'graph-lab-save',
    'graph-lab-source-toggle',
  ]) {
    const action = page.getByTestId(testId);
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(
      box!.x + box!.width,
      `${testId} must remain inside the compact viewport`,
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  }
}

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
    const originalViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
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

    const graphLab = page.getByTestId('graph-lab-workspace');
    for (const viewport of [
      { name: '1280x720', width: 1280, height: 720 },
      { name: '390x844', width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.keyboard.press('Control+0');
      if (viewport.width <= 900) await expectCompactCommandbarActions(page);
      await expect(graphLab).toHaveScreenshot(visualSnapshotName(`narrative-workbench-${viewport.name}.png`), {
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    }
    await page.setViewportSize(originalViewport);
  });

  test('applies Prism Foundry with isolated preview tokens and preserves Graph Lab interactions', async ({ page: _unusedPage }, testInfo) => {
    const originalViewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const prismCard = page.locator('[data-theme-card-id="plotflow-prism-foundry"]');
    const workbenchCard = page.locator('[data-theme-card-id="plotflow-narrative-workbench"]');
    const telemetryCard = page.locator('[data-theme-card-id="plotflow-engine-telemetry"]');
    await expect(prismCard).toBeVisible({ timeout: 5_000 });

    const readPreviewTokens = async (card: Locator) =>
      card.locator('.official-theme-preview').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          paper: style.getPropertyValue('--theme-graph-lab-paper').trim(),
          ink: style.getPropertyValue('--theme-node-ink').trim(),
          cable: style.getPropertyValue('--theme-graph-cable-default').trim(),
        };
      });

    const [prismPreviewTokens, workbenchPreviewTokens, telemetryPreviewTokens] = await Promise.all([
      readPreviewTokens(prismCard),
      readPreviewTokens(workbenchCard),
      readPreviewTokens(telemetryCard),
    ]);
    expect(prismPreviewTokens).toEqual({
      paper: expect.any(String),
      ink: expect.any(String),
      cable: expect.any(String),
    });
    expect(prismPreviewTokens.paper).toBeTruthy();
    expect(prismPreviewTokens.ink).toBeTruthy();
    expect(prismPreviewTokens.cable).toBeTruthy();
    expect(prismPreviewTokens.paper).not.toBe(workbenchPreviewTokens.paper);
    expect(prismPreviewTokens.paper).not.toBe(telemetryPreviewTokens.paper);
    expect(prismPreviewTokens.ink).not.toBe(workbenchPreviewTokens.ink);
    expect(prismPreviewTokens.ink).not.toBe(telemetryPreviewTokens.ink);

    await prismCard.getByTestId('theme-center-apply').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-prism-foundry');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(prismCard).toHaveClass(/is-active/);

    const palette = await readPrismContrastPalette(page);
    const paper = opaque(palette.paper, { red: 255, green: 255, blue: 255 });
    const reader = opaque(palette.reader, paper);
    expect(contrastRatio(opaque(palette.ink, reader), reader)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(opaque(palette.muted, reader), reader)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(opaque(palette.primaryText, opaque(palette.primarySurface, reader)), opaque(palette.primarySurface, reader))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(opaque(palette.warningText, reader), reader)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(opaque(palette.dangerText, reader), reader)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(opaque(palette.focusRing, reader), reader)).toBeGreaterThanOrEqual(3);

    await page.getByTestId('theme-center').locator('.theme-center__footer .button').click();

    const graphLab = page.locator('[data-theme-surface="prism-foundry-graph-lab-shell"]');
    await expect(graphLab).toBeVisible();
    await expect(graphLab).toHaveClass(/prism-foundry-graph-lab/);
    await expect(page.getByText('Graph Lab · 棱镜铸造台')).toBeVisible();
    await expect(graphLab.locator(':scope > .graph-lab__commandbar')).toBeVisible();
    await expect(graphLab.locator(':scope > .graph-lab-rail')).toBeVisible();
    await expect(graphLab.locator(':scope > .graph-lab__canvas')).toBeVisible();
    await expect(graphLab.locator(':scope > .graph-lab-inspector')).toBeVisible();
    await expect(graphLab.locator(':scope > .source-drawer')).toBeVisible();

    const prismNodes = page.getByTestId('prism-foundry-story-node');
    const prismNode = prismNodes.first();
    const prismEdge = page.getByTestId('prism-foundry-story-edge').first();
    await expect(prismNode).toBeVisible();
    await expect(prismEdge).toBeVisible();
    await expect(prismNode).toHaveClass(/official-graph-node--prism-foundry/);
    await expect(prismEdge).toHaveClass(/official-graph-edge--prism-foundry/);
    await expect(prismNode).toHaveAttribute('data-official-node-theme', 'plotflow-prism-foundry');
    await expect(prismEdge).toHaveAttribute('data-official-edge-theme', 'plotflow-prism-foundry');
    await expect(prismNodes.getByTestId('story-node-option-handle-0').first()).toHaveAttribute('data-handleid', 'option-0');
    await expect(prismNodes.getByTestId('story-node-default-next-handle').first()).toHaveAttribute('data-handleid', 'next');

    await prismNode.click();
    await expect(page.getByTestId('graph-inspector-node-title')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('F2');
    const renameInput = prismNode.locator('.story-node-rename-input');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();
    await expect(renameInput).toHaveAttribute('aria-label', /编辑节点标题/);
    await renameInput.fill('键盘棱镜入口');
    await page.keyboard.press('Enter');
    await expect(prismNode.locator('h3')).toHaveText('键盘棱镜入口');

    await page.keyboard.press('F2');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(renameInput).toBeHidden();
    await prismEdge.locator('.official-graph-edge__hit-area').dispatchEvent('mouseover');
    await expect(prismEdge).toHaveClass(/is-hovered/);
    await prismEdge.locator('.official-graph-edge__hit-area').dispatchEvent('mouseout');
    await expect(prismEdge).not.toHaveClass(/is-hovered/);
    expect(await prismEdge.locator('.official-graph-edge__path').evaluate((element) => ({
      filter: getComputedStyle(element).filter,
      backdropFilter: getComputedStyle(element).backdropFilter,
    }))).toEqual({ filter: 'none', backdropFilter: 'none' });

    const defaultWorkspaceShot = await graphLab.screenshot();
    expect(defaultWorkspaceShot.length).toBeGreaterThan(5_000);
    fs.writeFileSync(testInfo.outputPath('prism-foundry-graph-lab-default.png'), defaultWorkspaceShot);
    await testInfo.attach('prism-foundry-graph-lab-default.png', {
      body: defaultWorkspaceShot,
      contentType: 'image/png',
    });

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-slice')).toBeVisible({ timeout: 10_000 });

    const workspaceShot = await graphLab.screenshot();
    expect(workspaceShot.length).toBeGreaterThan(5_000);
    await expect(graphLab).toHaveScreenshot(visualSnapshotName('prism-foundry-source-open-1440x900.png'), {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
    fs.writeFileSync(testInfo.outputPath('prism-foundry-graph-lab-shell.png'), workspaceShot);
    await testInfo.attach('prism-foundry-graph-lab-shell.png', {
      body: workspaceShot,
      contentType: 'image/png',
    });

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-slice')).toBeHidden();

    await page.getByTestId('graph-lab-diagnostics-button').click();
    await expect(page.getByTestId('problem-panel')).toHaveClass(/is-open/);
    await expect(page.locator('.app-shell')).toHaveScreenshot('prism-foundry-diagnostics-1440x900.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
    await page.locator('.problem-panel__close').click();
    await expect(page.getByTestId('problem-panel')).not.toHaveClass(/is-open/);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(() => prismNode.evaluate((element) => getComputedStyle(element).transitionDuration))
      .toBe('0s');
    const targetPort = prismNode.locator('.official-node-port--target').first();
    await expect
      .poll(() => targetPort.evaluate((element) => getComputedStyle(element, '::after').transitionDuration))
      .toBe('0s');
    const canvasRuntime = page.locator('.graph-canvas-runtime');
    await canvasRuntime.evaluate((element) => element.classList.add('graph-canvas-runtime--wire-dragging'));
    await expect
      .poll(() => targetPort.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return { x: matrix.a, y: matrix.d };
      }))
      .toEqual({ x: 1, y: 1 });
    await canvasRuntime.evaluate((element) => element.classList.remove('graph-canvas-runtime--wire-dragging'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    for (const viewport of [
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1280x720', width: 1280, height: 720 },
      { name: '390x844', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.keyboard.press('Control+0');
      await page.waitForTimeout(240);
      await expect(graphLab).toBeVisible();
      await expect(graphLab.locator(':scope > .graph-lab__commandbar')).toBeVisible();
      await expect(graphLab.locator(':scope > .graph-lab__canvas')).toBeVisible();
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.body.scrollWidth <= window.innerWidth
      ))).toBe(true);
      if (viewport.width <= 900) await expectCompactCommandbarActions(page);

      const viewportShot = await graphLab.screenshot();
      expect(viewportShot.length).toBeGreaterThan(5_000);
      const filename = `prism-foundry-${viewport.name}.png`;
      await expect(graphLab).toHaveScreenshot(filename, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
      fs.writeFileSync(testInfo.outputPath(filename), viewportShot);
      await testInfo.attach(filename, { body: viewportShot, contentType: 'image/png' });
    }

    await page.setViewportSize(originalViewport);
  });

  test('applies engine telemetry theme from Theme Center and verifies Graph Lab shell', async ({ page: _unusedPage }, testInfo) => {
    const originalViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toBeVisible();

    const telemetryCard = page.locator('[data-theme-card-id="plotflow-engine-telemetry"]');
    await expect(telemetryCard).toBeVisible({ timeout: 5_000 });
    const enginePreviewTokens = await telemetryCard.locator('.official-theme-preview').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        paper: style.getPropertyValue('--theme-graph-lab-paper').trim(),
        ink: style.getPropertyValue('--theme-node-ink').trim(),
      };
    });
    expect(enginePreviewTokens.paper).toContain('17.2%');
    expect(enginePreviewTokens.paper).not.toContain('96.5%');
    expect(enginePreviewTokens.ink).toContain('89%');

    await telemetryCard.getByTestId('theme-center-apply').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-engine-telemetry');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('theme-center')).toHaveAttribute('data-theme-surface', 'engine-telemetry-theme-center-surface');
    const workbenchPreviewTokens = await page
      .locator('[data-theme-card-id="plotflow-narrative-workbench"] .official-theme-preview')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          paper: style.getPropertyValue('--theme-graph-lab-paper').trim(),
          ink: style.getPropertyValue('--theme-node-ink').trim(),
        };
      });
    expect(workbenchPreviewTokens.paper).toContain('96.5%');
    expect(workbenchPreviewTokens.paper).not.toContain('17.2%');
    expect(workbenchPreviewTokens.ink).toContain('22%');

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

    const graphLab = page.getByTestId('graph-lab-workspace');
    for (const viewport of [
      { name: '1280x720', width: 1280, height: 720 },
      { name: '390x844', width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.keyboard.press('Control+0');
      if (viewport.width <= 900) await expectCompactCommandbarActions(page);
      await expect(graphLab).toHaveScreenshot(visualSnapshotName(`engine-telemetry-source-${viewport.name}.png`), {
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    }
    await page.setViewportSize(originalViewport);
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
