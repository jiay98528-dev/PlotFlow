import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import type { TestInfo } from '@playwright/test';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_SCRIPT = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');
const IPC_EXPORT_CHANNEL = 'file:export';

const START_STORY = `---
plotflow: 0.1
title: Graph Lab E2E
author: QA
vars:
  金币: int
---

# 第一章

## 节点：起点

你醒来。

[选项] 查看四周
`;

const TWO_CHAPTER_STORY = `${START_STORY}

# 第二章

## 节点：终点

第二章正文。
`;

interface CapturedExport {
  content: string;
  format: string;
  timestamp: number;
}

type CaptureGlobal = typeof globalThis & { __e2e_capture?: CapturedExport | null };

interface MockWorkspace {
  readonly rootPath: string;
  readonly filePath: string;
  readonly relativePath: string;
  readonly content: string;
}

interface TestStoreBridge {
  getEditorContent: () => string;
  getDiagnostics: () => ReadonlyArray<{ readonly code: string }>;
  getGraphNodes: () => ReadonlyArray<{
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
  }>;
  setEditorContent: (content: string) => void;
  setEditorContentPreservingUI: (content: string) => void;
  setWorkspaceMode: (mode: 'split' | 'graphLab') => void;
  setTheme: (themeId: string) => void;
  setHomeSurfaceOpen: (open: boolean) => void;
  openThemeCenter: () => void;
  selectNode: (nodeId: string) => void;
  getUIState: () => {
    readonly workspaceMode: 'split' | 'graphLab';
    readonly isSourceDrawerOpen: boolean;
  };
}

type TestWindow = Window & { __test_store__?: TestStoreBridge };

function isIgnorableTeardownError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /closed|destroyed|crashed|Target page|browser has been closed|Process exited/i.test(message);
}

async function closeElectronAppSafely(app: ElectronApplication | undefined, page: Page | undefined): Promise<void> {
  if (!app) return;
  if (page && !page.isClosed()) {
    await page.close({ runBeforeUnload: false }).catch((error: unknown) => {
      if (!isIgnorableTeardownError(error)) throw error;
    });
  }

  try {
    await app.close();
  } catch (error) {
    if (isIgnorableTeardownError(error)) return;
    await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.removeAllListeners('close');
          win.destroy();
        }
      }
      electronApp.exit(0);
    }).catch((fallbackError: unknown) => {
      if (!isIgnorableTeardownError(fallbackError)) throw fallbackError;
    });
  }
}

async function mockExportIpcHandler(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }, channel: string) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (_event, payload) => {
      const ext = payload.filters?.[0]?.extensions?.[0] ?? 'txt';
      (globalThis as CaptureGlobal).__e2e_capture = {
        content: String(payload.content ?? ''),
        format: payload.filters?.[0]?.name ?? ext,
        timestamp: Date.now(),
      };
      return { filePath: `/e2e-mock/graph-lab.${ext}` };
    });
  }, IPC_EXPORT_CHANNEL);
}

async function mockWorkspaceIpcHandler(app: ElectronApplication, workspace: MockWorkspace): Promise<void> {
  await app.evaluate(
    ({ ipcMain }, mock: MockWorkspace) => {
      const workspaceResult = {
        rootPath: mock.rootPath,
        truncated: false,
        files: [
          {
            filePath: mock.filePath,
            relativePath: mock.relativePath,
            name: mock.relativePath.split(/[\\/]/).pop() ?? mock.relativePath,
            size: mock.content.length,
            modifiedAt: Date.now(),
          },
        ],
      };

      ipcMain.removeHandler('file:chooseWorkspaceFolder');
      ipcMain.handle('file:chooseWorkspaceFolder', async () => workspaceResult);

      ipcMain.removeHandler('file:listWorkspaceStories');
      ipcMain.handle('file:listWorkspaceStories', async () => workspaceResult);

      (globalThis as typeof globalThis & { __plotflowWorkspaceReadCount?: number }).__plotflowWorkspaceReadCount = 0;
      ipcMain.removeHandler('file:readWorkspaceStory');
      ipcMain.handle('file:readWorkspaceStory', async (_event, payload: { rootPath: string; filePath: string }) => {
        (globalThis as typeof globalThis & { __plotflowWorkspaceReadCount?: number }).__plotflowWorkspaceReadCount =
          ((globalThis as typeof globalThis & { __plotflowWorkspaceReadCount?: number }).__plotflowWorkspaceReadCount ?? 0) + 1;
        if (payload.rootPath !== mock.rootPath || payload.filePath !== mock.filePath) return null;
        return { filePath: mock.filePath, content: mock.content, hash: 'workspace-hash', modifiedAt: Date.now() };
      });

      ipcMain.removeHandler('dialog:confirm');
      ipcMain.handle('dialog:confirm', async () => 1);
    },
    workspace,
  );
}

async function mockDelayedSaveAsIpcHandler(app: ElectronApplication, delayMs: number): Promise<void> {
  await app.evaluate(({ ipcMain }, delay: number) => {
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        filePath: 'D:\\PlotFlowE2E\\save-feedback.mdstory',
        content: '',
        hash: 'save-as-hash',
        modifiedAt: Date.now(),
      };
    });
  }, delayMs);
}

async function resetDefaultDialogAndSaveAsIpcHandlers(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('dialog:confirm');
    ipcMain.handle('dialog:confirm', async () => 1);
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async () => ({ filePath: 'D:\\PlotFlowE2E\\default-save-as.mdstory' }));
  });
}

