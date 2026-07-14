import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import type { TestInfo } from '@playwright/test';
import fs from 'fs';
import { createFullId } from '@plotflow/core';
import { IPC_CHANNELS } from '../src/shared/ipcChannels';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN_SCRIPT = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');
const IPC_EXPORT_CHANNEL = IPC_CHANNELS.file.export;
const FIRST_START_ID = createFullId('第一章', '起点');

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

const FAR_LAYOUT_STORY = `---
plotflow: 0.1
title: Graph Lab Far Layout E2E
author: QA
layout:
  graph:
    version: 1
    nodes:
      - id: "${FIRST_START_ID}"
        x: 4200
        y: 3600
---

# 第一章

## 节点：起点

你醒来。

[选项] 查看四周
`;

const VIEWPORT_TARGET_ID = createFullId('第一章', '远端节点');

const NODE_SELECTION_VIEWPORT_STORY = `---
plotflow: 0.1
title: Node Selection Viewport E2E
author: QA
layout:
  graph:
    version: 1
    nodes:
      - id: "${FIRST_START_ID}"
        x: 80
        y: 120
      - id: "${VIEWPORT_TARGET_ID}"
        x: 380
        y: 120
---

# 第一章

## 节点：起点

保持镜头稳定。

## 节点：远端节点

只能由显式搜索聚焦。
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

interface CapturedSaveAs {
  content: string;
  filePath: string;
  timestamp: number;
}

type CaptureGlobal = typeof globalThis & { __e2e_capture?: CapturedExport | null };
type SaveAsCaptureGlobal = typeof globalThis & { __plotflowSaveAsCapture?: CapturedSaveAs | null };

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
  applyExternalFileContent: (event: {
    readonly filePath: string;
    readonly content: string;
    readonly hash: string;
    readonly modifiedAt: number;
  }) => void;
  setWorkspaceMode: (mode: 'split' | 'graphLab') => void;
  setTheme: (themeId: string) => void;
  setHomeSurfaceOpen: (open: boolean) => void;
  openThemeCenter: () => void;
  selectNode: (nodeId: string) => void;
  getUIState: () => {
    readonly workspaceMode: 'split' | 'graphLab';
    readonly isSourceDrawerOpen: boolean;
    readonly activeChapterId: string | null;
    readonly activeNodeId: string | null;
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

async function mockCaptureSaveAsIpcHandler(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    (globalThis as SaveAsCaptureGlobal).__plotflowSaveAsCapture = null;
    ipcMain.removeHandler('file:saveAs');
    ipcMain.handle('file:saveAs', async (_event, payload: { content?: string }) => {
      const content = String(payload.content ?? '');
      const filePath = 'D:\\PlotFlowE2E\\source-drawer-save.mdstory';
      (globalThis as SaveAsCaptureGlobal).__plotflowSaveAsCapture = {
        content,
        filePath,
        timestamp: Date.now(),
      };
      return {
        filePath,
        hash: 'source-drawer-save-hash',
        modifiedAt: Date.now(),
      };
    });
  });
}

async function readCapturedSaveAs(app: ElectronApplication): Promise<CapturedSaveAs | null> {
  return app.evaluate(() => {
    const capture = (globalThis as SaveAsCaptureGlobal).__plotflowSaveAsCapture ?? null;
    (globalThis as SaveAsCaptureGlobal).__plotflowSaveAsCapture = null;
    return capture;
  });
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
  const targetText = ((await tabs.nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
  await tabs.nth(index).click();
  await expect.poll(async () => {
    const currentTabs = await page.getByTestId('graph-lab-chapter-tab').evaluateAll((elements) =>
      elements.map((element, currentIndex) => ({
        currentIndex,
        selected: element.getAttribute('aria-selected') === 'true',
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    return currentTabs.some((tab) =>
      tab.selected && (tab.currentIndex === index || (targetText.length > 0 && tab.text === targetText)),
    );
  }, { timeout: 10_000 }).toBe(true);
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
  const homeCoversViewport = await page.evaluate(() => {
    const home = document.querySelector('[data-testid="home-surface"]');
    if (!home) return false;
    const rect = home.getBoundingClientRect();
    const samplePoints = [
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      { x: window.innerWidth / 2, y: Math.max(4, window.innerHeight - 8) },
      { x: Math.max(4, window.innerWidth - 8), y: window.innerHeight / 2 },
    ];
    const allSamplesInHome = samplePoints.every((point) =>
      document.elementFromPoint(point.x, point.y)?.closest('[data-testid="home-surface"]'),
    );
    return (
      rect.left <= 1 &&
      rect.top <= 1 &&
      rect.right >= window.innerWidth - 1 &&
      rect.bottom >= window.innerHeight - 1 &&
      allSamplesInHome
    );
  });
  expect(homeCoversViewport).toBe(true);

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

async function expectDocumentDoesNotScroll(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollHeight - window.innerHeight);
  }), { timeout: 5_000 }).toBeLessThanOrEqual(2);
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

async function dragHandleToMenu(
  page: Page,
  handle: ReturnType<Page['locator']>,
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dragPort = handle.locator('.story-node-connect-port').first();
    const handleBox = attempt % 2 === 0
      ? (await handle.boundingBox()) ?? (await dragPort.boundingBox())
      : (await dragPort.boundingBox()) ?? (await handle.boundingBox());
    if (!handleBox) throw new Error('wire handle has no bounding box');
    await dragFromTo(
      page,
      { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 },
      to,
    );
    try {
      await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 3_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.mouse.up().catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(120);
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('wire drop menu did not become visible');
}

async function startWirePreviewFromHandle(
  page: Page,
  handle: ReturnType<Page['locator']>,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dragPort = handle.locator('.story-node-connect-port').first();
    const handleBox = attempt % 2 === 0
      ? (await handle.boundingBox()) ?? (await dragPort.boundingBox())
      : (await dragPort.boundingBox()) ?? (await handle.boundingBox());
    if (!handleBox) throw new Error('wire handle has no bounding box');
    const handleCenter = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
    const canvasBox = await page.locator('.graph-lab__canvas').boundingBox();
    if (!canvasBox) throw new Error('Graph Lab canvas has no bounding box');
    const previewPoint = {
      x: Math.min(canvasBox.x + canvasBox.width - 48, handleCenter.x + 52),
      y: handleCenter.y,
    };

    await page.mouse.move(handleCenter.x, handleCenter.y);
    await page.mouse.down();
    await page.mouse.move(previewPoint.x, previewPoint.y, { steps: 6 });
    try {
      await expect(page.getByTestId('graph-live-wire-preview')).toBeVisible({ timeout: 2_500 });
      return;
    } catch (error) {
      lastError = error;
      await page.mouse.up().catch(() => {});
      await page.waitForTimeout(120);
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('wire preview did not become visible');
}

async function nodeCenter(page: Page, title: string): Promise<{ x: number; y: number }> {
  const node = page.locator('.react-flow__node').filter({ hasText: title }).first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  const box = await node.boundingBox();
  if (!box) throw new Error(`node has no bounding box: ${title}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function readGraphViewportTransform(page: Page): Promise<string> {
  return page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewport) throw new Error('React Flow viewport is not mounted');
    return window.getComputedStyle(viewport).transform;
  });
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

