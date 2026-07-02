/**
 * 导出系统 E2E 测试 (M4)
 *
 * @description
 * 五项测试用例覆盖导出对话框快捷键/格式选择/三格式内容验证/菜单触发。
 *
 * 运行前置条件：
 * 1. 构建应用: `pnpm build` (electron-vite build)
 * 2. 安装 Playwright: `pnpm add -D @playwright/test && npx playwright install`
 * 3. 运行测试: `npx playwright test packages/app/e2e/export.e2e.spec.ts`
 *
 * 测试用例：
 *   TC-1: Ctrl+E → 验证导出对话框打开并显示格式选择
 *   TC-2: 导出 JSON → 验证文件保存 → 读回验证有效 JSON 结构
 *   TC-3: 导出 HTML → 验证文件保存 → 验证自包含无外部依赖
 *   TC-4: 导出 TXT → 验证文件保存 → 验证无 Markdown 语法残留
 *   TC-5: 通过菜单导出(导出>导出JSON) → 验证与快捷键相同
 *
 * @module e2e/export
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import * as path from 'path';

// ============================================================================
// 常量
// ============================================================================

/** 项目根目录 (PlotFlow/) */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Electron 主进程入口脚本（electron-vite build 输出） */
const MAIN_SCRIPT = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');

/**
 * IPC 通道名称 — 与 main.ts 中注册的 ipcMain.handle('file:export') 一致
 * @see packages/app/src-electron/main.ts L127
 */
const IPC_EXPORT_CHANNEL = 'file:export';

interface CapturedExport {
  content: string;
  format: string;
  timestamp: number;
}

type CaptureGlobal = typeof globalThis & { __e2e_capture?: CapturedExport | null };

// ============================================================================
// 测试夹具级变量（每个 describe 共享）
// ============================================================================

let electronApp: ElectronApplication;
let window: Page;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 在主进程侧拦截 file:export IPC 处理器，捕获导出内容并绕过原生保存对话框。
 *
 * 捕获的导出内容通过 `globalThis.__e2e_capture` 暂存，
 * 测试代码通过 readCapturedExport() 读取。
 */
async function mockExportIpcHandler(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }, channel: string) => {
    // 移除 main.ts 中注册的真实处理器
    ipcMain.removeHandler(channel);
    // 注册模拟处理器：捕获内容 + 返回假路径（绕过 dialog.showSaveDialog）
    ipcMain.handle(channel, async (_event, payload) => {
      const ext = payload.filters?.[0]?.extensions?.[0] ?? 'txt';
      // 存储捕获的导出内容（供测试读取）
      (globalThis as CaptureGlobal).__e2e_capture = {
        content: String(payload.content ?? ''),
        format: payload.filters?.[0]?.name ?? ext,
        timestamp: Date.now(),
      };
      return { filePath: `/e2e-mock/export.${ext}` };
    });
  }, IPC_EXPORT_CHANNEL);
}

/**
 * 读取 main 进程中暂存的导出捕获数据。
 * 每次读取后清除，避免跨测试脏数据。
 */
async function readCapturedExport(app: ElectronApplication): Promise<{
  content: string;
  format: string;
  timestamp: number;
} | null> {
  const result = await app.evaluate(() => {
    const cap = (globalThis as CaptureGlobal).__e2e_capture;
    (globalThis as CaptureGlobal).__e2e_capture = null;
    return cap ?? null;
  });
  return result;
}

/**
 * 通过模板系统加载 RPG 对话故事。
 *
 * 操作流程：
 * 1. 点击顶部工具栏"新建"按钮 → 打开 NewFileDialog
 * 2. 默认已选中 "RPG 对话" 模板（rpg-dialogue）
 * 3. 点击"创建"按钮 → 模板内容写入编辑器并触发解析管线
 */