async function mockCountingSaveAsIpcHandler(app: ElectronApplication, delayMs: number): Promise<void> {
  await app.evaluate(({ ipcMain }, delay: number) => {
    (globalThis as typeof globalThis & { __plotflowSaveAsCount?: number }).__plotflowSaveAsCount = 0;
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async () => {
      (globalThis as typeof globalThis & { __plotflowSaveAsCount?: number }).__plotflowSaveAsCount =
        ((globalThis as typeof globalThis & { __plotflowSaveAsCount?: number }).__plotflowSaveAsCount ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return { filePath: 'D:\\PlotFlowE2E\\save-feedback.mdstory' };
    });
  }, delayMs);
}

async function readSaveAsCallCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(() =>
    (globalThis as typeof globalThis & { __plotflowSaveAsCount?: number }).__plotflowSaveAsCount ?? 0,
  );
}

async function mockFailingSaveAsIpcHandler(app: ElectronApplication, message: string): Promise<void> {
  await app.evaluate(({ ipcMain }, errorMessage: string) => {
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async () => {
      throw new Error(errorMessage);
    });
  }, message);
}

async function mockSaveThenOpenCancelFlow(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    (globalThis as typeof globalThis & { __plotflowOpenFileCount?: number }).__plotflowOpenFileCount = 0;
    ipcMain.removeHandler('dialog:confirm');
    ipcMain.handle('dialog:confirm', async () => 0);
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async () => null);
    ipcMain.removeHandler('file:open');
    ipcMain.handle('file:open', async () => {
      (globalThis as typeof globalThis & { __plotflowOpenFileCount?: number }).__plotflowOpenFileCount =
        ((globalThis as typeof globalThis & { __plotflowOpenFileCount?: number }).__plotflowOpenFileCount ?? 0) + 1;
      return {
        filePath: 'D:\\PlotFlowE2E\\should-not-open.mdstory',
        content: '# 故事：Should Not Replace\n\n## 节点：替换\n\n不应出现。',
      };
    });
  });
}

async function readOpenFileCallCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(() =>
    (globalThis as typeof globalThis & { __plotflowOpenFileCount?: number }).__plotflowOpenFileCount ?? 0,
  );
}

async function readWorkspaceStoryCallCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(() =>
    (globalThis as typeof globalThis & { __plotflowWorkspaceReadCount?: number }).__plotflowWorkspaceReadCount ?? 0,
  );
}

async function mockCloseDialogResponse(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, nextResponse: number) => {
    (globalThis as typeof globalThis & { __plotflowCloseResponse?: number }).__plotflowCloseResponse = nextResponse;
    dialog.showMessageBox = async () => ({
      response: (globalThis as typeof globalThis & { __plotflowCloseResponse?: number }).__plotflowCloseResponse ?? 2,
      checkboxChecked: false,
    });
  }, response);
}

async function requestMainWindowClose(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.isDestroyed()) throw new Error('No BrowserWindow available');
    win.close();
  });
}

async function sendMenuEvent(app: ElectronApplication, channel: string): Promise<void> {
  await app.evaluate(({ BrowserWindow }, eventChannel: string) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win || win.isDestroyed()) throw new Error('No BrowserWindow available');
    win.webContents.send(eventChannel);
  }, channel);
}

async function readCapturedExport(app: ElectronApplication): Promise<CapturedExport | null> {
  return app.evaluate(() => {
    const cap = (globalThis as CaptureGlobal).__e2e_capture;
    (globalThis as CaptureGlobal).__e2e_capture = null;
    return cap ?? null;
  });
}

async function setEditorContent(page: Page, content: string): Promise<void> {
  await page.evaluate((text: string) => {
    const store = (window as TestWindow).__test_store__;
    if (!store?.setEditorContent) throw new Error('__test_store__.setEditorContent unavailable');
    store.setEditorContent(text);
  }, content);

  await page.waitForFunction(
    (text: string) => (window as TestWindow).__test_store__?.getEditorContent?.() === text,
    content,
    { timeout: 10_000 },
  );
}

async function setEditorContentPreservingUI(page: Page, content: string): Promise<void> {
  await page.evaluate((text: string) => {
    const store = (window as TestWindow).__test_store__;
    if (!store?.setEditorContentPreservingUI) throw new Error('__test_store__.setEditorContentPreservingUI unavailable');
    store.setEditorContentPreservingUI(text);
  }, content);

  await page.waitForFunction(
    (text: string) => (window as TestWindow).__test_store__?.getEditorContent?.() === text,
    content,
    { timeout: 10_000 },
  );
}

async function switchToGraphLab(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as TestWindow).__test_store__;
    if (!store?.setWorkspaceMode) throw new Error('__test_store__.setWorkspaceMode unavailable');
    store.setWorkspaceMode('graphLab');
  });
  await page.waitForSelector('[data-testid="graph-lab-workspace"]', { timeout: 10_000 });
  await page.waitForFunction(
    () => (window as TestWindow).__test_store__?.getUIState?.().workspaceMode === 'graphLab',
    { timeout: 10_000 },
  );
  await waitForGraphSettled(page);
}

async function selectChapterTab(page: Page, index: number): Promise<void> {
  const tabs = page.getByTestId('graph-lab-chapter-tab');
  await expect(tabs.nth(index)).toBeVisible({ timeout: 10_000 });
  await tabs.nth(index).click();
  await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
}

