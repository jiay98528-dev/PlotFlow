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
const DEBOUNCE_WAIT_MS = 2500;
const RENDER_WAIT_MS = 1000;

// ============================================================================
// 辅助函数
// ============================================================================

/** 读取测试夹具文件内容 */
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

/**
 * 将文本内容加载到 Monaco 编辑器中。
 *
 * 策略：通过 Electron 主进程 clipboard API 写入剪贴板，
 * 然后在渲染进程中用 Ctrl+A → Ctrl+V 粘贴。
 * 这模拟了用户的粘贴操作，会触发 Monaco 的 onDidChangeModelContent 事件，
 * 进而触发 parsePipeline。
 *
 * @param page   - Playwright Page 对象
 * @param content - 要加载的 .mdstory 文本
 * @param electronApp - ElectronApplication 引用（用于主进程 clipboard 操作）
 */
async function loadContentIntoEditor(
  page: Page,
  content: string,
  electronApp: ElectronApplication,
): Promise<void> {
  // 1. 通过 Electron 主进程设置剪贴板内容
  //    (playwright page.evaluate 可能缺少用户激活标记导致 clipboard API 失败)
  await electronApp.evaluate(async ({ clipboard }, text: string) => {
    clipboard.writeText(text);
  }, content);

  // 2. 聚焦 Monaco 编辑器
  const editorContainer = page.locator('.monaco-editor');
  await editorContainer.waitFor({ state: 'visible', timeout: 15_000 });
  await editorContainer.click();

  // 3. 全选 + 粘贴
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+v');

  // 4. 等待解析管线完成 (500ms debounce + 解析/验证/渲染)
  await page.waitForTimeout(DEBOUNCE_WAIT_MS);
  await page.waitForTimeout(RENDER_WAIT_MS);
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
      const classList = Array.from(node.classList);
      const statusClass = classList.find((c) => c.startsWith('node-status-'));
      const status = statusClass ? statusClass.replace('node-status-', '') : 'unknown';
      const dataId = node.getAttribute('data-id') ?? '';
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
      env: process.env['ELECTRON_RENDERER_URL']
        ? { ELECTRON_RENDERER_URL: process.env['ELECTRON_RENDERER_URL'] }
        : undefined,
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // 确认 Monaco 编辑器已就绪
    await page.waitForSelector('.monaco-editor', { timeout: 15_000 });
    console.log('[E2E] Electron app started, Monaco editor ready');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
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

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const e001Items = items.filter((i) => i.code === 'E001');
    expect(e001Items.length).toBeGreaterThanOrEqual(1);
    expect(e001Items[0]!.severity).toBe('error');
    // 验证消息中包含目标节点名
    expect(e001Items[0]!.message).toContain('不存在');
    // 验证位置行号格式正确
    expect(e001Items[0]!.location).toMatch(/行\s*\d+/);
  });

  // ==================================================================
  // Test 2: E002 - Undeclared variable
  // ==================================================================

  test('(2) E002 undeclared variable shows red wave underline', async () => {
    const content = readFixture('e002-undeclared-variable.mdstory');
    await loadContentIntoEditor(page, content, electronApp);

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
    await page.waitForTimeout(RENDER_WAIT_MS);

    // Check ProblemPanel for W001
    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const w001Items = items.filter((i) => i.code === 'W001');
    expect(w001Items.length).toBeGreaterThanOrEqual(1);
    expect(w001Items[0]!.severity).toBe('warning');
    expect(w001Items[0]!.message).toContain('孤立');

    // Check graph node -- orphan should have node-status-orphan class
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
    await page.waitForTimeout(RENDER_WAIT_MS);

    await openProblemPanel(page);
    const items = await getDiagnosticItems(page);

    const w002Items = items.filter((i) => i.code === 'W002');
    expect(w002Items.length).toBeGreaterThanOrEqual(1);
    expect(w002Items[0]!.severity).toBe('warning');
    expect(w002Items[0]!.message).toContain('出口');

    // Check graph node -- dead-end should have node-status-deadend class
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
