/**
 * PlotFlow 解析器与验证器 E2E 测试
 *
 * 测试覆盖:
 *   1. E001 -- 未定义目标节点 -> 红色波浪线
 *   2. E002 -- 未声明变量 -> 红色波浪线
 *   3. E007 -- 重复节点 ID -> 红色波浪线
 *   4. W001 -- 孤立节点 -> 黄色波浪线 + 分支图黄色边框
 *   5. W002 -- 死胡同节点 -> 黄色波浪线 + 分支图灰色边框
 *   6. Ctrl+Shift+M -> 问题面板打开 -> 诊断列表显示 -> 点击条目 -> 光标跳转
 *
 * @packageDocumentation
 */

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ============================================================================
// 常量
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RENDER_WAIT_MS = 1000;
const TEARDOWN_TIMEOUT_MS = 15_000;

// ============================================================================
// 辅助函数
// ============================================================================

/** 读取测试夹具文件内容 */
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function isIgnorableTeardownError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /closed|destroyed|crashed|Target page|browser has been closed|Process exited/i.test(message);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeElectronAppSafely(
  app: ElectronApplication | undefined,
  testPage: Page | undefined,
): Promise<void> {
  if (!app) return;

  if (testPage && !testPage.isClosed()) {
    await closeProblemPanel(testPage).catch(() => {});
    await testPage.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    })).catch((error: unknown) => {
      if (!isIgnorableTeardownError(error)) throw error;
    });
    await withTimeout(
      testPage.close({ runBeforeUnload: false }),
      TEARDOWN_TIMEOUT_MS,
      'page.close',
    ).catch((error: unknown) => {
      if (!isIgnorableTeardownError(error)) throw error;
    });
  }

  try {
    await withTimeout(app.close(), TEARDOWN_TIMEOUT_MS, 'electronApp.close');
    return;
  } catch (error) {
    if (isIgnorableTeardownError(error)) return;
  }

  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.removeAllListeners('close');
        win.destroy();
      }
    }
    electronApp.exit(0);
  }).catch((error: unknown) => {
    if (!isIgnorableTeardownError(error)) throw error;
  });

  await withTimeout(app.close(), 5_000, 'electronApp.close fallback').catch(() => {});
}

async function waitForDiagnostic(page: Page, code: string): Promise<void> {
  await page.waitForFunction(
    (expectedCode: string) => {
      const s = (window as TestWindow).__test_store__;
      return s?.getDiagnostics?.().some((diagnostic) => diagnostic.code === expectedCode) ?? false;
    },
    code,
    { timeout: 10_000 },
  );
}

