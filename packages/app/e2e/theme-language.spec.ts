/**
 * PlotFlow E2E — 主题切换与国际化 (5 个测试用例)
 *
 * 前提条件：
 *   1. 项目已构建：`pnpm build`
 *   2. @playwright/test 已安装（当前 workspace 可解析）
 *
 * 运行方式：
 *   npx playwright test packages/app/e2e/theme-language.spec.ts
 *
 * 测试覆盖（对应 CLAUDE.md §5.3 质量防线 L3/L4）：
 *   (1) Ctrl+Shift+T → 主题切换 → CSS 变量验证
 *   (2) 多次快速切换 → 状态稳定无闪烁
 *   (3) 切换语言为英文 → 界面标签变化
 *   (4) 切换语言为中文 → 界面标签恢复
 *   (5) 关闭并重新打开 → 偏好持久化
 *
 * @module e2e/theme-language.spec
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// 常量
// ============================================================================

/** 项目根目录 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
/** 构建产物的主进程入口 */
const MAIN_JS = path.join(PROJECT_ROOT, 'out', 'main', 'main.js');

/** localStorage 键名（与 uiStore.ts 一致） */
const LS_THEME_KEY = 'plotflow:theme';
const LS_LANGUAGE_KEY = 'plotflow:language';

/** 亮/暗主题 --color-bg-primary 的预期值（与 token CSS 文件一致） */
const CSS_LIGHT_BG = '#fefefe';
const CSS_DARK_BG = '#1a1b1e';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 启动 Electron 应用并等待 UI 就绪。
 * 在启动前会验证构建产物是否存在。
 */
async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(
      `构建产物未找到: ${MAIN_JS}。请先执行 pnpm build。`,
    );
  }

  const app: ElectronApplication = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env as Record<string, string>,
      NODE_ENV: 'test',
    },
  });

  const page: Page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 等待 PlotFlow 应用 UI 完全渲染
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  // 等待 Monaco Editor 和 React Flow 等组件初始化
  await page.waitForTimeout(1500);

  return { app, page };
}

/**
 * 获取当前主题（从 <html data-theme="..."> 读取）。
 * 返回 'light' 或 'dark'。
 */
async function getTheme(page: Page): Promise<'light' | 'dark'> {
  return page.evaluate(() => {
    const t = document.documentElement.dataset['theme'];
    return t === 'dark' ? 'dark' : 'light';
  });
}

/**
 * 读取 CSS 自定义属性的当前值（通过 getComputedStyle）。
 * 用于验证主题切换后 Design Token 真实生效。
 */
async function getCssVar(page: Page, varName: string): Promise<string> {
  return page.evaluate((name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

/**
 * 通过 Electron IPC 模拟菜单栏 "切换主题"（等价于按 Ctrl+Shift+T）。
 *
 * 在 Electron 主进程中 webContents.send('menu:view:toggleTheme')，
 * 渲染进程的 useMenuEvents hook 接收后调用 uiStore.toggleTheme()。
 * 该路径与真实菜单点击完全一致。
 */
async function toggleThemeViaMenuIpc(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('menu:view:toggleTheme');
    }
  });
}

/**
 * 通过点击工具栏主题切换按钮来切换主题。
 * 该按钮位于最后一个 .toolbar-group 中，是其中唯一的 <button> 元素。
 */
async function toggleThemeViaButton(page: Page): Promise<void> {
  const themeBtn = page.locator('.toolbar-group').last().locator('button');
  await themeBtn.click();
}

/**
 * 收集页面 console 错误和未捕获异常，用于验证切换过程中无异常。
 * 调用者应在每次测试前清空收集器（调用 reset 返回的函数）。
 */
function setupErrorCollector(page: Page): () => Array<{ type: string; text: string }> {
  const errors: Array<{ type: string; text: string }> = [];
  const onPageError = (err: Error) => {
    errors.push({ type: 'pageerror', text: err.message });
  };
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console-error', text: msg.text() });
    }
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  return () => {
    page.removeListener('pageerror', onPageError);
    page.removeListener('console', onConsole);
    return errors;
  };
}

// ============================================================================
// Test Suite
// ============================================================================

let app: ElectronApplication;
let page: Page;