async function switchToSplit(page: Page): Promise<void> {
  await page.getByTestId('workspace-mode-split').click();
  await page.waitForFunction(
    () => (window as TestWindow).__test_store__?.getUIState?.().workspaceMode === 'split',
    { timeout: 10_000 },
  );
  await page.waitForSelector('.split-workspace', { timeout: 10_000 });
}

async function reloadRenderer(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  await page.waitForFunction(
    () => Boolean((window as TestWindow).__test_store__),
    { timeout: 20_000 },
  );
}

async function waitForContent(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(
    (text: string) => (window as TestWindow).__test_store__?.getEditorContent?.().includes(text) ?? false,
    expected,
    { timeout: 10_000 },
  );
}

async function waitForGraphSettled(page: Page): Promise<void> {
  const node = page.locator('.react-flow__node').first();
  await expect(node).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < 8; i++) {
    const before = await node.boundingBox();
    await page.waitForTimeout(100);
    const movedNode = page.locator('.react-flow__node').first();
    await expect(movedNode).toBeVisible({ timeout: 10_000 });
    const after = await movedNode.boundingBox();
    if (!before || !after) continue;

    const delta =
      Math.abs(before.x - after.x) +
      Math.abs(before.y - after.y) +
      Math.abs(before.width - after.width) +
      Math.abs(before.height - after.height);
    if (delta < 1) return;
  }
}

async function attachVisibleScreenshot(
  testInfo: TestInfo,
  locator: ReturnType<Page['locator']>,
  name: string,
): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 10_000 });
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(120);
  expect(box!.height).toBeGreaterThan(20);
  const screenshot = await locator.screenshot();
  expect(screenshot.length).toBeGreaterThan(500);
  fs.writeFileSync(testInfo.outputPath(name), screenshot);
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

async function getEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as TestWindow).__test_store__;
    if (!store?.getEditorContent) throw new Error('__test_store__.getEditorContent unavailable');
    return store.getEditorContent();
  });
}

async function waitForNoDiagnostic(page: Page, code: string): Promise<void> {
  await page.waitForFunction(
    (diagnosticCode: string) =>
      !((window as TestWindow).__test_store__?.getDiagnostics?.() ?? [])
        .some((diagnostic) => diagnostic.code === diagnosticCode),
    code,
    { timeout: 10_000 },
  );
}

async function expectHomeSurfaceHasNoOverlap(page: Page): Promise<void> {
  const overlaps = await page.evaluate(() => {
    const selectors = [
      ['title', '.home-surface__copy h2'],
      ['body', '.home-surface__copy > p:not(.home-surface__eyebrow)'],
      ['actions', '.home-surface__actions'],
      ['preview', '.home-surface__preview'],
      ['cards', '.home-surface__grid'],
      ['status', '.home-surface__status'],
    ] as const;

    const rects = selectors
      .map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          name,
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> =>
        Boolean(entry && entry.rect.width > 1 && entry.rect.height > 1),
      );

    const pairs: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const horizontal = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const vertical = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (horizontal > 2 && vertical > 2) {
          pairs.push(`${a.name}/${b.name}`);
        }
      }
    }
    return pairs;
  });

  expect(overlaps).toEqual([]);
}

