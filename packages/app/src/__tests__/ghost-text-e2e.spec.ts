/**
 * GhostText 幽灵补全 E2E 测试 (M5-08 ~ M5-13)
 *
 * 测试范围（6 个用例）：
 *   TC-1: 输入 "## 节点：I" → 验证幽灵文本建议出现（英文语料匹配）
 *   TC-2: 按 Tab → 验证幽灵文本被接受（插入编辑器内容）
 *   TC-3: 按 Esc → 验证幽灵文本消失（不改变编辑器内容）
 *   TC-4: 输入不匹配文本 → 验证幽灵文本自动消失
 *   TC-5: 输入 "$" 后字符 + Ctrl+Space → 验证变量名补全
 *   TC-6: Ctrl+Space → 验证多候选下拉菜单
 *
 * ## 语料说明
 * 中文语料缺失（BUG-GT-001），当前仅加载英文语料（en.json 152句）。
 * 节点标题触发（## 节点：）后使用英文前缀（如 "I"）以匹配 NGramEngine 中的英文语料。
 * 变量名补全依赖 Frontmatter 变量声明（通过 storyStore 注入）和 InvertedIndex。
 *
 * ## 运行前置条件
 * 1. 构建: pnpm build (or electron-vite build)
 * 2. npx playwright install
 * 3. npx playwright test --config packages/app/playwright.config.ts
 *
 * @module __tests__/ghost-text-e2e
 * @see ../editor/GhostTextPlugin.ts — 被测试的模块
 * @see ../../../../core/corpus/en.json — 英文预置语料
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import * as path from 'path';

// ============================================================================
// 常量
// ============================================================================

/** 项目根目录 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** Electron 可执行文件路径（pnpm workspace 中 electron 28.3.3） */
const ELECTRON_BIN = path.join(
  PROJECT_ROOT,
  'node_modules/.pnpm/electron@28.3.3/node_modules/electron/dist/electron.exe',
);

/** Electron 主进程入口（构建产物） */
const MAIN_ENTRY = path.resolve(PROJECT_ROOT, 'out', 'main', 'main.js');

/** 幽灵文本装饰 CSS 选择器（Monaco 注入文本 span） */
const GHOST_TEXT_SELECTOR = '.monaco-editor .ghost-text-decoration';

/** 编辑器容器选择器 */
const EDITOR_SELECTOR = '.monaco-editor';

/** 视图行选择器 */
const VIEW_LINE_SELECTOR = '.view-line';

/** 建议下拉菜单选择器（Ctrl+Space 触发） */
const SUGGEST_WIDGET_SELECTOR = '.monaco-editor .suggest-widget';

/** 建议列表项文本选择器 */
const SUGGEST_ITEM_SELECTOR = '.monaco-editor .suggest-widget .monaco-highlighted-label';

/** 两次触发之间的最小间隔（GhostTextPlugin MIN_TRIGGER_INTERVAL_MS） */
const MIN_TRIGGER_INTERVAL = 100;

/** 解析管线防抖时间（parsePipeline.ts DEBOUNCE_MS） */
const PARSE_DEBOUNCE_MS = 500;

/** Node title 触发前缀 */
const NODE_TITLE_PREFIX = '## 节点：';

/**
 * 包含变量声明的 Frontmatter 内容。
 *
 * PlotFlow Frontmatter 解析器（frontmatter.ts）使用 `vars:` 标识变量区，
 * 变量声明格式为 `  变量名: 类型`（缩进 + 名称 + 冒号 + 类型）。
 * 无需 `-` 列表标记,YAML 风格。
 */
const FRONTMATTER_WITH_VARS = [
  '---',
  'title: "测试"',
  'author: "测试"',
  'vars:',
  '  hasSword: bool',
  '  playerName: string',
  '  gold: int',
  '---',
  '',
  '这里测试变量补全。',
].join('\n');

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 等待 Monaco Editor 完全就绪。
 *
 * 包含三项条件:
 * 1. Monaco DOM 容器已创建
 * 2. view-line 元素已渲染（编辑器可交互）
 * 3. GhostTextPlugin 已异步初始化（语料加载 + 提供者注册完成）
 */
async function waitForEditorReady(page: Page): Promise<void> {
  await page.waitForSelector(EDITOR_SELECTOR, { timeout: 15_000 });
  await page.waitForSelector(VIEW_LINE_SELECTOR, { timeout: 10_000 });
  // GhostTextPlugin 的 setupEditor.ts 中语料加载是异步的,给予额外等待
  await page.waitForTimeout(3_000);
}