async function expectEmbeddedNextOutputHandle(node: ReturnType<Page['locator']>): Promise<void> {
  const route = node.getByTestId('node-route-preview-next');
  const card = node.locator('.story-node-card, [data-official-node-theme]').first();
  const inputHandle = node.locator([
    '.story-node-handle-target--inline',
    '.story-node-handle-target--side',
    '.official-node-port--inline',
    '.official-node-port--target',
  ].join(', ')).first();
  const outputHandle = node.locator('[data-testid="story-node-default-next-handle"], [data-handleid="next"]').first();
  await expect(outputHandle).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => {
    return node.evaluate(() => {
      const handle = document.querySelector('[data-testid="story-node-default-next-handle"]');
      const rect = handle?.getBoundingClientRect();
      if (!rect) return false;
      const element = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return element instanceof Element && Boolean(element.closest('.story-node-connect-handle'));
    });
  }, { timeout: 10_000 }).toBe(true);

  const cardBox = await card.boundingBox();
  const routeBox = await route.boundingBox();
  const inputBox = await inputHandle.boundingBox();
  const outputBox = await outputHandle.boundingBox();
  const flowScale = await node.evaluate((element) => {
    const viewport = element.closest('.react-flow')?.querySelector('.react-flow__viewport');
    if (!viewport) return 1;
    const transform = window.getComputedStyle(viewport).transform;
    if (!transform || transform === 'none') return 1;
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (!matrix) return 1;
    const [scaleX, skewY] = (matrix[1] ?? '').split(',').map((value) => Number.parseFloat(value.trim()));
    const scale = Math.hypot(scaleX || 0, skewY || 0);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  });
  expect(cardBox).not.toBeNull();
  expect(routeBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(outputBox).not.toBeNull();

  const inputCenterY = inputBox!.y + inputBox!.height / 2;
  const outputCenterX = outputBox!.x + outputBox!.width / 2;
  const outputCenterY = outputBox!.y + outputBox!.height / 2;
  const routeCenterY = routeBox!.y + routeBox!.height / 2;
  const cardLeft = cardBox!.x;
  const cardRight = cardBox!.x + cardBox!.width;

  expect(outputCenterX).toBeGreaterThan(cardLeft);
  expect(outputCenterX).toBeLessThanOrEqual(cardRight - 4);
  expect(outputCenterX).toBeGreaterThanOrEqual(cardRight - (48 * flowScale));
  expect(Math.abs(outputCenterY - routeCenterY)).toBeLessThanOrEqual(4 * flowScale);
  expect(Math.abs(outputCenterY - inputCenterY)).toBeLessThanOrEqual(4 * flowScale);
}