async function dragFromTo(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function dragLocatorTo(
  page: Page,
  locator: ReturnType<Page['locator']>,
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('locator has no bounding box');
  await dragFromTo(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, to);
}

async function nodeCenter(page: Page, title: string): Promise<{ x: number; y: number }> {
  const node = page.locator('.react-flow__node').filter({ hasText: title }).first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  const box = await node.boundingBox();
  if (!box) throw new Error(`node has no bounding box: ${title}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function nodeBodyPoint(page: Page, title: string): Promise<{ x: number; y: number }> {
  const node = page.locator('.react-flow__node').filter({ hasText: title }).first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  const box = await node.boundingBox();
  if (!box) throw new Error(`node has no bounding box: ${title}`);
  return { x: box.x + box.width / 2, y: box.y + Math.min(40, box.height * 0.35) };
}

async function nodeDragPoint(page: Page, title: string): Promise<{ x: number; y: number }> {
  const node = page.locator('.react-flow__node').filter({ hasText: title }).first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  const box = await node.boundingBox();
  if (!box) throw new Error(`node has no bounding box: ${title}`);
  return { x: box.x + Math.min(28, box.width * 0.2), y: box.y + Math.min(28, box.height * 0.2) };
}

async function findBlankCanvasPoint(
  page: Page,
  origin: { readonly x: number; readonly y: number },
): Promise<{ x: number; y: number }> {
  return page.evaluate((start) => {
    const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!canvas) throw new Error('React Flow canvas is not mounted');

    const blockers = Array.from(
      document.querySelectorAll(
        '.react-flow__node, .react-flow__controls, .react-flow__minimap, .source-drawer__toggle, .source-drawer__body',
      ),
    ).map((element) => element.getBoundingClientRect());

    const candidates = [
      { x: start.x + 320, y: start.y + 40 },
      { x: start.x + 320, y: start.y - 120 },
      { x: start.x + 180, y: start.y - 180 },
      { x: canvas.left + canvas.width * 0.68, y: canvas.top + canvas.height * 0.32 },
      { x: canvas.left + canvas.width * 0.42, y: canvas.top + canvas.height * 0.28 },
      { x: canvas.left + canvas.width * 0.58, y: canvas.top + canvas.height * 0.58 },
    ];

    const margin = 28;
    const isInsideCanvas = (point: { readonly x: number; readonly y: number }): boolean =>
      point.x > canvas.left + margin &&
      point.x < canvas.right - margin &&
      point.y > canvas.top + margin &&
      point.y < canvas.bottom - margin;

    const isBlocked = (point: { readonly x: number; readonly y: number }): boolean =>
      blockers.some((rect) =>
        point.x >= rect.left - margin &&
        point.x <= rect.right + margin &&
        point.y >= rect.top - margin &&
        point.y <= rect.bottom + margin,
      );

    for (const point of candidates) {
      const element = document.elementFromPoint(point.x, point.y);
      if (
        isInsideCanvas(point) &&
        !isBlocked(point) &&
        element instanceof Element &&
        element.closest('.react-flow')
      ) {
        return point;
      }
    }

    throw new Error('No blank React Flow canvas point found');
  }, origin);
}

async function clickNodeBody(page: Page, title: string): Promise<void> {
  const point = await nodeBodyPoint(page, title);
  await page.mouse.click(point.x, point.y);
}

async function blur(locator: ReturnType<Page['locator']>): Promise<void> {
  await locator.evaluate((element) => (element as HTMLElement).blur());
}

test.describe('Graph Lab E2E', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    const electronArgs = fs.existsSync(MAIN_SCRIPT) ? [MAIN_SCRIPT] : [PROJECT_ROOT];
    electronApp = await electron.launch({
      args: electronArgs,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...(process.env['ELECTRON_RENDERER_URL']
          ? { ELECTRON_RENDERER_URL: process.env['ELECTRON_RENDERER_URL'] }
          : {}),
      } as Record<string, string>,
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('load');
    await page.waitForSelector('.app-shell', { timeout: 20_000 });
    await page.waitForFunction(
      () => Boolean((window as TestWindow).__test_store__),
      { timeout: 20_000 },
    );
    await page.keyboard.up('Control').catch(() => {});
    await page.keyboard.up('Shift').catch(() => {});
    await page.keyboard.up('Alt').catch(() => {});
    await page.mouse.up().catch(() => {});
    await page.evaluate(() => {
      window.localStorage.setItem('plotflow:workspaceMode', 'split');
      window.localStorage.setItem('plotflow:themeId', 'plotflow-narrative-workbench');
      (window as TestWindow).__test_store__?.setWorkspaceMode?.('split');
      (window as TestWindow).__test_store__?.setTheme?.('plotflow-narrative-workbench');
    });
    await mockExportIpcHandler(electronApp);
  });

  test.beforeEach(async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.up('Control').catch(() => {});
    await page.keyboard.up('Shift').catch(() => {});
    await page.keyboard.up('Alt').catch(() => {});
    await page.mouse.up().catch(() => {});
    await resetDefaultDialogAndSaveAsIpcHandlers(electronApp);
    await page.locator('select.language-select').selectOption('zh-CN').catch(() => {});
    await page.evaluate(() => {
      (window as TestWindow).__test_store__?.setTheme('plotflow-narrative-workbench');
      (window as TestWindow).__test_store__?.setHomeSurfaceOpen(false);
    });
  });

  test.afterAll(async () => {
    await closeElectronAppSafely(electronApp, page);
  });

  test('keeps Home hero readable across official themes and viewports', async () => {
    const originalViewport = page.viewportSize() ?? { width: 1440, height: 900 };
    const themes = ['plotflow-narrative-workbench', 'plotflow-engine-telemetry'];
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ];

    try {
      for (const themeId of themes) {
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.evaluate((id: string) => {
            (window as TestWindow).__test_store__?.setTheme(id);
            (window as TestWindow).__test_store__?.setHomeSurfaceOpen(true);
          }, themeId);
          await expect(page.getByTestId('home-surface')).toBeVisible({ timeout: 10_000 });
          await page.waitForTimeout(150);
          await expectHomeSurfaceHasNoOverlap(page);
        }
      }
    } finally {
      await page.setViewportSize(originalViewport);
      await page.evaluate(() => (window as TestWindow).__test_store__?.setHomeSurfaceOpen(false));
    }
  });

  test('opens Problems panel from the Graph Lab diagnostics chip', async () => {
    await setEditorContent(page, `${START_STORY.replace('[选项] 查看四周', '[选项] 查看四周 -> 节点：不存在')}`);
    await switchToGraphLab(page);
    await page.waitForFunction(
      () => ((window as TestWindow).__test_store__?.getDiagnostics?.() ?? [])
        .some((diagnostic) => diagnostic.code === 'E001'),
      { timeout: 10_000 },
    );

    await page.getByTestId('graph-lab-diagnostics-button').click();

    await expect(page.locator('.problem-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.problem-panel__item').first()).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-diagnostics')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('graph-lab-source-diagnostic-0')).toContainText('E001');
  });

  test('shows chapter tabs visibly and screenshots newly created chapter tab bar', async ({ browserName }, testInfo) => {
    expect(browserName).toBeTruthy();
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    const workspace = page.getByTestId('graph-lab-workspace');
    const tabs = page.getByTestId('graph-lab-chapter-tabs');
    const tab = page.getByTestId('graph-lab-chapter-tab');

    await attachVisibleScreenshot(testInfo, tabs, 'graph-lab-chapter-tabs-before-create.png');
    await expect(tab).toHaveCount(1);
    await expect(tab.first()).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('graph-lab-create-chapter').click();

    await expect(tab).toHaveCount(2, { timeout: 10_000 });
    await expect(tab.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await waitForContent(page, '# ');

    await attachVisibleScreenshot(testInfo, tabs, 'graph-lab-chapter-tabs-after-create.png');
    const workspaceScreenshot = await workspace.screenshot();
    expect(workspaceScreenshot.length).toBeGreaterThan(5_000);
    fs.writeFileSync(testInfo.outputPath('graph-lab-workspace-with-chapter-tabs.png'), workspaceScreenshot);
    await testInfo.attach('graph-lab-workspace-with-chapter-tabs.png', {
      body: workspaceScreenshot,
      contentType: 'image/png',
    });

    const originalViewport = page.viewportSize() ?? { width: 1440, height: 900 };
    try {
      await page.setViewportSize({ width: 720, height: 760 });
      await expect(workspace).toBeVisible({ timeout: 5_000 });
      await attachVisibleScreenshot(testInfo, workspace, 'graph-lab-narrow-workspace.png');
    } finally {
      await page.setViewportSize(originalViewport);
    }
  });

  test('syncs cross-chapter outline navigation and saves only the active chapter source slice', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);

    await page.getByTestId('graph-lab-outline-node').filter({ hasText: '终点' }).click();
    await expect(page.getByTestId('graph-lab-chapter-tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.react-flow__node').filter({ hasText: '终点' })).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/# 第二章/);
    await expect(sourceSlice).not.toHaveValue(/你醒来/);

    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('第二章正文。', '第二章正文更新。'));
    await sourceSlice.press('Control+S');

    const content = await getEditorContent(page);
    expect(content).toContain('你醒来。');
    expect(content).toContain('第二章正文更新。');
    expect(content).not.toContain('第二章正文。\n');
  });

  test('autosaves dirty chapter source before switching chapter tabs', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/# 第一章/);

    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('你醒来。', '你从梦中醒来。'));

    const tabs = page.getByTestId('graph-lab-chapter-tab');
    await tabs.nth(1).click();

    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/# 第二章/);
    const content = await getEditorContent(page);
    expect(content).toContain('你从梦中醒来。');
    expect(content).toContain('第二章正文。');
  });

  test('autosaves dirty chapter source before creating a new chapter', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/你醒来。/);
    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('你醒来。', '你在清晨醒来。'));

    await page.getByTestId('graph-lab-create-chapter').click();

    const tabs = page.getByTestId('graph-lab-chapter-tab');
    await expect(tabs).toHaveCount(2, { timeout: 10_000 });
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    const content = await getEditorContent(page);
    expect(content).toContain('你在清晨醒来。');
    expect(content).toContain('# 第一章 2');
  });

  test('blocks chapter switching when the dirty chapter source slice is stale', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/你醒来。/);
    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('你醒来。', '这是一段未保存草稿。'));

    const externallyChanged = (await getEditorContent(page)).replace('你醒来。', '外部修改后的正文。');
    await setEditorContentPreservingUI(page, externallyChanged);
    await expect(page.locator('.source-drawer__slice-message')).toContainText('完整源码已在其他位置变化', {
      timeout: 10_000,
    });

    const tabs = page.getByTestId('graph-lab-chapter-tab');
    await tabs.nth(1).click();

    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.status-bar')).toContainText('源码切片已变化', { timeout: 2_000 });
    expect(await getEditorContent(page)).toContain('外部修改后的正文。');
  });

  test('localizes Delete shortcut confirmation before deleting a selected node', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);
    await expect(page.locator('.react-flow__node').filter({ hasText: '起点' })).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => (window as TestWindow).__test_store__?.selectNode('第一章-起点'));

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.focus();
    });
    await page.keyboard.press('Delete');

    await expect.poll(() => dialogMessage).toBe('确定要删除节点「起点」吗？');
    await expect.poll(() => getEditorContent(page)).not.toContain('## 节点：起点');
  });

  test('renames a referenced node without creating an undefined-target diagnostic', async () => {
    await setEditorContent(page, `${START_STORY}

## 节点：目标

目标正文。
`.replace('[选项] 查看四周', '[选项] 查看四周 -> 节点：目标'));
    await switchToGraphLab(page);
    await page.evaluate(() => (window as TestWindow).__test_store__?.selectNode('第一章-目标'));

    const titleInput = page.getByTestId('graph-inspector-node-title');
    await expect(titleInput).toHaveValue('目标', { timeout: 10_000 });
    await titleInput.fill('重命名目标');
    await blur(titleInput);

    await waitForContent(page, '## 节点：重命名目标');
    await waitForContent(page, '[选项] 查看四周 -> 节点：重命名目标');
    await waitForNoDiagnostic(page, 'E001');
  });

  test('shows immediate Save As feedback from menu actions', async () => {
    await mockDelayedSaveAsIpcHandler(electronApp, 700);
    await setEditorContent(page, START_STORY);

    await sendMenuEvent(electronApp, 'menu:file:saveAs');

    await expect(page.locator('.status-bar')).toContainText('正在打开保存对话框', { timeout: 300 });
    await expect(page.locator('.status-bar')).toContainText('已保存至', { timeout: 2_000 });
  });

  test('Ctrl+S opens Save As feedback while Graph Lab has focus', async () => {
    await mockDelayedSaveAsIpcHandler(electronApp, 700);
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    await expect(page.locator('.status-bar')).toContainText('正在打开保存对话框', { timeout: 300 });
    await expect(page.locator('.status-bar')).toContainText('已保存至', { timeout: 2_000 });
  });

  test('does not open duplicate Save As dialogs from concurrent shortcuts', async () => {
    await mockCountingSaveAsIpcHandler(electronApp, 900);
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await Promise.all([
      page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S'),
      sendMenuEvent(electronApp, 'menu:file:save'),
    ]);

    await expect(page.locator('.status-bar')).toContainText('正在打开保存对话框', { timeout: 300 });
    await expect(page.locator('.status-bar')).toContainText('已保存至', { timeout: 2_000 });
    expect(await readSaveAsCallCount(electronApp)).toBe(1);
  });

  test('shows Save As failures instead of treating them as cancellation', async () => {
    await mockFailingSaveAsIpcHandler(electronApp, 'disk write rejected');
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    await expect(page.locator('.status-bar')).toContainText('保存失败', { timeout: 2_000 });
    await expect(page.locator('.status-bar')).toContainText('disk write rejected');
  });

  test('does not continue opening another file when Save As is cancelled', async () => {
    await mockSaveThenOpenCancelFlow(electronApp);
    await setEditorContent(page, START_STORY);

    await sendMenuEvent(electronApp, 'menu:file:open');

    await expect(page.locator('.status-bar')).toContainText('已取消保存', { timeout: 2_000 });
    await expect.poll(() => readOpenFileCallCount(electronApp)).toBe(0);
    expect(await getEditorContent(page)).toContain('title: Graph Lab E2E');
    expect(await getEditorContent(page)).toContain('## 节点：起点');
    expect(await getEditorContent(page)).not.toContain('Should Not Replace');
  });

  test('localizes primary UI surfaces in English mode without translating story content', async () => {
    await setEditorContent(page, START_STORY);
    await page.locator('select.language-select').selectOption('en-US');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    const menuLabels = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      return menu?.items.map((item) => item.label) ?? [];
    });
    expect(menuLabels).toEqual(expect.arrayContaining(['File', 'Edit', 'View', 'Export', 'Help']));
    expect(menuLabels).not.toEqual(expect.arrayContaining(['文件', '编辑', '视图', '导出', '帮助']));
    await switchToGraphLab(page);

    await expect(page.getByTestId('toolbar-export')).toContainText('Export');
    await expect(page.getByText('Graph Lab · Narrative Workbench')).toBeVisible();
    await expect(page.getByTestId('graph-lab-inspector')).toContainText('Story Info');
    await expect(page.getByTestId('graph-lab-inspector')).toContainText('No node selected');

    await page.getByTestId('graph-lab-diagnostics-button').click();
    await expect(page.locator('.problem-panel')).toContainText('Problems');
    await expect(page.locator('.problem-panel')).toContainText('All');
    await expect(page.locator('.problem-panel')).toContainText('Syntax parsing failed');

    await page.getByTestId('toolbar-export').click();
    await expect(page.locator('.export-dialog__overlay')).toContainText('Export story');
    await expect(page.locator('.export-dialog__overlay')).toContainText('Export format');
    await page.keyboard.press('Escape');
    await expect(page.locator('.export-dialog__overlay')).toHaveCount(0);

    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toContainText('Official Theme Center');
    await expect(page.getByTestId('theme-center')).toContainText('Installed official themes');
  });

  test('creates and exports a branch entirely from Graph Lab controls', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await expect(page.locator('.react-flow__node').filter({ hasText: '起点' })).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('graph-lab-create-node').click();
    await waitForContent(page, '## 节点：新节点');
    await expect(page.locator('.react-flow__node').filter({ hasText: '新节点' })).toBeVisible({ timeout: 10_000 });

    await clickNodeBody(page, '新节点');
    // M4: 新节点卡片可能因 DOM 事件委托/冒泡/Handle 拦截导致点击未触发选中。
    // 额外走 __test_store__.selectNode 程序化选中，确保 Inspector 一定拿到 node 上下文。
    await page.evaluate(() => {
      (window as Window & { __test_store__?: { selectNode?: (id: string) => void } }).__test_store__?.selectNode?.('第一章-新节点');
    });
    const titleInput = page.getByTestId('graph-inspector-node-title');
    await titleInput.fill('树林');
    await blur(titleInput);
    await waitForContent(page, '## 节点：树林');

    const bodyInput = page.getByTestId('graph-inspector-node-body');
    await bodyInput.fill('树影挡住了小路。');
    await blur(bodyInput);
    await waitForContent(page, '树影挡住了小路。');

    await clickNodeBody(page, '起点');
    await page.evaluate(() => {
      (window as Window & { __test_store__?: { selectNode?: (id: string) => void } }).__test_store__?.selectNode?.('第一章-起点');
    });
    await page.getByTestId('graph-inspector-option-target-0').selectOption({ label: '树林' });
    await waitForContent(page, '-> 节点：树林');

    await page.getByTestId('graph-inspector-option-condition-operator-0').selectOption('>=');
    const conditionInput = page.getByTestId('graph-inspector-option-condition-0');
    await conditionInput.fill('1');
    await blur(conditionInput);
    await waitForContent(page, '  条件: 金币 >= 1');

    await page.getByTestId('graph-inspector-option-effect-operation-0').selectOption('subtract');
    await page.getByTestId('graph-inspector-option-effect-value-0').fill('1');
    await page.getByTestId('graph-inspector-option-effect-add-0').click();
    await waitForContent(page, '  效果: 金币-1');

    await page.getByTestId('graph-inspector-variable-name').fill('日志');
    await page.getByTestId('graph-inspector-variable-type').selectOption('string');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  日志: string');

    await page.getByTestId('graph-inspector-option-effect-variable-0').selectOption('日志');
    await page.getByTestId('graph-inspector-option-effect-operation-0').selectOption('append');
    const appendInput = page.getByTestId('graph-inspector-option-effect-value-0');
    await appendInput.fill('发现脚印');
    await appendInput.press('Enter');
    await waitForContent(page, '  效果: 金币-1, 日志←"发现脚印"');

    await page.getByTestId('graph-inspector-variable-name').fill('声望');
    await page.getByTestId('graph-inspector-variable-type').selectOption('float');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  声望: float');

    await page.getByTestId('graph-lab-source-toggle').click();
    await page.waitForFunction(
      () => (window as TestWindow).__test_store__?.getUIState?.().isSourceDrawerOpen === true,
      { timeout: 10_000 },
    );
    await expect(page.getByTestId('graph-lab-source-drawer')).toBeVisible();

    await page.getByTestId('toolbar-export').click();
    const dialog = page.locator('.export-dialog__overlay');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('input[name="export-format"][value="json"]')).toBeChecked();
    await page.getByTestId('export-dialog-submit').click();
    await expect(page.getByTestId('export-dialog-submit')).toHaveAttribute('data-export-status', 'success', {
      timeout: 10_000,
    });

    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    const json = JSON.parse(captured!.content) as {
      chapters: Array<{ nodes: Array<{ title: string; options: Array<{ targetNodeId: string | null }> }> }>;
      variables: Record<string, unknown>;
    };
    const nodes = json.chapters.flatMap((chapter) => chapter.nodes);
    expect(nodes.some((node) => node.title === '树林')).toBe(true);
    expect(nodes.some((node) => node.options.some((option) => option.targetNodeId === '树林'))).toBe(true);
    expect(json.variables).toHaveProperty('声望');
  });

  test('renders Narrative Workbench chrome and keeps Source Dock in layout flow', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-narrative-workbench');
    await expect(page.getByText('Graph Lab · 叙事工作台')).toBeVisible();
    await expect(page.getByTestId('graph-lab-workspace-browser')).toBeVisible();
    await expect(page.getByTestId('graph-lab-outline-node').filter({ hasText: '起点' })).toBeVisible();
    await expect(page.getByTestId('toolbar-graph-view-toggle')).toHaveCount(0);
    await expect(page.locator('.split-viewbar')).toHaveCount(0);

    await page.getByTestId('graph-lab-source-toggle').click();
    await page.waitForFunction(
      () => (window as TestWindow).__test_store__?.getUIState?.().isSourceDrawerOpen === true,
      { timeout: 10_000 },
    );

    const railBox = await page.locator('.graph-lab-rail').boundingBox();
    const inspectorBox = await page.getByTestId('graph-lab-inspector').boundingBox();
    const drawerBox = await page.getByTestId('graph-lab-source-drawer').boundingBox();
    expect(railBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width - 1);
    expect(drawerBox!.y).toBeGreaterThanOrEqual(inspectorBox!.y + inspectorBox!.height - 1);
  });

  test('keeps Split graph view controls inside Split workspace only', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await expect(page.getByTestId('toolbar-graph-view-toggle')).toHaveCount(0);
    await expect(page.locator('.split-viewbar')).toHaveCount(0);

    await switchToSplit(page);

    await expect(page.locator('.split-viewbar')).toBeVisible();
    await expect(page.locator('.split-viewbar').getByTestId('toolbar-graph-view-toggle')).toBeVisible();

    await switchToGraphLab(page);
  });

  test('browses a selected workspace and opens a .mdstory from the left rail', async () => {
    const workspaceStory = `---
plotflow: 0.1
title: 工作区故事
author: QA
---

# 第一章

## 节点：工作区起点
从内容浏览器打开的故事。

[选项] 去分支 -> 工作区分支

## 节点：工作区分支
分支内容。
`;
    await mockWorkspaceIpcHandler(electronApp, {
      rootPath: 'D:\\PlotFlowE2E\\Stories',
      filePath: 'D:\\PlotFlowE2E\\Stories\\workspace-branch.mdstory',
      relativePath: 'workspace-branch.mdstory',
      content: workspaceStory,
    });
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await page.getByTestId('graph-lab-choose-workspace').click();
    const workspaceFile = page.getByTestId('graph-lab-workspace-file').filter({ hasText: 'workspace-branch.mdstory' });
    await expect(workspaceFile).toBeVisible({ timeout: 10_000 });

    await workspaceFile.click();
    await waitForContent(page, '节点：工作区分支');
    await expect(page.getByTestId('graph-lab-outline-node').filter({ hasText: '工作区起点' })).toBeVisible({
      timeout: 10_000,
    });
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await expect(page.locator('.react-flow__node').filter({ hasText: '起点' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await reloadRenderer(page);
  });

  test('guards Source Drawer drafts before opening workspace stories', async () => {
    const workspaceStory = `---
plotflow: 0.1
title: 工作区故事
author: QA
---

# 第一章

## 节点：工作区起点
从内容浏览器打开的故事。
`;
    await mockWorkspaceIpcHandler(electronApp, {
      rootPath: 'D:\\PlotFlowE2E\\Stories',
      filePath: 'D:\\PlotFlowE2E\\Stories\\workspace-guard.mdstory',
      relativePath: 'workspace-guard.mdstory',
      content: workspaceStory,
    });
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);
    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });

    const originalSource = await sourceSlice.inputValue();
    await sourceSlice.fill(originalSource.replace('你醒来。', '打开工作区前自动保存。'));
    await page.getByTestId('graph-lab-choose-workspace').click();
    const workspaceFile = page.getByTestId('graph-lab-workspace-file').filter({ hasText: 'workspace-guard.mdstory' });
    await expect(workspaceFile).toBeVisible({ timeout: 10_000 });
    await workspaceFile.click();

    await waitForContent(page, '节点：工作区起点');
    expect(await readWorkspaceStoryCallCount(electronApp)).toBe(1);

    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);
    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/你醒来。/);
    const staleDraft = (await sourceSlice.inputValue()).replace('你醒来。', '这段草稿不能被覆盖。');
    await sourceSlice.fill(staleDraft);
    const externallyChanged = (await getEditorContent(page)).replace('你醒来。', '外部修改后的正文。');
    await setEditorContentPreservingUI(page, externallyChanged);
    await expect(page.locator('.source-drawer__slice-message')).toContainText('完整源码已在其他位置变化', {
      timeout: 10_000,
    });
    await workspaceFile.click();

    expect(await readWorkspaceStoryCallCount(electronApp)).toBe(1);
    await expect(page.locator('.status-bar')).toContainText('源码切片已变化', { timeout: 2_000 });
    expect(await getEditorContent(page)).toContain('外部修改后的正文。');
    expect(await getEditorContent(page)).not.toContain('节点：工作区起点');
  });

  test('persists node dragging into .mdstory layout data', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    await expect(node).toBeVisible({ timeout: 10_000 });

    const before = await node.boundingBox();
    expect(before).not.toBeNull();
    const start = await nodeDragPoint(page, '起点');
    await dragFromTo(page, start, { x: start.x + 120, y: start.y + 80 });

    await page.waitForFunction(
      () => (window as TestWindow).__test_store__?.getEditorContent?.().includes('layout:') ?? false,
      { timeout: 10_000 },
    );
    const movedNode = page.locator('.react-flow__node').first();
    await expect(movedNode).toBeVisible({ timeout: 10_000 });
    const after = await movedNode.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(30);

    const content = await getEditorContent(page);
    expect(content).toContain('      - id: "第一章-起点"');
  });

  test('connects an option to an existing node by dragging a cable', async () => {
    await setEditorContent(page, `${START_STORY}

## 节点：树林

树影挡住了小路。
`);
    await switchToGraphLab(page);
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const handle = sourceNode.locator('.story-node-connect-handle').first();
    const target = await nodeCenter(page, '树林');

    await dragLocatorTo(page, handle, target);
    await waitForContent(page, '[选项] 查看四周 -> 节点：树林');
  });

  test('opens a cable drop menu on blank space and creates a connected node there', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const handle = sourceNode.locator('.story-node-connect-handle').first();
    const sourceCenter = await nodeCenter(page, '起点');
    const blankPoint = await findBlankCanvasPoint(page, sourceCenter);

    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('wire handle has no bounding box');
    const handleCenter = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };

    await page.mouse.move(handleCenter.x, handleCenter.y);
    await page.mouse.down();
    await page.mouse.move((handleCenter.x + blankPoint.x) / 2, (handleCenter.y + blankPoint.y) / 2, { steps: 6 });
    await expect(page.getByTestId('graph-live-wire-preview')).toBeVisible({ timeout: 5_000 });
    await page.mouse.move(blankPoint.x, blankPoint.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);

    await dragLocatorTo(page, handle, blankPoint);
    await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('wire-drop-create-node').click();

    await waitForContent(page, '[选项] 查看四周 -> 节点：新节点');
    await waitForContent(page, '      - id: "第一章-新节点"');
    await expect(page.locator('.react-flow__node').filter({ hasText: '新节点' })).toBeVisible({ timeout: 10_000 });
  });

  test('disconnects an existing option by dragging its cable endpoint to blank space', async () => {
    await setEditorContent(page, `${START_STORY}

## 节点：树林

树影挡住了小路。
`.replace('[选项] 查看四周', '[选项] 查看四周 -> 节点：树林'));
    await switchToGraphLab(page);
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const handle = sourceNode.locator('.story-node-connect-handle').first();
    const sourceCenter = await nodeCenter(page, '起点');
    const blankPoint = await findBlankCanvasPoint(page, sourceCenter);

    await dragLocatorTo(page, handle, blankPoint);
    await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('wire-drop-disconnect').click();

    await waitForContent(page, '[选项] 查看四周');
    const content = await getEditorContent(page);
    expect(content).not.toContain('[选项] 查看四周 -> 节点：树林');
  });

  test('keeps dirty window open on close cancel and closes only after discard', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await mockCloseDialogResponse(electronApp, 2);
    await requestMainWindowClose(electronApp);
    await expect(page.getByTestId('graph-lab-workspace')).toBeVisible({ timeout: 2_000 });

    await mockCloseDialogResponse(electronApp, 1);
    const closed = page.waitForEvent('close', { timeout: 5_000 });
    await requestMainWindowClose(electronApp);
    await closed;
    await electronApp.evaluate(({ app }) => {
      app.exit(0);
    }).catch(() => {});
  });
});