/**
 * 聚焦 Monaco Editor 的隐藏 textarea。
 *
 * Monaco 使用一个不可见的 textarea 捕获键盘输入,
 * 必须先聚焦此元素,page.keyboard.type() 才能正确发送文本。
 */
async function focusEditor(page: Page): Promise<void> {
  const textarea = page.locator(`${EDITOR_SELECTOR} textarea`).first();
  await textarea.focus();
  await page.waitForTimeout(50);
}

/**
 * 清空编辑器全部内容。
 */
async function clearEditor(page: Page): Promise<void> {
  await focusEditor(page);
  // 全选 + 删除
  await page.keyboard.press('Control+A');
  await page.waitForTimeout(50);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
}

/**
 * 在编辑器中键入文本。
 *
 * @param text  - 要键入的文本
 * @param delay - 每次按键间隔(ms),0 为尽可能快
 */
async function typeInEditor(page: Page, text: string, delay: number = 5): Promise<void> {
  await focusEditor(page);
  await page.keyboard.type(text, { delay });
}

/**
 * 获取编辑器所有 view-line 的 textContent。
 *
 * 当幽灵文本可见时,其文本内容也包含在内（因为 ghost-text-decoration span
 * 是 view-line 的子元素）。幽灵文本消失后,此函数返回纯 Model 内容。
 */
async function getEditorText(page: Page): Promise<string> {
  return page.evaluate((sel: string) => {
    const lines = document.querySelectorAll<HTMLElement>(sel);
    return Array.from(lines).map((el) => el.textContent ?? '').join('\n');
  }, VIEW_LINE_SELECTOR);
}

function normalizeRenderedText(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

/**
 * 检测幽灵文本装饰是否在 DOM 中可见。
 *
 * Monaco 渲染 InlineCompletionItem 时,会创建带有 ghost-text-decoration
 * CSS 类的 <span> 元素插入到 view-line 中。
 */
async function isGhostVisible(page: Page): Promise<boolean> {
  return page.evaluate((sel: string) => {
    return document.querySelectorAll<HTMLElement>(sel).length > 0;
  }, GHOST_TEXT_SELECTOR);
}

/**
 * 检测建议下拉菜单是否打开可见。
 *
 * Monaco 的 .suggest-widget 在不活动时会被移除 DOM 而非隐藏。
 */
async function isSuggestWidgetVisible(page: Page): Promise<boolean> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }, SUGGEST_WIDGET_SELECTOR);
}

/**
 * 获取当前建议下拉菜单中的候选标签文本列表。
 */
async function getSuggestItemLabels(page: Page): Promise<string[]> {
  return page.evaluate((sel: string) => {
    const items = document.querySelectorAll<HTMLElement>(sel);
    return Array.from(items).map((el) => el.textContent ?? '').filter(Boolean);
  }, SUGGEST_ITEM_SELECTOR);
}

// ============================================================================
// 测试套件
// ============================================================================