async function loadRpgTemplate(page: Page): Promise<void> {
  // 等待应用和 Monaco 编辑器完全初始化
  await page.waitForSelector('.app-shell', { timeout: 20000 });
  await page.getByTestId('workspace-mode-split').click();
  await page.waitForSelector('.split-workspace', { timeout: 10000 });
  await page.waitForSelector('.editor-pane .monaco-editor', { timeout: 20000 });
  await page.waitForTimeout(500);

  // 点击顶部工具栏"新建"按钮 (.app-topbar .button--primary)
  await page.locator('.app-topbar .button--primary').click();

  // 等待 NewFileDialog 打开
  await page.waitForSelector('.new-file-dialog', { timeout: 5000 });
  await page.waitForTimeout(300);

  // 默认 "RPG 对话" 模板已选中，直接点击"创建"按钮
  // 注意：创建按钮在 dialog footer 中，也是 .button--primary
  const titleInput = page.locator('.new-file-dialog__sidebar .form-field').first().locator('input');
  await expect(titleInput).toBeVisible({ timeout: 2000 });
  await titleInput.fill('RPG 对话');
  await page.waitForTimeout(100);
  await page.locator('.new-file-dialog__footer .button--primary').click();

  // 等对话框关闭、编辑器内容更新、解析管线完成
  await page.waitForSelector('.new-file-dialog', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2000);
}

/**
 * 关闭导出对话框（Escape 键）。
 */