test.describe('主题与国际化 E2E', () => {

  test.beforeAll(async () => {
    const launched = await launchApp();
    app = launched.app;
    page = launched.page;
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Ctrl+Shift+T → 主题切换 → CSS 变量变化
  // ──────────────────────────────────────────────────────────────────────────
  test('(1) Ctrl+Shift+T 切换主题并验证 CSS 变量变化', async () => {
    const collector = setupErrorCollector(page);
    const initialTheme = await getTheme(page);

    // ── 步骤 1: 模拟 Ctrl+Shift+T（菜单 IPC）──
    await toggleThemeViaMenuIpc(app);
    await page.waitForTimeout(500);

    // ── 验证: 主题已切换 ──
    const toggledTheme = await getTheme(page);
    expect(toggledTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(toggledTheme);

    // ── 验证: CSS 变量值已变为对应主题 ──
    const bgPrimary = await getCssVar(page, '--color-bg-primary');
    if (toggledTheme === 'dark') {
      expect(bgPrimary).toBe(CSS_DARK_BG);
    } else {
      expect(bgPrimary).toBe(CSS_LIGHT_BG);
    }

    // 额外验证另一组明显差异的变量
    const textPrimary = await getCssVar(page, '--color-text-primary');
    if (toggledTheme === 'dark') {
      expect(textPrimary).toBe('#e1e2e4');
    } else {
      expect(textPrimary).toBe('#1b1c1e');
    }

    // ── 步骤 2: 切回初始主题 ──
    await toggleThemeViaMenuIpc(app);
    await page.waitForTimeout(500);

    // ── 验证: 回到初始值 ──
    expect(await getTheme(page)).toBe(initialTheme);

    // ── 验证: 无控制台错误 ──
    const errors = collector();
    expect(errors).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: 多次快速切换 → 状态稳定无闪烁
  // ──────────────────────────────────────────────────────────────────────────
  test('(2) 多次快速切换主题 — 验证状态稳定无闪烁', async () => {
    const collector = setupErrorCollector(page);
    const ITERATIONS = 10;

    for (let i = 0; i < ITERATIONS; i++) {
      // 通过点击按钮切换（比 IPC 更接近用户操作）
      await toggleThemeViaButton(page);
      // 短暂等待 React 和 Monaco editor.setTheme 完成
      await page.waitForTimeout(200);

      // 验证: 每次切换后主题状态合法
      const currentTheme = await getTheme(page);
      expect(['light', 'dark']).toContain(currentTheme);

      // 验证: data-theme 与 data-accent 共生（accent 变量未丢失）
      const accent = await page.evaluate(() => document.documentElement.dataset['accent']);
      expect(['ocean', 'gold']).toContain(accent);

      // 验证: CSS 机制正常（不受主题影响的变量值恒定）
      const textXs = await getCssVar(page, '--text-xs');
      expect(textXs).toBe('0.75rem');
    }

    // 验证: 全部切换过程中无页面错误和 console error
    const errors = collector();
    expect(errors).toHaveLength(0);

    // 验证: 最终状态仍是合法主题
    const finalTheme = await getTheme(page);
    expect(['light', 'dark']).toContain(finalTheme);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: 切换语言为英文 → 界面标签变化
  // ──────────────────────────────────────────────────────────────────────────
  test('(3) 切换语言为英文 — 验证界面标签变化', async () => {
    const collector = setupErrorCollector(page);

    // ── 准备: 确保应用处于中文界面 ──
    await page.evaluate(() => {
      window.localStorage.setItem('plotflow:language', 'zh-CN');
    });
    await page.reload();
    await page.waitForSelector('.app-shell', { timeout: 15_000 });
    await page.waitForSelector('.language-select', { timeout: 5_000 });
    await page.waitForTimeout(500);

    // ── 切换语言为英文 ──
    await page.selectOption('.language-select', 'en-US');
    await page.waitForTimeout(600);

    // ── 验证 1: select 自身的值 ──
    const langValue = await page.locator('.language-select').inputValue();
    expect(langValue).toBe('en-US');

    // ── 验证 2: <html lang="..."> 属性 ──
    const docLang = await page.evaluate(() => document.documentElement.lang);
    expect(docLang).toBe('en-US');

    // ── 验证 3: 工具栏 "新建" → "New" ──
    const newBtn = page.locator('button.button--primary span').first();
    await expect(newBtn).toContainText('New');

    // ── 验证 4: 主题切换按钮标签从 "亮色/暗色" 变为 "Light/Dark" ──
    const themeBtn = page.locator('.toolbar-group').last().locator('button');
    await expect(themeBtn).toContainText(/Light|Dark/);

    // ── 验证 5: 语言选择器的 aria-label 从 "语言" 变为 "Language" ──
    const langSelect = page.locator('.language-select');
    const ariaLabel = await langSelect.getAttribute('aria-label');
    expect(ariaLabel).toBe('Language');

    // ── 验证: 无错误 ──
    const errors = collector();
    expect(errors).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: 切换语言为中文 → 界面标签恢复
  // ──────────────────────────────────────────────────────────────────────────
  test('(4) 切换语言为中文 — 验证界面标签恢复', async () => {
    const collector = setupErrorCollector(page);

    // ── 准备: 确保应用处于英文界面 ──
    await page.evaluate(() => {
      window.localStorage.setItem('plotflow:language', 'en-US');
    });
    await page.reload();
    await page.waitForSelector('.app-shell', { timeout: 15_000 });
    await page.waitForSelector('.language-select', { timeout: 5_000 });
    await page.waitForTimeout(500);

    // ── 确保当前确实是英文 ──
    const currentValue = await page.locator('.language-select').inputValue();
    if (currentValue !== 'en-US') {
      await page.selectOption('.language-select', 'en-US');
      await page.waitForTimeout(300);
    }

    // ── 切换语言为中文 ──
    await page.selectOption('.language-select', 'zh-CN');
    await page.waitForTimeout(600);

    // ── 验证 1: select 自身的值 ──
    const langValue = await page.locator('.language-select').inputValue();
    expect(langValue).toBe('zh-CN');

    // ── 验证 2: <html lang="..."> 属性 ──
    const docLang = await page.evaluate(() => document.documentElement.lang);
    expect(docLang).toBe('zh-CN');

    // ── 验证 3: 工具栏 "New" → "新建" ──
    const newBtn = page.locator('button.button--primary span').first();
    await expect(newBtn).toContainText('新建');

    // ── 验证 4: 主题按钮标签恢复为 "亮色/暗色" ──
    const themeBtn = page.locator('.toolbar-group').last().locator('button');
    await expect(themeBtn).toContainText(/亮色|暗色/);

    // ── 验证 5: aria-label 恢复 ──
    const langSelect = page.locator('.language-select');
    const ariaLabel = await langSelect.getAttribute('aria-label');
    expect(ariaLabel).toBe('语言');

    // ── 验证: 无错误 ──
    const errors = collector();
    expect(errors).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: 关闭并重新打开 → 偏好持久化
  // ──────────────────────────────────────────────────────────────────────────
  test('(5) 关闭并重新打开应用 — 验证主题与语言偏好持久化', async () => {
    // ── 步骤 1: 设置暗色主题 + 英文 ──
    const initialTheme = await getTheme(page);
    if (initialTheme !== 'dark') {
      await toggleThemeViaButton(page);
      await page.waitForTimeout(400);
    }
    expect(await getTheme(page)).toBe('dark');

    // 切换到英文
    await page.selectOption('.language-select', 'en-US');
    await page.waitForTimeout(400);
    expect(await page.locator('.language-select').inputValue()).toBe('en-US');

    // ── 验证: localStorage 已正确记录 ──
    const storedTheme = await page.evaluate((key: string) => window.localStorage.getItem(key), LS_THEME_KEY);
    const storedLang = await page.evaluate((key: string) => window.localStorage.getItem(key), LS_LANGUAGE_KEY);
    expect(storedTheme).toBe('dark');
    expect(storedLang).toBe('en-US');

    // ── 步骤 2: 关闭应用 ──
    await app.close();

    // ── 步骤 3: 重新启动应用 ──
    // 注意：Electron 的 localStorage 存储在 app.getPath('userData') 中，
    // 重新启动会读取相同的 localStorage 数据，实现持久化验证。
    const relaunched = await launchApp();
    const newApp = relaunched.app;
    const newPage = relaunched.page;

    try {
      // ── 验证: 主题持久化为 dark ──
      const persistedTheme = await getTheme(newPage);
      expect(persistedTheme).toBe('dark');

      // ── 验证: CSS 变量为暗色主题值 ──
      const bgPrimary = await getCssVar(newPage, '--color-bg-primary');
      expect(bgPrimary).toBe(CSS_DARK_BG);

      // ── 验证: 语言持久化为 en-US ──
      const persistedLang = await newPage.locator('.language-select').inputValue();
      expect(persistedLang).toBe('en-US');

      // ── 验证: UI 文本使用英文 ──
      const themeBtn = newPage.locator('.toolbar-group').last().locator('button');
      await expect(themeBtn).toContainText(/Light|Dark/);

      // ── 验证: localStorage 值在重启后仍存在 ──
      const restoredTheme = await newPage.evaluate((key: string) => window.localStorage.getItem(key), LS_THEME_KEY);
      const restoredLang = await newPage.evaluate((key: string) => window.localStorage.getItem(key), LS_LANGUAGE_KEY);
      expect(restoredTheme).toBe('dark');
      expect(restoredLang).toBe('en-US');
    } finally {
      await newApp.close();
    }
  });
});