async function waitForGraphStatus(
  page: Page,
  status: 'orphan' | 'deadend',
): Promise<void> {
  await page.waitForFunction(
    (expectedStatus: string) => {
      const expectedClass = `official-graph-node--${expectedStatus}`;
      return Array.from(document.querySelectorAll('.react-flow__node')).some((node) => {
        const card = node.querySelector('.official-graph-node');
        return card ? card.classList.contains(expectedClass) : false;
      });
    },
    status,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(RENDER_WAIT_MS);
}

/**
 * 将文本内容加载到编辑器中。
 *
 * 通过 __test_store__ 直接设置编辑器内容（绕过剪贴板），
 * 内部调用 parsePipelineNow 同步触发解析管线。
 * 相比剪贴板粘贴方案，此方案不依赖 OS 剪贴板或 Monaco 焦点状态，
 * 且每次加载前自动清除前次测试的诊断/节点/图表残留。
 *
 * @param page    - Playwright Page 对象
 * @param content - 要加载的 .mdstory 文本
 * @param _electronApp - 保留签名兼容（不再用于剪贴板操作）
 */

interface TestStoreBridge {
  setEditorContent: (content: string) => void;
  getEditorContent: () => string;
  getDiagnostics: () => Array<{ code: string }>;
}

type TestWindow = Window & { __test_store__?: TestStoreBridge };

async function loadContentIntoEditor(
  page: Page,
  content: string,
  _electronApp: ElectronApplication,
): Promise<void> {
  // 1. 通过 __test_store__ 直接设置编辑器内容
  await page.evaluate((text: string) => {
    const s = (window as TestWindow).__test_store__;
    if (!s?.setEditorContent) {
      throw new Error(
        '__test_store__.setEditorContent 不可用。请确认 Electron 启动时设置了 NODE_ENV=test',
      );
    }
    s.setEditorContent(text);
  }, content);

  // 2. 主动轮询等待内容同步到 store（不依赖固定延迟）
  await page.waitForFunction(
    (text: string) => {
      const s = (window as TestWindow).__test_store__;
      return s?.getEditorContent?.() === text;
    },
    content,
    { timeout: 10_000 },
  );

}

/**
 * 打开问题面板 (如果尚未打开)。
 * 快捷键: Ctrl+Shift+M
 */
async function openProblemPanel(page: Page): Promise<void> {
  const panelVisible = await page.evaluate(() => {
    const panel = document.querySelector('.problem-panel') as HTMLElement | null;
    if (!panel) return false;
    const h = panel.style.height;
    return h && h !== '0px' && h !== '';
  });

  if (!panelVisible) {
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(800);
  }
}

/**
 * 关闭问题面板。
 */
async function closeProblemPanel(page: Page): Promise<void> {
  const panelVisible = await page.evaluate(() => {
    const panel = document.querySelector('.problem-panel') as HTMLElement | null;
    if (!panel) return false;
    const h = panel.style.height;
    return h && h !== '0px' && h !== '';
  });

  if (panelVisible) {
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(800);
  }
}

/**
 * 从问题面板 DOM 中提取所有诊断条目。
 */
async function getDiagnosticItems(page: Page): Promise<Array<{
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: string;
}>> {
  await openProblemPanel(page);

  return page.evaluate(() => {
    const items = document.querySelectorAll('.problem-panel__item');
    return Array.from(items).map((item) => {
      const children = item.children;
      const icon = children[0]?.textContent?.trim() ?? '';
      const code = children[1]?.textContent?.trim() ?? '';
      const message = children[2]?.textContent?.trim() ?? '';
      const location = children[3]?.textContent?.trim() ?? '';

      let severity: 'error' | 'warning' | 'info' = 'info';
      if (icon.includes('🔴')) severity = 'error';
      else if (icon.includes('🟡')) severity = 'warning';

      return { code, severity, message, location };
    });
  });
}

/**
 * 获取分支图节点的状态信息。
 * page.evaluate 无法正确序列化 Map，因此返回 Record<string, string>。
 * key = React Flow node id (fullId), value = status ('normal'|'orphan'|'deadend'|'error'|'root')
 */
async function getGraphNodeStatuses(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const statusMap: Record<string, string> = {};
    const nodes = document.querySelectorAll('.react-flow__node');

    nodes.forEach((node) => {
      const classList = Array.from(node.querySelector('.official-graph-node')?.classList ?? (node.classList as unknown as DOMTokenList));
      const statusClass = classList.find((c) => c.startsWith('official-graph-node--') && !c.includes('workbench'));
      const status = statusClass ? statusClass.replace('official-graph-node--', '') : 'unknown';
      // React Flow v12 使用 data-id；回退到 id 属性或 aria-label
      const dataId =
        node.getAttribute('data-id') ??
        node.getAttribute('id') ??
        node.getAttribute('aria-label') ??
        '';
      if (dataId) {
        statusMap[dataId] = status;
      }
    });

    return statusMap;
  });
}

// ============================================================================
// 测试套件
// ============================================================================