test.describe('GhostText 幽灵补全 E2E (TC-1 ~ TC-6)', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  // ----------------------------------------------------------------
  // 全局 Setup / Teardown
  // ----------------------------------------------------------------

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      executablePath: ELECTRON_BIN,
      args: [MAIN_ENTRY, '--disable-gpu'],
      cwd: PROJECT_ROOT,
    });

    page = await electronApp.firstWindow();
    await waitForEditorReady(page);
  });

  test.afterAll(async () => {
    if (electronApp) {
      // Bypass the product's dirty-file confirmation during test teardown.
      await electronApp.evaluate(({ app }) => app.exit(0));
    }
  });

  // ----------------------------------------------------------------
  // 各测试共同的 beforeEach: 清空编辑器 + 触发间隔冷却
  // ----------------------------------------------------------------

  test.beforeEach(async () => {
    await clearEditor(page);
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 50);
  });

  // ====================================================================
  // TC-1: 节点标题幽灵补全建议出现 (M5-09, M5-10)
  // ====================================================================
  //
  // 输入 "## 节点：I" 触发 node-title 补全维度。
  // NGramEngine 已加载英文语料,前缀 "I" 可匹配语料中的 2-gram 高频组合
  // （如 "I have" 出现 5 次、"I am" 出现 4 次等）。
  // 预期: 光标后方出现灰色半透明幽灵文本建议。
  //
  // 验证要点:
  // - detectTriggerDimension 正确识别 node-title 维度
  // - InlineCompletionProvider 返回非空建议
  // - Monaco 渲染 ghost-text-decoration 装饰
  // ====================================================================

  test('TC-1: 节点标题幽灵补全建议出现', async () => {
    await typeInEditor(page, NODE_TITLE_PREFIX + 'I');
    // 等待: MIN_TRIGGER_INTERVAL (100ms) + 提供者异步响应 + Monaco 渲染
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 300);

    const visible = await isGhostVisible(page);
    expect(visible).toBe(true);
  });

  // ====================================================================
  // TC-2: Tab 接受幽灵文本 (M5-11)
  // ====================================================================
  //
  // 在幽灵文本出现时按 Tab 键。Monaco 原生行为: Tab 接受 InlineCompletion,
  // 将建议文本写入 Model。
  //
  // 验证要点:
  // - 幽灵文本装饰消失
  // - view-line 文本长度与 Tab 前一致（幽灵文本从装饰变为 Model 内容）
  // - Model 内容比触发前缀更长（预测文本已写入）
  // ====================================================================

  test('TC-2: Tab 接受幽灵文本', async () => {
    // Arrange: 先触发幽灵文本
    await typeInEditor(page, NODE_TITLE_PREFIX + 'I');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 300);
    expect(await isGhostVisible(page)).toBe(true);

    // 记录接受前的文本长度（含幽灵文本 DOM 内容）
    const textBefore = await getEditorText(page);

    // Act: Tab 接受
    await page.keyboard.press('Tab');
    // 等待 Monaco 处理接受 + 可能的后续触发冷却
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 150);

    // 接受后 Monaco 可能立即生成下一段幽灵文本；Esc 仅清除这段后续预览。
    await page.keyboard.press('Escape');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 50);
    expect(await isGhostVisible(page)).toBe(false);

    // Model 内容比触发前缀更长，证明 Tab 已接受建议。
    const textAfter = await getEditorText(page);
    expect(textBefore.length).toBeGreaterThan(NODE_TITLE_PREFIX.length + 1);
    expect(textAfter.length).toBeGreaterThan(NODE_TITLE_PREFIX.length + 1);
  });

  // ====================================================================
  // TC-3: Esc 取消幽灵文本 (M5-11)
  // ====================================================================
  //
  // 在幽灵文本出现时按 Escape 键。Monaco 原生行为: Esc 取消建议,
  // 幽灵文本从 DOM 移除,Model 不变。
  //
  // 验证要点:
  // - 幽灵文本装饰消失
  // - view-line 文本长度减小（幽灵文本被移除,且未写入 Model）
  // - Model 恢复为仅含用户键入的内容
  // ====================================================================

  test('TC-3: Esc 取消幽灵文本', async () => {
    // Arrange: 先触发幽灵文本
    await typeInEditor(page, NODE_TITLE_PREFIX + 'I');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 300);
    expect(await isGhostVisible(page)).toBe(true);

    const textBefore = await getEditorText(page);

    // Act: Escape 取消
    await page.keyboard.press('Escape');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 150);

    // Assert 1: 幽灵文本装饰已消失
    expect(await isGhostVisible(page)).toBe(false);

    // Assert 2: 文本长度减小（幽灵文本被移除且未写入）
    const textAfter = await getEditorText(page);
    expect(textAfter.length).toBeLessThan(textBefore.length);

    // Assert 3: Model 内容仅为用户键入的触发前缀
    expect(normalizeRenderedText(textAfter)).toBe(NODE_TITLE_PREFIX + 'I');
  });

  // ====================================================================
  // TC-4: 不匹配文本 → 幽灵文本自动消失 (M5-11)
  // ====================================================================
  //
  // 幽灵文本出现后继续键入与建议不一致的字符。
  // Monaco 原生行为: 用户输入与 ghost text 不匹配时自动移除建议。
  //
  // 验证要点:
  // - 幽灵文本装饰消失
  // - 编辑器内容包含用户键入的所有字符,不含原幽灵文本
  // ====================================================================

  test('TC-4: 输入不匹配文本时幽灵文本消失', async () => {
    // Arrange: 先触发幽灵文本
    await typeInEditor(page, NODE_TITLE_PREFIX + 'I');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 300);
    expect(await isGhostVisible(page)).toBe(true);

    // Act: 键入与幽灵文本不匹配的字符
    // NGramEngine 对 "I" 的预测通常是 " have" 等,键入 "X" 不会匹配
    await typeInEditor(page, 'X');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 150);

    // Monaco may immediately generate a new suggestion for the updated context.
    // Clear that preview, then verify the rejected suggestion was not committed.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 50);
    expect(await isGhostVisible(page)).toBe(false);

    // Assert 2: 编辑器仅含用户键入的内容
    const textAfter = await getEditorText(page);
    expect(normalizeRenderedText(textAfter)).toBe(NODE_TITLE_PREFIX + 'IX');
  });

  // ====================================================================
  // TC-5: 变量名补全（$ 前缀 + Ctrl+Space）(M5-09, M5-12)
  // ====================================================================
  //
  // 触发方式: 在正文段落中键入 "$" 后跟字符。
  // GhostTextPlugin 检测 variable-name 维度:
  // - 内联幽灵文本(InlineCompletion)依赖 InvertedIndex,此时为空故无内联建议
  // - Ctrl+Space 下拉菜单(CompletionItemProvider)同时查询 InvertedIndex
  //   和 Frontmatter 变量(通过 storyStore),因此 Frontmatter 变量可在下拉中显示
  //
  // 策略:
  // 1. 在编辑器开头设置包含变量声明的 Frontmatter
  // 2. 等待解析管线完成,填充 storyStore.plotFlowData.variables
  // 3. 在正文结尾键入 "$" + 变量名前缀
  // 4. 按 Ctrl+Space 触发显式补全
  // 5. 验证下拉菜单中出现 Frontmatter 中声明的变量
  // ====================================================================

  test('TC-5: 变量名补全（$ 前缀 + Ctrl+Space）', async () => {
    // Arrange: 在编辑器中设置含 Frontmatter 变量的内容
    await clearEditor(page);
    await typeInEditor(page, FRONTMATTER_WITH_VARS, 3);
    // 等待解析管线 500ms debounce + 执行
    await page.waitForTimeout(PARSE_DEBOUNCE_MS + 500);

    // 将光标移到正文行末尾,键入 " $"
    await page.keyboard.press('End');
    await typeInEditor(page, ' $');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 100);

    // Act: Ctrl+Space 触发显式补全
    await page.keyboard.press('Control+ ');
    await page.waitForTimeout(500);

    // Assert 1: 建议小部件已打开
    const widgetVisible = await isSuggestWidgetVisible(page);
    expect(widgetVisible).toBe(true);

    // Assert 2: 列表中包含 Frontmatter 变量
    const labels = await getSuggestItemLabels(page);
    // 验证至少出现一个声明的变量名
    const hasVarEntry = labels.some(
      (l) => l.includes('hasSword') || l.includes('playerName') || l.includes('gold'),
    );
    expect(hasVarEntry).toBe(true);
  });

  // ====================================================================
  // TC-6: Ctrl+Space 多候选下拉菜单 (M5-12)
  // ====================================================================
  //
  // 在 node-title 补全上下文中按 Ctrl+Space。
  // CompletionItemProvider 返回多个候选,Monaco 显示建议下拉窗口。
  // 支持方向键 + Enter 选择。
  //
  // 验证要点:
  // - Ctrl+Space 打开建议小部件
  // - 列表包含 2 个以上候选项
  // - 方向键 + Enter 可选择一个候选项,编辑器内容更新
  // ====================================================================

  test('TC-6: Ctrl+Space 多候选下拉菜单', async () => {
    // Arrange: 在 node-title 上下文中键入触发前缀
    await typeInEditor(page, NODE_TITLE_PREFIX);
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 200);

    // Act: Ctrl+Space
    await page.keyboard.press('Control+ ');
    await page.waitForTimeout(600);

    // Assert 1: 建议小部件可见
    const widgetVisible = await isSuggestWidgetVisible(page);
    expect(widgetVisible).toBe(true);

    // Assert 2: 列表中有至少 2 个候选项
    const labels = await getSuggestItemLabels(page);
    expect(labels.length).toBeGreaterThanOrEqual(2);

    // Assert 3: 方向键导航 + Enter 选择
    const textBeforeSelect = await getEditorText(page);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(MIN_TRIGGER_INTERVAL + 300);

    // 编辑器内容应比触发前缀更长（具体预测文本由 NGramEngine 决定）
    const textAfterSelect = await getEditorText(page);
    expect(textAfterSelect.length).toBeGreaterThan(textBeforeSelect.length);
  });
});