async function closeExportDialog(page: Page): Promise<void> {
  const overlay = page.locator('.export-dialog__overlay');
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    const closedByEscape = await overlay.waitFor({ state: 'hidden', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (closedByEscape) return;

    const closeBtn = overlay.locator('button[title="关闭导出对话框"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true, timeout: 1000 }).catch(() => {});
    } else {
      const cancelBtn = overlay.locator('button').filter({ hasText: '取消' }).first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click({ force: true, timeout: 1000 }).catch(() => {});
      }
    }

    await overlay.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

/**
 * 打开导出对话框（Ctrl+E），等待就绪。
 */
async function openExportDialog(page: Page): Promise<void> {
  await page.keyboard.press('Control+KeyE');
  await page.waitForSelector('.export-dialog__overlay', { timeout: 5000 });
  // 等动画完成
  await page.waitForTimeout(300);
}

/**
 * 选择导出格式。
 */
async function selectFormat(page: Page, format: 'json' | 'html' | 'txt'): Promise<void> {
  await page.locator(`input[name="export-format"][value="${format}"]`).check({ force: true });
  await page.waitForTimeout(200);
}

/**
 * 点击"导出"按钮并等待导出操作完成。
 * 成功状态通过稳定状态属性暴露，避免受 UI 语言或文案调整影响。
 */
async function clickExportAndWait(page: Page): Promise<void> {
  const exportBtn = page.getByTestId('export-dialog-submit');
  await exportBtn.click();

  await expect(exportBtn).toHaveAttribute('data-export-status', 'success', { timeout: 10000 });

  // 给自动关闭 timer 一点时间（ExportDialog setTimeout 1.5s 后自动关闭）
  await page.waitForTimeout(500);
}

// ============================================================================
// 测试套件
// ============================================================================

test.describe('导出系统 E2E (M4) — 5 项测试用例', () => {
  // ==========================================================================
  // Setup / Teardown
  // ==========================================================================

  test.beforeAll(async () => {
    // 启动 Electron 应用（指向 electron-vite build 输出的主进程入口）
    electronApp = await electron.launch({
      args: [MAIN_SCRIPT],
    });

    window = await electronApp.firstWindow();

    // 拦截导出 IPC，捕获内容 + 绕过原生对话框
    await mockExportIpcHandler(electronApp);

    // 加载 RPG 故事模板作为测试数据
    await loadRpgTemplate(window);

    // 验证模板已加载：检查状态栏包含 "新建" 字样
    await expect(window.locator('.status-bar')).toContainText('新建');
  });

  test.afterAll(async () => {
    if (!electronApp) return;

    try {
      await electronApp.evaluate(({ BrowserWindow }) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.removeAllListeners('close');
            win.destroy();
          }
        }
      });
    } catch {
      // ignore teardown errors
    }

    try {
      await electronApp.close();
    } catch {
      // ignore teardown errors
    }
  });

  test.beforeEach(async () => {
    // 每个用例前确保导出对话框是关闭的
    await closeExportDialog(window);
  });

  // ==========================================================================
  // TC-1: Ctrl+E 打开导出对话框并显示格式选择
  // ==========================================================================

  test('TC-1: Ctrl+E → 导出对话框打开并显示三种格式', async () => {
    // Act: 按 Ctrl+E
    await openExportDialog(window);

    // Assert: 对话框可见
    const dialog = window.locator('.export-dialog__overlay');
    await expect(dialog).toBeVisible();

    // Assert: 标题包含"导出故事"
    await expect(dialog).toContainText('导出故事');

    // Assert: 三种格式选项可见
    const formatJson = dialog.locator('input[name="export-format"][value="json"]');
    const formatHtml = dialog.locator('input[name="export-format"][value="html"]');
    const formatTxt = dialog.locator('input[name="export-format"][value="txt"]');
    await expect(formatJson).toBeVisible();
    await expect(formatHtml).toBeVisible();
    await expect(formatTxt).toBeVisible();

    // Assert: 默认选中 JSON（第一个选项）
    await expect(formatJson).toBeChecked();

    // Assert: 显示默认文件名 (标题 + .json)
    await expect(dialog).toContainText(/RPG 对话.*\.json/i);
  });

  // ==========================================================================
  // TC-2: 导出 JSON → 验证有效 JSON 结构
  // ==========================================================================

  test('TC-2: 导出 JSON → 读回验证有效 JSON 结构', async () => {
    // Arrange: 打开对话框，确保选中 JSON
    await openExportDialog(window);
    await selectFormat(window, 'json');

    // Act: 点击导出
    await clickExportAndWait(window);

    // Assert: 读取捕获的导出内容
    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    expect(captured!.format).toBe('JSON');

    // Assert: 内容是有效 JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(captured!.content) as Record<string, unknown>;
    } catch {
      throw new Error('导出内容不是有效 JSON');
    }

    // Assert: JSON 包含必需顶层字段
    expect(parsed).toHaveProperty('$schema');
    expect(parsed).toHaveProperty('meta');
    expect(parsed).toHaveProperty('variables');
    expect(parsed).toHaveProperty('chapters');

    // Assert: meta 包含必要信息
    const meta = parsed['meta'] as Record<string, unknown>;
    expect(meta['title']).toBe('RPG 对话');
    expect(meta['plotflow']).toBe('0.1');
    expect(meta).toHaveProperty('exportedAt'); // 自动填充的时间戳

    // Assert: variables 包含三个变量
    const vars = parsed['variables'] as Record<string, unknown>;
    expect(vars).toHaveProperty('信任度');
    expect(vars).toHaveProperty('金币');
    expect(vars).toHaveProperty('阵营');

    // Assert: chapters 非空
    const chapters = parsed['chapters'] as unknown[];
    expect(chapters.length).toBeGreaterThan(0);

    // Assert: 首章首节点是根节点（isRoot: true）
    const firstChapter = chapters[0] as Record<string, unknown>;
    const nodes = firstChapter['nodes'] as unknown[];
    const firstNode = nodes[0] as Record<string, unknown>;
    expect(firstNode['isRoot']).toBe(true);
    expect(firstNode['title']).toContain('村口');
  });

  // ==========================================================================
  // TC-3: 导出 HTML → 验证自包含无外部依赖
  // ==========================================================================

  test('TC-3: 导出 HTML → 验证自包含（DOCTYPE / 内嵌 CSS / 内嵌 JS）', async () => {
    // Arrange
    await openExportDialog(window);
    await selectFormat(window, 'html');

    // Act
    await clickExportAndWait(window);

    // Assert: 读取捕获内容
    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    expect(captured!.format).toBe('HTML');

    const html = captured!.content;

    // Assert: HTML 文档结构
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');

    // Assert: 自包含 — 无外部 CSS/JS 引用
    // 不允许有 <link href="..."> 外部样式表
    expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
    // 不允许有 <script src="..."> 外部脚本
    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    // 不允许有 @import url() 外部 CSS
    expect(html).not.toMatch(/@import\s+url\(["']?https?:\/\//i);

    // Assert: 内嵌 CSS（<style> 标签）
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    // CSS 中包含响应式设计特征
    expect(html).toContain('@media');

    // Assert: 内嵌 JS（<script> 标签包含运行时引擎）
    expect(html).toContain('<script>');
    expect(html).toContain('</script>');
    // JS 引擎包含核心函数
    expect(html).toContain('function evalCond');
    expect(html).toContain('function applyEffects');
    expect(html).toContain('function render');

    // Assert: 运行时数据已嵌入 HTML（STORY 变量）
    expect(html).toContain('var STORY =');
    // 运行时数据包含故事标题
    expect(html).toContain('RPG 对话');

    // Assert: 移动端 viewport meta
    expect(html).toContain('name="viewport"');
    expect(html).toContain('maximum-scale=1.0');

    // Assert: 暗色主题背景色
    expect(html).toContain('#0d1117');
  });

  // ==========================================================================
  // TC-4: 导出 TXT → 验证无 Markdown 语法残留
  // ==========================================================================

  test('TC-4: 导出 TXT → 验证纯文本无 Markdown 语法残留', async () => {
    // Arrange
    await openExportDialog(window);
    await selectFormat(window, 'txt');

    // Act
    await clickExportAndWait(window);

    // Assert
    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    expect(captured!.format).toBe('TXT');

    const txt = captured!.content;

    // Assert: 无章节标题 Markdown 标记（# 前缀已被剥离）
    expect(txt).not.toMatch(/^#\s+/m);

    // Assert: 无加粗/斜体语法残留
    expect(txt).not.toContain('**');
    expect(txt).not.toContain('__');
    expect(txt).not.toContain('*');

    // Assert: 无链接语法残留
    expect(txt).not.toContain('](http');
    expect(txt).not.toContain('](https');

    // Assert: 无变量引用 $ 前缀（$信任度 → 信任度）
    // TXT 导出器中变量 $ 前缀被剥离
    expect(txt).not.toMatch(/\$[a-zA-Z一-鿿]/);

    // Assert: 无 Frontmatter 残留（--- 分隔符仅用于章节分隔）
    // 确保 YAML Frontmatter 的元数据字段不出现
    expect(txt).not.toContain('plotflow:');
    expect(txt).not.toContain('engine:');
    expect(txt).not.toContain('vars:');

    // Assert: 选项文本保留（"选项:" 格式前缀）
    expect(txt).toContain('选项:');

    // Assert: 节点标题保留（纯文本形式）
    expect(txt).toContain('村口');

    // Assert: 条件表达式保留在选项中
    expect(txt).toContain('条件:');

    // Assert: 正文段落保留
    expect(txt).toContain('夕阳压在木栅栏上');
  });

  // ==========================================================================
  // TC-5: 菜单导出 → 验证与快捷键相同
  // ==========================================================================

  test('TC-5: 菜单导出（导出 > 导出JSON）→ 验证打开同一导出对话框', async () => {
    // Arrange: 确保对话框关闭
    await closeExportDialog(window);

    // Act: 模拟主进程发送菜单 IPC 事件 (menu:export:json)
    // 此事件等效于用户点击菜单栏 "导出 > 导出 JSON"
    // useMenuEvents hook 收到此事件后调用 openExportDialog()
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('menu:export:json');
      }
    });

    // Assert: 对话框打开并可见
    await window.waitForSelector('.export-dialog__overlay', { timeout: 5000 });
    const dialog = window.locator('.export-dialog__overlay');
    await expect(dialog).toBeVisible();

    // Assert: 对话框内容与 TC-1 一致 — 包含三种格式选项
    const formatJson = dialog.locator('input[name="export-format"][value="json"]');
    const formatHtml = dialog.locator('input[name="export-format"][value="html"]');
    const formatTxt = dialog.locator('input[name="export-format"][value="txt"]');
    await expect(formatJson).toBeVisible();
    await expect(formatHtml).toBeVisible();
    await expect(formatTxt).toBeVisible();

    // Assert: 默认选中 JSON（与 Ctrl+E 打开时一样）
    await expect(formatJson).toBeChecked();

    // Assert: 标题相同
    await expect(dialog).toContainText('导出故事');

    // Assert: 快捷键提示可见（证明是同一个 ExportDialog 组件）
    await expect(dialog).toContainText('Ctrl+E');

    // Assert: 可通过菜单打开的对话框执行导出（验证完整链路）
    await clickExportAndWait(window);
    const captured = await readCapturedExport(electronApp);
    expect(captured).not.toBeNull();
    expect(captured!.format).toBe('JSON');

    // 验证导出内容与 TC-2 一致
    const parsed = JSON.parse(captured!.content) as Record<string, unknown>;
    expect(parsed['meta']).toBeDefined();
    expect(parsed['chapters']).toBeDefined();
  });
});