async function findBlankCanvasPoint(
  page: Page,
  origin: { readonly x: number; readonly y: number },
): Promise<{ x: number; y: number }> {
  return page.evaluate((start) => {
    const canvas = document.querySelector('.graph-lab__canvas')?.getBoundingClientRect();
    if (!canvas) throw new Error('Graph Lab canvas is not mounted');

    const blockers = Array.from(
      document.querySelectorAll(
        '.react-flow__node, .react-flow__controls, .react-flow__minimap, .source-drawer__toggle, .source-drawer__body',
      ),
    ).map((element) => element.getBoundingClientRect());

    const candidates = [
      { x: start.x + 320, y: start.y + 40 },
      { x: start.x + 420, y: start.y + 70 },
      { x: start.x + 520, y: start.y + 120 },
      { x: start.x + 320, y: start.y - 120 },
      { x: start.x + 180, y: start.y - 180 },
      { x: canvas.left + canvas.width * 0.5, y: canvas.top + 48 },
      { x: canvas.left + canvas.width * 0.82, y: canvas.top + 60 },
      { x: canvas.left + canvas.width * 0.18, y: canvas.bottom - 64 },
      { x: canvas.left + canvas.width * 0.52, y: canvas.bottom - 56 },
      { x: canvas.left + canvas.width * 0.68, y: canvas.top + canvas.height * 0.32 },
      { x: canvas.left + canvas.width * 0.42, y: canvas.top + canvas.height * 0.28 },
      { x: canvas.left + canvas.width * 0.58, y: canvas.top + canvas.height * 0.58 },
    ];

    for (let row = 1; row <= 9; row++) {
      for (let col = 2; col <= 10; col++) {
        candidates.push({
          x: canvas.left + (canvas.width * col) / 12,
          y: canvas.top + (canvas.height * row) / 10,
        });
      }
    }

    const margin = 20;
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
    const themes = ['plotflow-prism-foundry', 'plotflow-narrative-workbench', 'plotflow-engine-telemetry'];
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
          const preview = page.getByTestId('home-surface').locator('[data-preview-source="rendered-workspace"]');
          await expect(preview).toHaveAttribute('data-preview-theme-id', themeId);
          const previewImage = preview.getByTestId('theme-rendered-preview');
          await expect(previewImage).toBeVisible();
          await expect.poll(() => previewImage.evaluate((element: HTMLImageElement) => (
            element.complete && element.naturalWidth > 0
          ))).toBe(true);
          await page.waitForTimeout(150);
          await expectHomeSurfaceHasNoOverlap(page);
        }
      }
    } finally {
      await page.setViewportSize(originalViewport);
      await page.evaluate(() => (window as TestWindow).__test_store__?.setHomeSurfaceOpen(false));
    }
  });

  test('centers persisted Graph Lab layout nodes into a readable initial viewport', async () => {
    await setEditorContent(page, FAR_LAYOUT_STORY);
    await switchToGraphLab(page);

    const canvas = page.locator('.graph-lab__canvas');
    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const route = node.getByTestId('node-route-preview-option-0');

    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await expect(node).toBeVisible({ timeout: 10_000 });
    await expect(route).toContainText('查看四周');

    await expect.poll(async () => {
      const canvasBox = await canvas.boundingBox();
      const nodeBox = await node.boundingBox();
      const routeBox = await route.boundingBox();
      if (!canvasBox || !nodeBox || !routeBox) return false;

      return (
        nodeBox.x >= canvasBox.x + 8 &&
        nodeBox.y >= canvasBox.y + 8 &&
        nodeBox.x + nodeBox.width <= canvasBox.x + canvasBox.width - 8 &&
        nodeBox.y + nodeBox.height <= canvasBox.y + canvasBox.height - 8 &&
        nodeBox.width > 220 &&
        routeBox.width > 150
      );
    }, { timeout: 10_000 }).toBe(true);
  });

  test('keeps the Graph Lab viewport stable when selecting a node, while search remains explicit navigation', async () => {
    await setEditorContent(page, NODE_SELECTION_VIEWPORT_STORY);
    await switchToGraphLab(page);

    const target = page.locator('.react-flow__node').filter({ hasText: '远端节点' }).first();
    await expect(target).toBeVisible({ timeout: 10_000 });
    const beforeSelection = await readGraphViewportTransform(page);

    await clickNodeBody(page, '远端节点');
    await page.waitForTimeout(260);
    expect(await readGraphViewportTransform(page)).toBe(beforeSelection);

    await page.keyboard.press('Control+K');
    const search = page.getByPlaceholder(/搜索标题、ID、正文或选项|search title, ID, body, or option/i);
    await expect(search).toBeFocused();
    await search.fill('远端节点');
    await page.keyboard.press('Enter');
    await expect.poll(() => readGraphViewportTransform(page), { timeout: 5_000 }).not.toBe(beforeSelection);
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
    const dockGeometry = await page.evaluate(() => {
      const toolbar = document.querySelector('.app-topbar')?.getBoundingClientRect();
      const workspace = document.querySelector('[data-testid="graph-lab-workspace"]')?.getBoundingClientRect();
      const panel = document.querySelector('.problem-panel')?.getBoundingClientRect();
      if (!toolbar || !workspace || !panel) return null;
      const toolbarCenter = document.elementFromPoint(toolbar.left + toolbar.width / 2, toolbar.top + toolbar.height / 2);
      return {
        toolbarBottom: toolbar.bottom,
        workspaceBottom: workspace.bottom,
        panelTop: panel.top,
        panelBottom: panel.bottom,
        toolbarStillOnTop: Boolean(toolbarCenter?.closest('.app-topbar')),
      };
    });
    expect(dockGeometry).not.toBeNull();
    expect(dockGeometry!.toolbarStillOnTop).toBe(true);
    expect(dockGeometry!.panelTop).toBeGreaterThan(dockGeometry!.toolbarBottom);
    expect(dockGeometry!.panelTop).toBeGreaterThanOrEqual(dockGeometry!.workspaceBottom - 1);

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-diagnostics')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('graph-lab-source-diagnostic-0')).toContainText('E001');
  });

  test('keeps Graph Lab create node action reachable at 1280 by 720', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    const createNode = page.getByTestId('graph-lab-create-node');
    await expect(createNode).toBeVisible({ timeout: 10_000 });
    const box = await createNode.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  });

  test('clicking a ProblemPanel diagnostic selects its Graph Lab chapter and node', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY.replace('第二章正文。', '第二章正文。\n[选项] 消失 -> 节点：不存在'));
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);
    await page.waitForFunction(
      () => ((window as TestWindow).__test_store__?.getDiagnostics?.() ?? [])
        .some((diagnostic) => diagnostic.code === 'E001'),
      { timeout: 10_000 },
    );

    await page.getByTestId('graph-lab-diagnostics-button').click();
    await expect(page.getByTestId('problem-panel-item-E001').first()).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('problem-panel-item-E001').first().click();

    await expect(page.getByTestId('graph-lab-chapter-tab').nth(1)).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });
    await expect.poll(() => page.evaluate(() =>
      (window as TestWindow).__test_store__?.getUIState?.().activeNodeId,
    )).toBe(createFullId('第二章', '终点'));
    await expect(page.getByTestId('graph-inspector-node-title')).toHaveValue('终点', { timeout: 10_000 });
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
    await expect(tab.nth(1)).toContainText('第二章');
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

  test('places the default next output handle on the right side of no-option cards', async ({ browserName }, testInfo) => {
    void browserName;
    await setEditorContent(page, `---
plotflow: 0.1
title: Default Port E2E
author: QA
---

# 第一章

## 节点：流程节点

这是一段没有普通选项、也尚未设置下一步的流程节点。
`);
    await switchToGraphLab(page);

    const node = page.locator('.react-flow__node').filter({ hasText: '流程节点' }).first();
    const route = node.getByTestId('node-route-preview-next');
    await expect(route).toContainText('下一步');
    await expect(route).toContainText('终端节点');
    await expect(route).toHaveClass(/node-route-preview--default-next/);
    await expect(route).not.toHaveClass(/node-route-preview--route-option/);
    await expectEmbeddedNextOutputHandle(node);
    await attachVisibleScreenshot(testInfo, node.locator('.official-graph-node, .story-node-card').first(), 'graph-lab-default-next-embedded-node.png');

    const sourceCenter = await nodeCenter(page, '流程节点');
    const blankPoint = await findBlankCanvasPoint(page, sourceCenter);
    await startWirePreviewFromHandle(page, node.getByTestId('story-node-default-next-handle'));
    await page.mouse.move(blankPoint.x, blankPoint.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);
  });

  test('edits a node-level next target and effects entirely in Graph Inspector', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setEditorContent(page, `---
plotflow: 0.1
vars:
  金币: int
---

# 第一章

## 节点：流程节点

继续前进。

## 节点：终点

流程结束。
`);
    await switchToGraphLab(page);
    await clickNodeBody(page, '流程节点');
    await page.evaluate((fullId) => {
      (window as Window & { __test_store__?: { selectNode?: (id: string) => void } }).__test_store__?.selectNode?.(fullId);
    }, createFullId('第一章', '流程节点'));

    await page.getByTestId('graph-inspector-next-target').selectOption(createFullId('第一章', '终点'));
    await waitForContent(page, '下一步: 节点：终点');
    await page.getByTestId('graph-inspector-option-effect-variable--1').selectOption('金币');
    await page.getByTestId('graph-inspector-option-effect-operation--1').selectOption('add');
    const effectValue = page.getByTestId('graph-inspector-option-effect-value--1');
    const effectSubmit = page.getByTestId('graph-inspector-option-effect-add--1');
    await effectValue.fill('2');
    await expect(effectValue).toHaveAttribute('aria-keyshortcuts', 'Enter');
    await expect(effectSubmit).toHaveAttribute('aria-keyshortcuts', 'Enter');

    const inspector = page.locator('.graph-lab-inspector');
    const submitGeometry = await Promise.all([
      inspector.boundingBox(),
      effectSubmit.boundingBox(),
    ]);
    expect(submitGeometry[0]).not.toBeNull();
    expect(submitGeometry[1]).not.toBeNull();
    expect(submitGeometry[1]!.x).toBeGreaterThanOrEqual(submitGeometry[0]!.x);
    expect(submitGeometry[1]!.x + submitGeometry[1]!.width)
      .toBeLessThanOrEqual(submitGeometry[0]!.x + submitGeometry[0]!.width);

    await effectValue.press('Enter');
    await waitForContent(page, '下一步: 节点：终点\n  效果: 金币+2');

    const deleteEffect = page
      .getByTestId('graph-inspector-effect-editor--1')
      .locator('.graph-lab-effect-row .icon-button')
      .first();
    await expect(deleteEffect).toBeVisible();
    const deleteGeometry = await Promise.all([
      inspector.boundingBox(),
      deleteEffect.boundingBox(),
    ]);
    expect(deleteGeometry[0]).not.toBeNull();
    expect(deleteGeometry[1]).not.toBeNull();
    expect(deleteGeometry[1]!.x).toBeGreaterThanOrEqual(deleteGeometry[0]!.x);
    expect(deleteGeometry[1]!.x + deleteGeometry[1]!.width)
      .toBeLessThanOrEqual(deleteGeometry[0]!.x + deleteGeometry[0]!.width);
  });

  test('keeps Engine Telemetry default next output handle embedded inside no-option cards', async ({ browserName }, testInfo) => {
    void browserName;
    await setEditorContent(page, `---
plotflow: 0.1
title: Engine Default Port E2E
author: QA
---

# 第一章

## 节点：流程节点

这是一段没有普通选项的流程节点。

下一步: 节点：终点

## 节点：终点

流程结束。
`);
    await page.evaluate(() => {
      (window as TestWindow).__test_store__?.setTheme('plotflow-engine-telemetry');
    });
    await switchToGraphLab(page);

    const node = page.locator('.react-flow__node').filter({ hasText: '流程节点' }).first();
    await expect(node.locator('[data-official-node-theme="plotflow-engine-telemetry"]')).toBeVisible({ timeout: 10_000 });
    await expect(node.getByTestId('node-route-preview-next')).toContainText('下一步');
    await expect(node.getByTestId('node-route-preview-next')).toContainText('→ 终点');
    await expectEmbeddedNextOutputHandle(node);
    await attachVisibleScreenshot(testInfo, node.locator('.official-graph-node, .story-node-card').first(), 'graph-lab-engine-default-next-embedded-node.png');
  });

  test('shows route requirements, target previews, effects, and aligned option ports in node cards', async ({ browserName }, testInfo) => {
    void browserName;
    await setEditorContent(page, `---
plotflow: 0.1
title: Route Summary E2E
author: QA
vars:
  金币: int
  日志: string
---

# 第一章

## 节点：起点

选择下一步。

[选项] 进入商店 -> 节点：商店
  条件: 金币 >= 1
  效果: 金币-1, 日志←"发现脚印"
[选项] 离开 -> 节点：出口

## 节点：商店

欢迎。

## 节点：出口

离开。
`);
    await switchToGraphLab(page);

    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const nodeBox = await node.boundingBox();
    expect(nodeBox).not.toBeNull();
    expect(nodeBox!.width).toBeGreaterThanOrEqual(240);
    const route = node.getByTestId('node-route-preview-option-0');
    await expect(route).toBeVisible({ timeout: 10_000 });
    await expect(route).toContainText('进入商店');
    await expect(route).toContainText('需 金币 >= 1');
    await expect(route).toContainText('→ 商店');
    await expect(route).toContainText('效果 金币 -1');
    await expect(route).toContainText('日志←"发现脚印"');

    const routeBox = await route.boundingBox();
    const handleBox = await node.getByTestId('story-node-option-handle-0').boundingBox();
    expect(routeBox).not.toBeNull();
    expect(handleBox).not.toBeNull();
    expect(routeBox!.width).toBeGreaterThanOrEqual(200);
    const routeCenterY = routeBox!.y + routeBox!.height / 2;
    const handleCenterY = handleBox!.y + handleBox!.height / 2;
    expect(Math.abs(routeCenterY - handleCenterY)).toBeLessThanOrEqual(6);

    await attachVisibleScreenshot(testInfo, page.getByTestId('graph-lab-workspace'), 'graph-lab-route-summary-default-workspace.png');
    await attachVisibleScreenshot(testInfo, node.locator('.official-graph-node, .story-node-card').first(), 'graph-lab-route-summary-default-node.png');

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-source-drawer')).toBeVisible({ timeout: 10_000 });
    await expectDocumentDoesNotScroll(page);
    await attachVisibleScreenshot(testInfo, page.getByTestId('graph-lab-source-drawer'), 'graph-lab-source-dock-open-default.png');
  });

  test('renders route summaries in Engine Telemetry node cards', async ({ browserName }, testInfo) => {
    void browserName;
    await page.evaluate(() => {
      (window as TestWindow).__test_store__?.setTheme('plotflow-engine-telemetry');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-engine-telemetry');
    await setEditorContent(page, `---
plotflow: 0.1
title: Engine Route Summary E2E
author: QA
vars:
  金币: int
---

# 第一章

## 节点：流程节点

遥测卡片。

[选项] 推进 -> 节点：结果
  条件: 金币 >= 1
  效果: 金币-1

## 节点：结果

完成。
`);
    await switchToGraphLab(page);

    const node = page.locator('.react-flow__node').filter({ hasText: '流程节点' }).first();
    const card = node.locator('[data-official-node-theme="plotflow-engine-telemetry"]').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByTestId('node-route-preview-option-0')).toContainText('需 金币 >= 1');
    await expect(card.getByTestId('node-route-preview-option-0')).toContainText('→ 结果');
    await expect(card.getByTestId('node-route-preview-option-0')).toContainText('效果 金币 -1');
    await attachVisibleScreenshot(testInfo, page.getByTestId('graph-lab-workspace'), 'graph-lab-route-summary-engine-telemetry-workspace.png');
    await attachVisibleScreenshot(testInfo, card, 'graph-lab-route-summary-engine-telemetry-node.png');
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

  test('saves a chapter source slice without absorbing the next chapter heading', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/# 第一章/);
    await expect(sourceSlice).not.toHaveValue(/# 第二章/);

    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(`${sourceValue.trimEnd()}\n\n第一章追加正文。\n`);
    await sourceSlice.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    await expect(page.getByTestId('graph-lab-chapter-tab')).toHaveCount(2, { timeout: 10_000 });
    const content = await getEditorContent(page);
    expect(content.match(/^# 第二章$/gm)).toHaveLength(1);
    expect(content).toMatch(/第一章追加正文。[ \t]*(?:\r?\n)+# 第二章/m);
    await selectChapterTab(page, 1);
    await expect(sourceSlice).toHaveValue(/# 第二章/, { timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/第二章正文。/);
  });

  test('writes Source Drawer slice drafts through the real Save As payload', async () => {
    await mockCaptureSaveAsIpcHandler(electronApp);
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 1);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    await expect(sourceSlice).toHaveValue(/# 第二章/);

    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('第二章正文。', '第二章已真实写盘。'));
    await page.locator('.source-drawer__slice-action-primary').click();

    await expect(page.locator('.status-bar')).toContainText('已保存到文件', { timeout: 10_000 });
    const captured = await readCapturedSaveAs(electronApp);
    expect(captured).not.toBeNull();
    expect(captured!.content).toContain('第二章已真实写盘。');
    expect(captured!.content).toContain('# 第一章');
    expect(captured!.content.match(/^# 第二章$/gm)).toHaveLength(1);
    expect(captured!.content).toMatch(/第二章已真实写盘。[ \t]*(?:\r?\n)*$/);
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

  test('flushes dirty Source Drawer drafts before Inspector source mutations', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 0);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible({ timeout: 10_000 });
    const sourceValue = await sourceSlice.inputValue();
    await sourceSlice.fill(sourceValue.replace('你醒来。', 'Inspector 写回前保留的草稿。'));

    await page.evaluate((fullId) => {
      (window as TestWindow).__test_store__?.selectNode(fullId);
    }, FIRST_START_ID);
    const titleInput = page.getByTestId('graph-inspector-node-title');
    await expect(titleInput).toHaveValue('起点', { timeout: 10_000 });
    await titleInput.fill('改名起点');
    await blur(titleInput);

    await waitForContent(page, 'Inspector 写回前保留的草稿。');
    await waitForContent(page, '## 节点：改名起点');
    const content = await getEditorContent(page);
    expect(content).toContain('Inspector 写回前保留的草稿。');
    expect(content).toContain('## 节点：改名起点');
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
    expect(content).toContain('# 第二章');
    expect(content).not.toContain('# 第一章 2');
  });

  test('resets the active chapter before creating nodes in a replaced story', async () => {
    const blankStory = `---
plotflow: 0.1
title: Blank Reset
author: QA
---

# 空白章

## 节点：开始

新故事正文。
`;
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await selectChapterTab(page, 1);

    await setEditorContent(page, blankStory);
    await switchToGraphLab(page);
    await expect(page.getByTestId('graph-lab-chapter-tab').first()).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });
    await page.getByTestId('graph-lab-create-node').click();
    await waitForContent(page, '## 节点：新节点');

    const content = await getEditorContent(page);
    expect(content).toContain('# 空白章');
    expect(content).toContain('## 节点：新节点');
    expect(content).not.toContain('# 第二章');
  });

  test('Ctrl+S commits the focused Inspector field before saving', async () => {
    await mockCaptureSaveAsIpcHandler(electronApp);
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await page.evaluate((fullId) => (window as TestWindow).__test_store__?.selectNode(fullId), FIRST_START_ID);

    const titleInput = page.getByTestId('graph-inspector-node-title');
    await titleInput.fill('保存前提交标题');
    await titleInput.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    await waitForContent(page, '## 节点：保存前提交标题');
    await expect(page.locator('.status-bar')).toContainText('已保存至', { timeout: 5_000 });
    const captured = await readCapturedSaveAs(electronApp);
    expect(captured?.content).toContain('## 节点：保存前提交标题');
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
    await page.evaluate((fullId) => (window as TestWindow).__test_store__?.selectNode(fullId), FIRST_START_ID);

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.focus();
    });
    await page.keyboard.press('Delete');

    const deleteDialog = page.getByRole('dialog', { name: '删除节点' });
    await expect(deleteDialog).toContainText('确定要删除节点「起点」吗？');
    await deleteDialog.getByTestId('graph-confirm-primary').click();
    await expect.poll(() => getEditorContent(page)).not.toContain('## 节点：起点');
  });

  test('renames a referenced node without creating an undefined-target diagnostic', async () => {
    await setEditorContent(page, `${START_STORY}

## 节点：目标

目标正文。
`.replace('[选项] 查看四周', '[选项] 查看四周 -> 节点：目标'));
    await switchToGraphLab(page);
    await page.evaluate(
      (fullId) => (window as TestWindow).__test_store__?.selectNode(fullId),
      createFullId('第一章', '目标'),
    );

    const titleInput = page.getByTestId('graph-inspector-node-title');
    await expect(titleInput).toHaveValue('目标', { timeout: 10_000 });
    await titleInput.fill('重命名目标');
    await blur(titleInput);

    await waitForContent(page, '## 节点：重命名目标');
    await waitForContent(page, '[选项] 查看四周 -> 节点：重命名目标');
    await waitForNoDiagnostic(page, 'E001');
  });

  test('keeps an Inspector draft and exposes a field error when a commit is rejected', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await page.evaluate((fullId) => (window as TestWindow).__test_store__?.selectNode(fullId), FIRST_START_ID);

    const titleInput = page.getByTestId('graph-inspector-node-title');
    await expect(titleInput).toHaveValue('起点');
    await titleInput.fill('');
    await blur(titleInput);

    await expect(titleInput).toHaveValue('');
    await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    await expect(titleInput.locator('xpath=..').getByRole('alert')).toBeVisible();
    expect(await getEditorContent(page)).toContain('## 节点：起点');

    await titleInput.fill('修复后的起点');
    await blur(titleInput);
    await waitForContent(page, '## 节点：修复后的起点');
    await expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');
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
    await page.evaluate(() => {
      const target = document.querySelector('.app-shell') ?? document.body;
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.body.style.userSelect = 'none';
    });

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    await expect(page.locator('.status-bar')).toContainText('保存失败', { timeout: 2_000 });
    await expect(page.locator('.status-bar')).toContainText('disk write rejected');
    await expect.poll(() => page.evaluate(() => ({
      selectedText: window.getSelection?.()?.toString() ?? '',
      userSelect: document.body.style.userSelect,
    }))).toEqual({ selectedText: '', userSelect: '' });
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

  test('supports roving keyboard navigation in the global editor tabs', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    const storyTab = page.getByTestId('graph-global-editor-tab-story');
    const variablesTab = page.getByTestId('graph-global-editor-tab-variables');
    const storyPanelId = await storyTab.getAttribute('aria-controls');
    const variablesPanelId = await variablesTab.getAttribute('aria-controls');

    expect(storyPanelId).toBeTruthy();
    expect(variablesPanelId).toBeTruthy();
    expect(storyPanelId).not.toBe(variablesPanelId);
    await expect(page.locator(`[id="${storyPanelId}"]`)).toHaveAttribute('aria-labelledby', await storyTab.getAttribute('id') ?? '');
    await expect(page.locator(`[id="${variablesPanelId}"]`)).toHaveAttribute('aria-labelledby', await variablesTab.getAttribute('id') ?? '');

    await storyTab.focus();
    await storyTab.press('ArrowRight');
    await expect(variablesTab).toHaveAttribute('aria-selected', 'true');
    await expect(variablesTab).toBeFocused();
    await expect(page.locator(`[id="${variablesPanelId}"]`)).toBeVisible();

    await variablesTab.press('ArrowLeft');
    await expect(storyTab).toHaveAttribute('aria-selected', 'true');
    await expect(storyTab).toBeFocused();

    await storyTab.press('End');
    await expect(variablesTab).toBeFocused();
    await variablesTab.press('Home');
    await expect(storyTab).toBeFocused();
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
    await expect(page.getByTestId('graph-lab-inspector')).toContainText('No node selected');
    await page.getByTestId('graph-global-editor-tab-story').click();
    await expect(page.getByTestId('graph-lab-global-editor')).toContainText('Story Info');

    await page.getByTestId('graph-lab-diagnostics-button').click();
    await expect(page.locator('.problem-panel')).toContainText('Problems');
    await expect(page.locator('.problem-panel')).toContainText('All');
    await expect(page.locator('.problem-panel')).toContainText('Syntax parsing failed');

    const exportTrigger = page.getByTestId('toolbar-export');
    await exportTrigger.click();
    await expect(page.locator('.export-dialog__overlay')).toContainText('Export story');
    await expect(page.locator('.export-dialog__overlay')).toContainText('Export format');
    const exportClose = page.locator('.export-dialog__overlay button[aria-label]').first();
    await expect(exportClose).toBeFocused();
    await page.keyboard.press('Control+E');
    await expect(page.locator('.export-dialog__overlay')).toHaveCount(0);
    await expect(exportTrigger).toBeFocused();

    await page.getByTestId('toolbar-theme-center').click();
    await expect(page.getByTestId('theme-center')).toContainText('Official Theme Center');
    await expect(page.getByTestId('theme-center')).toContainText('Installed official themes');
  });

  test('blocks export from Graph Lab when Error diagnostics exist', async () => {
    await setEditorContent(page, START_STORY.replace(
      '[选项] 查看四周',
      '[选项] 查看四周 -> 节点：不存在',
    ));
    await switchToGraphLab(page);

    await expect(page.getByTestId('graph-lab-diagnostics-button')).toHaveClass(/is-warning/);
    await page.getByTestId('toolbar-export').click();

    await expect(page.getByTestId('export-blocked-by-errors')).toBeVisible();
    await expect(page.getByTestId('export-dialog-submit')).toBeDisabled();
  });

  // Playwright requires an object-destructured first parameter when testInfo is used.
  // eslint-disable-next-line no-empty-pattern
  test('creates and exports a branch entirely from Graph Lab controls', async ({}, testInfo) => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    await page.getByTestId('graph-global-editor-tab-story').click();
    await page.getByTestId('graph-inspector-meta-engine').selectOption('godot');
    await waitForContent(page, 'engine: "godot"');

    await expect(page.locator('.react-flow__node').filter({ hasText: '起点' })).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('graph-lab-create-node').click();
    await waitForContent(page, '## 节点：新节点');
    await expect(page.getByTestId(`rf__node-${createFullId('第一章', '新节点')}`)).toBeVisible({ timeout: 10_000 });

    await clickNodeBody(page, '新节点');
    // M4: 新节点卡片可能因 DOM 事件委托/冒泡/Handle 拦截导致点击未触发选中。
    // 额外走 __test_store__.selectNode 程序化选中，确保 Inspector 一定拿到 node 上下文。
    await page.evaluate((fullId) => {
      (window as Window & { __test_store__?: { selectNode?: (id: string) => void } }).__test_store__?.selectNode?.(fullId);
    }, createFullId('第一章', '新节点'));
    const titleInput = page.getByTestId('graph-inspector-node-title');
    await expect(titleInput).toHaveValue('新节点', { timeout: 10_000 });
    await titleInput.fill('树林');
    await expect(titleInput).toHaveValue('树林');
    await blur(titleInput);
    await waitForContent(page, '## 节点：树林');

    const bodyInput = page.getByTestId('graph-inspector-node-body');
    await bodyInput.fill('树影挡住了小路。');
    await blur(bodyInput);
    await waitForContent(page, '树影挡住了小路。');

    await clickNodeBody(page, '起点');
    await page.evaluate((fullId) => {
      (window as Window & { __test_store__?: { selectNode?: (id: string) => void } }).__test_store__?.selectNode?.(fullId);
    }, FIRST_START_ID);
    await page.getByTestId('graph-inspector-option-target-0').selectOption(createFullId('第一章', '树林'));
    await waitForContent(page, '-> 第一章/节点：树林');

    const conditionTree = page.getByTestId('graph-inspector-condition-tree-0');
    const variableTrigger = conditionTree.getByTestId('condition-variable-dropdown-trigger').first();
    await variableTrigger.click();
    const variableMenu = page.getByTestId('condition-variable-dropdown-menu');
    await expect(variableMenu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(variableMenu).toHaveCount(0);
    await expect(variableTrigger).toBeFocused();

    await variableTrigger.click();
    await expect(variableMenu).toBeVisible();
    const menuOutsideConditionTree = await variableMenu.evaluate((menu) => {
      const tree = document.querySelector('[data-testid="graph-inspector-condition-tree-0"]');
      return Boolean(tree && !tree.contains(menu));
    });
    expect(menuOutsideConditionTree).toBe(true);
    const variableMenuBox = await variableMenu.boundingBox();
    expect(variableMenuBox).not.toBeNull();
    expect(variableMenuBox!.y).toBeGreaterThanOrEqual(0);
    expect(variableMenuBox!.y + variableMenuBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
    await variableMenu.getByRole('option', { name: /金币/ }).click();
    await expect(variableMenu).toHaveCount(0);

    await conditionTree.getByTestId('condition-operator-dropdown-trigger').first().click();
    const operatorMenu = page.getByTestId('condition-operator-dropdown-menu');
    await expect(operatorMenu).toBeVisible();
    await operatorMenu.getByRole('option', { name: /≥/ }).click();
    const conditionInput = conditionTree.locator('input[type="number"]');
    await variableTrigger.click();
    await expect(variableMenu).toBeVisible();
    await conditionInput.click();
    await expect(variableMenu).toHaveCount(0);
    await conditionInput.fill('1');
    await blur(conditionInput);
    await waitForContent(page, '  条件: $金币 >= 1');

    await page.getByTestId('graph-inspector-option-effect-operation-0').selectOption('subtract');
    await page.getByTestId('graph-inspector-option-effect-value-0').fill('1');
    await page.getByTestId('graph-inspector-option-effect-add-0').click();
    await waitForContent(page, '  效果: 金币-1');

    await page.getByTestId('graph-global-editor-tab-variables').click();
    await page.getByTestId('graph-inspector-variable-name').fill('日志');
    await page.getByTestId('graph-inspector-variable-type').selectOption('string');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  日志:\n    type: string');

    await page.getByTestId('graph-inspector-option-effect-variable-0').selectOption('日志');
    await page.getByTestId('graph-inspector-option-effect-operation-0').selectOption('append');
    const appendInput = page.getByTestId('graph-inspector-option-effect-value-0');
    await appendInput.fill('发现脚印');
    await appendInput.press('Enter');
    await waitForContent(page, '  效果: 金币-1, 日志←"发现脚印"');

    await page.getByTestId('graph-global-editor-tab-variables').click();
    await page.getByTestId('graph-inspector-variable-name').fill('声望');
    await page.getByTestId('graph-inspector-variable-type').selectOption('float');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  声望:\n    type: float');

    await page.getByTestId('graph-inspector-variable-name').fill('职业');
    await page.getByTestId('graph-inspector-variable-type').selectOption('enum');
    await page.getByTestId('graph-inspector-variable-enum-values').fill('战士\n法师');
    await page.getByTestId('graph-inspector-variable-default').selectOption('法师');
    await page.getByTestId('graph-inspector-variable-scope').selectOption('chapter');
    await page.getByTestId('graph-inspector-variable-chapter').selectOption('第一章');
    await page.getByTestId('graph-inspector-variable-description').fill('当前伪装职业');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  职业:\n    type: enum\n    values: ["战士","法师"]\n    default: "法师"\n    scope: chapter\n    chapter: "第一章"\n    description: "当前伪装职业"');

    await page.getByTestId('graph-inspector-variable-name').fill('已解锁');
    await page.getByTestId('graph-inspector-variable-type').selectOption('bool');
    await page.getByTestId('graph-inspector-variable-default').selectOption('true');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  已解锁:\n    type: bool\n    default: true');

    await page.getByTestId('graph-inspector-variable-name').fill('世界状态');
    await page.getByTestId('graph-inspector-variable-type').selectOption('object');
    await page.getByTestId('graph-inspector-variable-field-add-root').click();
    await page.getByTestId('graph-inspector-variable-field-name-root-0').fill('区域');
    await page.getByTestId('graph-inspector-variable-field-type-root-0').selectOption('object');
    await page.getByTestId('graph-inspector-variable-field-add-root-0').click();
    await page.getByTestId('graph-inspector-variable-field-name-root-0-0').fill('天气');
    await page.getByTestId('graph-inspector-variable-field-type-root-0-0').selectOption('object');
    await page.getByTestId('graph-inspector-variable-field-add-root-0-0').click();
    await page.getByTestId('graph-inspector-variable-field-name-root-0-0-0').fill('下雨');
    await page.getByTestId('graph-inspector-variable-field-type-root-0-0-0').selectOption('bool');
    await page.getByTestId('graph-inspector-variable-field-default-root-0-0-0').selectOption('true');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  世界状态:\n    type: object');
    await waitForContent(page, '              下雨:\n                type: bool\n                default: true');
    await attachVisibleScreenshot(
      testInfo,
      page.getByTestId('graph-lab-inspector'),
      'graph-lab-inspector-structured-variables.png',
    );

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
      $schema: string;
      meta: { engine: string };
      chapters: Array<{ nodes: Array<{ title: string; options: Array<{ targetNodeId: string | null }> }> }>;
      variables: Record<string, {
        type: string;
        default?: unknown;
        values?: string[];
        scope?: string;
        chapter?: string;
        description?: string;
        fields?: Record<string, unknown>;
      }>;
    };
    const nodes = json.chapters.flatMap((chapter) => chapter.nodes);
    expect(nodes.some((node) => node.title === '树林')).toBe(true);
    expect(nodes.some((node) => node.options.some((option) => option.targetNodeId === '树林'))).toBe(true);
    expect(json.$schema).toBe('https://plotflow.dev/schema/0.2/story.json');
    expect(json.meta.engine).toBe('godot');
    expect(Object.keys(json.variables)).toEqual(expect.arrayContaining(['金币', '日志', '声望', '职业', '已解锁', '世界状态']));
    expect(json.variables).toHaveProperty('声望');
    expect(json.variables['职业']).toMatchObject({
      type: 'enum',
      default: '法师',
      values: ['战士', '法师'],
      scope: 'chapter',
      chapter: '第一章',
      description: '当前伪装职业',
    });
    expect(json.variables['世界状态']).toMatchObject({
      type: 'object',
      default: { 区域: { 天气: { 下雨: true } } },
      fields: {
        区域: {
          type: 'object',
          fields: {
            天气: {
              type: 'object',
              fields: { 下雨: { type: 'bool', default: true } },
            },
          },
        },
      },
    });
  });

  test('round-trips three-level AND OR NOT and literal-left conditions through Graph GUI and JSON 0.2', async () => {
    await setEditorContent(page, `---
plotflow: 0.1
vars:
  金币: int
  存活: bool
---

# 第一章

## 节点：入口

[选项] 继续 -> 节点：出口
  条件: ($金币 >= 1) AND (NOT (($存活 == false) OR (5 < $金币)))

## 节点：出口

完成。
`);
    await switchToGraphLab(page);
    await page.evaluate(
      (fullId) => (window as TestWindow).__test_store__?.selectNode(fullId),
      createFullId('第一章', '入口'),
    );
    const conditionTree = page.getByTestId('graph-inspector-condition-tree-0');
    await expect(conditionTree).toBeVisible({ timeout: 10_000 });
    const leftOperandTypes = conditionTree.getByLabel('左操作数类型');
    const rightOperandTypes = conditionTree.getByLabel('右操作数类型');
    await expect(leftOperandTypes).toHaveCount(3);
    await expect(leftOperandTypes.last()).toHaveValue('literal');
    await expect(rightOperandTypes.last()).toHaveValue('variable');

    const literalInput = leftOperandTypes.last().locator('xpath=..').locator('input[type="number"]');
    await expect(literalInput).toHaveValue('5');
    await literalInput.fill('6');
    await blur(literalInput);
    await waitForContent(page, '($金币 >= 1) AND (NOT (($存活 == false) OR (6 < $金币)))');

    await page.getByTestId('toolbar-export').click();
    await expect(page.locator('.export-dialog__overlay')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('export-dialog-submit').click();
    await expect(page.getByTestId('export-dialog-submit')).toHaveAttribute('data-export-status', 'success', {
      timeout: 10_000,
    });

    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    const json = JSON.parse(captured!.content) as {
      $schema: string;
      chapters: Array<{
        nodes: Array<{
          id: string;
          options: Array<{ conditions: { ast: Record<string, unknown> } | null }>;
        }>;
      }>;
    };
    expect(json.$schema).toBe('https://plotflow.dev/schema/0.2/story.json');
    const ast = json.chapters[0]!.nodes.find((node) => node.id === '入口')!.options[0]!.conditions!.ast as {
      type: string;
      left: unknown;
      right: { type: string; operand: { type: string; left: unknown; right: unknown } };
    };
    expect(ast.type).toBe('logical_and');
    expect(ast.left).toMatchObject({
      type: 'comparison',
      left: { type: 'variable', name: '金币' },
      right: { type: 'literal', value: 1 },
    });
    expect(ast.right.type).toBe('logical_not');
    expect(ast.right.operand.type).toBe('logical_or');
    expect(ast.right.operand.right).toMatchObject({
      type: 'comparison',
      left: { type: 'literal', value: 6 },
      operator: '<',
      right: { type: 'variable', name: '金币' },
    });
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
    await expectDocumentDoesNotScroll(page);
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

    await page.getByTestId('graph-lab-workspace-browser').locator('summary').click();
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
    await page.getByTestId('graph-lab-workspace-browser').locator('summary').click();
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

  test('supports keyboard chapter tabs and node context menus with focus restoration', async () => {
    // The preceding Source Drawer guard intentionally leaves a stale local draft.
    // Reload the renderer so this keyboard contract starts from a clean component session.
    await reloadRenderer(page);
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);

    const tabs = page.getByTestId('graph-lab-chapter-tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toBeFocused();
    await expect.poll(() => page.evaluate(() => (
      (window as TestWindow).__test_store__?.getUIState().activeChapterId
    ))).toBe('第二章');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await tabs.nth(1).focus();
      await page.keyboard.press('Home');
      if (await tabs.first().getAttribute('aria-selected') === 'true') break;
      await page.waitForTimeout(100);
    }
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await expect(tabs.first()).toBeFocused();

    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    await node.click();
    await node.focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(node).toBeFocused();

    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const renameDialog = page.getByRole('dialog', { name: /重命名节点|rename node/i });
    await expect(renameDialog).toBeVisible();
    const renameInput = renameDialog.getByRole('textbox');
    await expect(renameInput).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(renameDialog.getByRole('button', { name: /确定|confirm/i })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(renameDialog).toHaveCount(0);
    await expect(node).toBeFocused();

    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const deleteDialog = page.getByRole('dialog', { name: /删除节点|delete node/i });
    await expect(deleteDialog).toBeVisible();
    const cancelDelete = deleteDialog.getByRole('button', { name: /取消|cancel/i });
    await expect(cancelDelete).toBeFocused();
    const beforeModalShortcut = await getEditorContent(page);
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+K');
    await page.keyboard.press('Control+E');
    await expect(deleteDialog).toBeVisible();
    await expect(page.locator('.export-dialog__overlay')).toHaveCount(0);
    expect(await getEditorContent(page)).toBe(beforeModalShortcut);
    await page.keyboard.press('Tab');
    await expect(deleteDialog.getByTestId('graph-confirm-primary')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(deleteDialog).toHaveCount(0);
    await expect(node).toBeFocused();

    const nodePoint = await nodeCenter(page, '起点');
    const blankPoint = await findBlankCanvasPoint(page, nodePoint);
    await page.mouse.click(nodePoint.x, nodePoint.y, { button: 'right' });
    await expect(menu).toBeVisible();
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(menu).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (
      (window as TestWindow).__test_store__?.getUIState().activeNodeId
    ))).toBeNull();

    await page.mouse.click(blankPoint.x, blankPoint.y, { button: 'right' });
    await expect(menu).toBeVisible();
    await page.mouse.click(nodePoint.x, nodePoint.y);
    await expect(menu).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (
      (window as TestWindow).__test_store__?.getUIState().activeNodeId
    ))).toBe(createFullId('第一章', '起点'));
  });

  test('dismisses an edge context menu with an outside primary click', async () => {
    await setEditorContent(page, `${START_STORY.replace('[选项] 查看四周', '[选项] 查看四周 -> 节点：终点')}

## 节点：终点

完成。`);
    await switchToGraphLab(page);

    const edgePath = page.locator('.react-flow__edge path').first();
    await expect(edgePath).toBeVisible({ timeout: 10_000 });
    const edgeBox = await edgePath.boundingBox();
    expect(edgeBox).not.toBeNull();
    await page.mouse.click(edgeBox!.x + edgeBox!.width / 2, edgeBox!.y + edgeBox!.height / 2, { button: 'right' });

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const blankPoint = await findBlankCanvasPoint(page, await nodeCenter(page, '起点'));
    await page.mouse.click(blankPoint.x, blankPoint.y);
    await expect(menu).toHaveCount(0);
  });

  test('drops an in-flight node drag when an external reload replaces the story session', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    await expect(node).toBeVisible({ timeout: 10_000 });
    const start = await nodeDragPoint(page, '起点');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 60, { steps: 5 });

    const reloaded = START_STORY.replace('Graph Lab E2E', 'External Reload E2E').replace('你醒来。', '外部重载正文。');
    await page.evaluate((content) => {
      (window as TestWindow).__test_store__?.applyExternalFileContent({
        filePath: 'D:/PlotFlowE2E/external-reload.mdstory',
        content,
        hash: 'external-reload-hash',
        modifiedAt: 42,
      });
    }, reloaded);
    await page.mouse.up();

    await waitForContent(page, '外部重载正文。');
    expect(await getEditorContent(page)).not.toContain('layout:');
    await expect(page.getByTestId('graph-lab-undo')).toBeDisabled();
    await expect(page.locator('.react-flow__node').filter({ hasText: '起点' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('persists node dragging into .mdstory layout data', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    const node = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    await expect(node).toBeVisible({ timeout: 10_000 });

    const before = await node.boundingBox();
    expect(before).not.toBeNull();
    const beforePosition = await page.evaluate((fullId) =>
      (window as TestWindow).__test_store__?.getGraphNodes?.().find((item) => item.id === fullId)?.position ?? null,
      FIRST_START_ID,
    );
    expect(beforePosition).not.toBeNull();
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
    const afterPosition = await page.evaluate((fullId) =>
      (window as TestWindow).__test_store__?.getGraphNodes?.().find((item) => item.id === fullId)?.position ?? null,
      FIRST_START_ID,
    );
    expect(afterPosition).not.toBeNull();
    expect(
      Math.abs(afterPosition!.x - beforePosition!.x) + Math.abs(afterPosition!.y - beforePosition!.y),
    ).toBeGreaterThan(30);

    const content = await getEditorContent(page);
    expect(content).toContain(`      - id: ${JSON.stringify(FIRST_START_ID)}`);

    await page.getByTestId('graph-lab-source-toggle').click();
    const sourceSlice = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(sourceSlice).toBeVisible();
    await sourceSlice.fill((await sourceSlice.inputValue()).replace('你醒来。', '未提交的拖动冲突草稿。'));
    await setEditorContentPreservingUI(
      page,
      (await getEditorContent(page)).replace('你醒来。', '磁盘侧更新后的正文。'),
    );
    await expect(page.locator('.source-drawer__slice-message')).toContainText('完整源码已在其他位置变化');

    const rollbackStart = await nodeDragPoint(page, '起点');
    await dragFromTo(page, rollbackStart, { x: rollbackStart.x + 90, y: rollbackStart.y + 60 });
    await expect.poll(async () => page.evaluate((fullId) =>
      (window as TestWindow).__test_store__?.getGraphNodes?.().find((item) => item.id === fullId)?.position ?? null,
      FIRST_START_ID,
    )).toEqual(afterPosition);
  });

  test('connects an option to an existing node by dragging a cable', async () => {
    await setEditorContent(page, `${START_STORY}

## 节点：树林

树影挡住了小路。
`);
    await switchToGraphLab(page);
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const handle = sourceNode.locator('.story-node-connect-handle').first();
    const sourceCenter = await nodeCenter(page, '起点');
    await expect(page.locator('.react-flow__node').filter({ hasText: '树林' })).toBeVisible({ timeout: 10_000 });
    const blankPoint = await findBlankCanvasPoint(page, sourceCenter);

    await dragHandleToMenu(page, handle, blankPoint);
    await page.getByTestId('wire-drop-connect-existing').filter({ hasText: '树林' }).click();
    await waitForContent(page, '[选项] 查看四周 -> 第一章/节点：树林');
  });

  test('opens a cable drop menu on blank space and creates a connected node there', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    const sourceNode = page.locator('.react-flow__node').filter({ hasText: '起点' }).first();
    const handle = sourceNode.locator('.story-node-connect-handle').first();
    const sourceCenter = await nodeCenter(page, '起点');
    const blankPoint = await findBlankCanvasPoint(page, sourceCenter);

    await startWirePreviewFromHandle(page, handle);
    await page.mouse.move(blankPoint.x, blankPoint.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);

    await dragHandleToMenu(page, handle, blankPoint);
    await page.getByTestId('wire-drop-create-node').click();

    await waitForContent(page, '[选项] 查看四周 -> 节点：新节点');
    const newNodeFullId = createFullId('第一章', '新节点');
    await waitForContent(page, `      - id: ${JSON.stringify(newNodeFullId)}`);
    await expect(page.getByTestId(`rf__node-${newNodeFullId}`)).toBeVisible({ timeout: 10_000 });
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

    await dragHandleToMenu(page, handle, blankPoint);
    await page.getByTestId('wire-drop-disconnect').click();

    await waitForContent(page, '[选项] 查看四周');
    const content = await getEditorContent(page);
    expect(content).not.toContain('[选项] 查看四周 -> 节点：树林');
  });

  test('commits a dirty Source Drawer draft before switching to Split', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await page.getByTestId('graph-lab-source-toggle').click();
    const source = page.getByTestId('graph-lab-chapter-source-slice');
    await expect(source).toBeVisible();
    await source.fill((await source.inputValue()).replace('你醒来。', '你在雨声中醒来。'));

    await page.getByTestId('workspace-mode-split').click();
    await expect(page.locator('.split-workspace')).toBeVisible();
    await waitForContent(page, '你在雨声中醒来。');
  });

  test('blocks Graph to Split when the Source Drawer draft is stale', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);
    await page.getByTestId('graph-lab-source-toggle').click();
    const source = page.getByTestId('graph-lab-chapter-source-slice');
    await source.fill((await source.inputValue()).replace('你醒来。', '本地草稿。'));
    await page.evaluate((content) => {
      (window as unknown as TestWindow).__test_store__?.setEditorContentPreservingUI(content);
    }, START_STORY.replace('你醒来。', '外部更新。'));
    await expect(page.locator('.source-drawer__slice-message')).toContainText(
      /完整源码已在其他位置变化|full source changed elsewhere/i,
    );

    await page.getByTestId('workspace-mode-split').click();
    await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
    await expect(page.locator('.split-workspace')).toHaveCount(0);
  });

  test('creates a palette node in the active second chapter', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    await page.getByTestId('graph-lab-chapter-tab').filter({ hasText: '第二章' }).click();
    await page.getByTestId('graph-lab-create-node').click();
    await waitForContent(page, '## 节点：新节点');

    const content = await getEditorContent(page);
    const secondChapter = content.indexOf('# 第二章');
    const newNode = content.lastIndexOf('## 节点：新节点');
    expect(secondChapter).toBeGreaterThan(-1);
    expect(newNode).toBeGreaterThan(secondChapter);
  });

  test('searches nodes with Ctrl+K and focuses the selected result without changing source', async () => {
    await setEditorContent(page, TWO_CHAPTER_STORY);
    await switchToGraphLab(page);
    const before = await getEditorContent(page);

    await page.keyboard.press('Control+K');
    const search = page.getByPlaceholder(/搜索标题、ID、正文或选项|search title, ID, body, or option/i);
    await expect(search).toBeFocused();
    await search.fill('终点');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('graph-lab-selection-label')).toContainText('终点');
    await expect.poll(() => page.evaluate(() => (
      (window as unknown as TestWindow).__test_store__?.getUIState().activeChapterId
    ))).toBe('第二章');
    expect(await getEditorContent(page)).toBe(before);
  });

  test('keeps the canvas first and exposes compact Palette and Inspector drawers', async () => {
    await setEditorContent(page, START_STORY);
    await switchToGraphLab(page);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1180, height: 720 },
      { width: 1179, height: 720 },
      { width: 901, height: 720 },
      { width: 900, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const paletteToggle = page.getByTestId('graph-lab-palette-toggle');
      if (viewport.width <= 900) {
        await expect(paletteToggle).toBeVisible();
        const box = await paletteToggle.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      } else {
        await expect(paletteToggle).toBeHidden();
        await expect(page.getByTestId('graph-lab-create-node')).toBeVisible();
      }
    }

    await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByTestId('graph-lab-palette-toggle')).toBeVisible();
    await page.getByTestId('graph-lab-palette-toggle').click();
    await expect(page.getByTestId('graph-lab-create-node')).toBeInViewport();

    const globalEditor = page.getByTestId('graph-lab-global-editor');
    await globalEditor.scrollIntoViewIfNeeded();
    await expect(globalEditor).toBeInViewport();
    const storyTitle = page.getByTestId('graph-inspector-meta-title');
    await storyTitle.fill('窄屏全局编辑');
    await blur(storyTitle);
    await waitForContent(page, 'title: "窄屏全局编辑"');

    const storyTab = page.getByTestId('graph-global-editor-tab-story');
    await storyTab.focus();
    await storyTab.press('ArrowRight');
    const variableName = page.getByTestId('graph-inspector-variable-name');
    await variableName.scrollIntoViewIfNeeded();
    await expect(variableName).toBeInViewport();
    await variableName.fill('窄屏变量');
    await page.getByTestId('graph-inspector-save-variable').click();
    await waitForContent(page, '  窄屏变量:');

    await page.getByTestId('graph-lab-inspector-toggle').click();
    await expect(page.getByTestId('graph-lab-inspector')).toBeInViewport();
    await expect(page.getByTestId('graph-lab-create-node')).not.toBeInViewport();

    await page.getByTestId('graph-lab-source-toggle').click();
    await expect(page.getByTestId('graph-lab-chapter-source-slice')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('shows tagged system-open failures with their path and error code', async () => {
    const failedPath = 'D:/PlotFlowE2E/missing-system-open.mdstory';
    await electronApp.evaluate(({ BrowserWindow }, payload) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(payload.channel, payload.result);
    }, {
      channel: IPC_CHANNELS.file.systemOpenNotify,
      result: { status: 'error' as const, path: failedPath, code: 'ENOENT' },
    });

    const status = page.locator('.status-bar');
    await expect(status).toContainText(failedPath, { timeout: 10_000 });
    await expect(status).toContainText('ENOENT');
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