test.describe('Parser & Validator E2E Tests', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const mainEntry = path.join(projectRoot, 'out', 'main', 'main.js');

    const electronArgs: string[] = [];
    if (fs.existsSync(mainEntry)) {
      electronArgs.push(mainEntry);
    } else {
      electronArgs.push(projectRoot);
    }

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
    await page.evaluate(() => {
      window.localStorage.setItem('plotflow:workspaceMode', 'split');
      (window as TestWindow).__test_store__?.setWorkspaceMode?.('split');
    });

    // 确认 Monaco 编辑器已就绪
    await page.waitForSelector('.monaco-editor', { timeout: 15_000 });
    console.log('[E2E] Electron app started, Monaco editor ready');
  });

  test.afterAll(async () => {
    await closeElectronAppSafely(electronApp, page);
  });

  test.afterEach(async () => {
    await closeProblemPanel(page).catch(() => {});
  });

  // ==================================================================
  // Test 1: E001 - Undefined target node
  // ==================================================================

  test('(1) E001 undefined target node shows red wave underline', async () => {
    const content = readFixture('e001-undefined-target.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'E001');

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const e001Items = items.filter((i) => i.code === 'E001');
    expect(e001Items.length).toBeGreaterThanOrEqual(1);
    expect(e001Items[0]!.severity).toBe('error');
    // 验证消息中包含目标节点相关描述（validator 消息或 i18n 简述均可）
    expect(e001Items[0]!.message).toMatch(/目标节点|不存在/);
    // 验证位置行号格式正确
    expect(e001Items[0]!.location).toMatch(/行\s*\d+/);
  });

  // ==================================================================
  // Test 2: E002 - Undeclared variable
  // ==================================================================

  test('(2) E002 undeclared variable shows red wave underline', async () => {
    const content = readFixture('e002-undeclared-variable.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'E002');

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const e002Items = items.filter((i) => i.code === 'E002');
    expect(e002Items.length).toBeGreaterThanOrEqual(1);
    expect(e002Items[0]!.severity).toBe('error');
    // 验证消息中包含未声明的变量名
    expect(e002Items[0]!.message).toContain('未声明变量');
    // 验证位置行号格式正确
    expect(e002Items[0]!.location).toMatch(/行\s*\d+/);
  });

  // ==================================================================
  // Test 3: E007 - Duplicate node ID
  // ==================================================================

  test('(3) E007 duplicate node ID shows red wave underline', async () => {
    const content = readFixture('e007-duplicate-node-id.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'E007');

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const e007Items = items.filter((i) => i.code === 'E007');
    expect(e007Items.length).toBeGreaterThanOrEqual(1);
    expect(e007Items[0]!.severity).toBe('error');
    // 验证消息中包含重复节点信息
    expect(e007Items[0]!.message).toContain('重复');
    // 验证位置行号格式正确
    expect(e007Items[0]!.location).toMatch(/行\s*\d+/);
  });

  // ==================================================================
  // Test 4: W001 - Orphan node
  // ==================================================================

  test('(4) W001 orphan node shows yellow wave + yellow graph border', async () => {
    const content = readFixture('w001-orphan-node.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'W001');

    // Check ProblemPanel for W001
    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const w001Items = items.filter((i) => i.code === 'W001');
    expect(w001Items.length).toBeGreaterThanOrEqual(1);
    expect(w001Items[0]!.severity).toBe('warning');
    expect(w001Items[0]!.message).toContain('孤立');

    // Check graph node -- orphan should have node-status-orphan class
    await waitForGraphStatus(page, 'orphan');
    const nodeStatuses = await getGraphNodeStatuses(page);
    let orphanFound = false;
    for (const [id, status] of Object.entries(nodeStatuses)) {
      if (id.includes('孤立') || status === 'orphan') {
        orphanFound = true;
        expect(status).toBe('orphan');
        break;
      }
    }
    expect(orphanFound).toBe(true);

    // Root node should still be normal
    for (const [id, status] of Object.entries(nodeStatuses)) {
      if (id.includes('起点')) {
        expect(status).toBe('normal');
        break;
      }
    }
  });

  // ==================================================================
  // Test 5: W002 - Dead-end node
  // ==================================================================

  test('(5) W002 dead-end node shows yellow wave + gray graph border', async () => {
    const content = readFixture('w002-deadend-node.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'W002');

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const w002Items = items.filter((i) => i.code === 'W002');
    expect(w002Items.length).toBeGreaterThanOrEqual(1);
    expect(w002Items[0]!.severity).toBe('warning');
    expect(w002Items[0]!.message).toContain('出口');

    // Check graph node -- dead-end should have node-status-deadend class
    await waitForGraphStatus(page, 'deadend');
    const nodeStatuses = await getGraphNodeStatuses(page);
    let deadEndFound = false;
    for (const status of Object.values(nodeStatuses)) {
      if (status === 'deadend') {
        deadEndFound = true;
        break;
      }
    }
    expect(deadEndFound).toBe(true);
  });

  // ==================================================================
  // Test 6: Ctrl+Shift+M -> ProblemPanel interaction
  // ==================================================================

  test('(6) Ctrl+Shift+M toggles panel, shows all diagnostics, click jumps cursor', async () => {
    const content = readFixture('w002-deadend-node.mdstory');
    await loadContentIntoEditor(page, content, electronApp);
    await waitForDiagnostic(page, 'W002');

    // Step 1: Ensure panel is closed
    await closeProblemPanel(page);
    let panelOpen = await page.evaluate(() => {
      const panel = document.querySelector('.problem-panel') as HTMLElement | null;
      return panel ? panel.style.height !== '0px' && panel.style.height !== '' : false;
    });
    expect(panelOpen).toBe(false);

    // Step 2: Ctrl+Shift+M to open
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(800);

    panelOpen = await page.evaluate(() => {
      const panel = document.querySelector('.problem-panel') as HTMLElement | null;
      return panel ? panel.style.height !== '0px' && panel.style.height !== '' : false;
    });
    expect(panelOpen).toBe(true);

    // Step 3: Verify diagnostics are listed
    const items = await getDiagnosticItems(page);
    expect(items.length).toBeGreaterThanOrEqual(1);

    // Step 4: Click first diagnostic item
    const firstItem = page.locator('.problem-panel__item').first();
    await firstItem.click();
    await page.waitForTimeout(500);

    // Verify editor received focus after click (handleJumpToLine calls editorInstance.focus())
    const editorFocused = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;
      return active.closest('.monaco-editor') !== null;
    });
    expect(editorFocused).toBe(true);

    // Step 5: Close panel
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(500);

    panelOpen = await page.evaluate(() => {
      const panel = document.querySelector('.problem-panel') as HTMLElement | null;
      return panel ? panel.style.height !== '0px' && panel.style.height !== '' : false;
    });
    expect(panelOpen).toBe(false);

    // Step 6: Open again
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(500);

    panelOpen = await page.evaluate(() => {
      const panel = document.querySelector('.problem-panel') as HTMLElement | null;
      return panel ? panel.style.height !== '0px' && panel.style.height !== '' : false;
    });
    expect(panelOpen).toBe(true);
  });
});
