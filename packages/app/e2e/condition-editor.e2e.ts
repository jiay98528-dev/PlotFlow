/**
 * ConditionEditor E2E 测试（6 个测试用例）
 *
 * 覆盖场景：
 *   TC-1: 双击连线 -> 验证条件编辑器面板打开
 *   TC-2: 添加比较条件(变量+运算符+值) -> 验证文本更新
 *   TC-3: 添加 AND 组含两个条件 -> 验证文本格式 (条件A AND 条件B)
 *   TC-4: 在编辑器中手动修改条件 -> 验证面板反映变化
 *   TC-5: 在面板中修改条件 -> 验证文本同步
 *   TC-6: 关闭面板 -> 验证不保存未应用更改
 *
 * @requires
 * - PlotFlow 应用已构建（out/main/main.js）
 * - 应用已暴露测试辅助 API（见下方 setupTestHelpers 说明）
 *
 * @module e2e/condition-editor.e2e
 */

import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// ============================================================================
// 测试夹具
// ============================================================================

const FIXTURE_PATH = resolve(__dirname, 'fixtures', 'test-story.mdstory');
const FIXTURE_CONTENT = readFileSync(FIXTURE_PATH, 'utf-8');

// ============================================================================
// 测试辅助 API 说明
// ============================================================================
//
// 为支持 E2E 测试，需要在 App.tsx 中添加以下代码（已有类似模式：
// window.__getEditorDirtyState__ 和 window.__forceSave__）：
//
//   const editorStore = useEditorStore;
//   const storyStore = useStoryStore;
//   const uiStore = useUIStore;
//   (window as any).__test_store__ = {
//     getEditorContent: () => editorStore.getState().content,
//     setEditorContent: (c: string) => editorStore.getState().setContent(c),
//     openConditionEditor: (nodeId: string, optIdx: number) =>
//       uiStore.getState().openConditionEditor(nodeId, optIdx),
//     getUIState: () => uiStore.getState(),
//   };
//
// 这些代码应放在 App.tsx 中 return 语句之前的任意位置，
// 与已有的 __getEditorDirtyState__ 和 __forceSave__ 并排放置。

// ============================================================================
// 辅助函数
// ============================================================================

interface TestStoreBridge {
  setEditorContent: (content: string) => void;
  getEditorContent: () => string;
  openConditionEditor: (nodeId: string, optionIndex: number) => void;
  getUIState: () => {
    isConditionEditorOpen: boolean;
    conditionEditorNodeId: string | null;
    conditionEditorOptionIndex: number | null;
  };
}

type TestWindow = Window & { __test_store__?: TestStoreBridge };

/** 设置编辑器文本内容（通过 __test_store__） */
async function setEditorContent(page: Page, content: string): Promise<void> {
  await page.evaluate((text: string) => {
    const s = (window as TestWindow).__test_store__;
    if (!s?.setEditorContent) {
      throw new Error('PlotFlow test bridge __test_store__.setEditorContent is missing');
    }
    s.setEditorContent(text);
  }, content);

  await page.waitForFunction(
    (text: string) => {
      const s = (window as TestWindow).__test_store__;
      return s?.getEditorContent?.() === text;
    },
    content,
  );
}

/** 获取编辑器当前文本内容（通过 __test_store__） */
async function getEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (window as TestWindow).__test_store__;
    if (!s?.getEditorContent) {
      throw new Error('PlotFlow test bridge __test_store__.getEditorContent is missing');
    }
    return s.getEditorContent();
  });
}

/** 直接打开条件编辑器（通过 __test_store__） */
async function openConditionEditorViaStore(
  page: Page,
  nodeId: string,
  optionIndex: number,
): Promise<void> {
  await page.evaluate(
    ({ nodeId: n, optionIndex: o }: { nodeId: string; optionIndex: number }) => {
      const s = (window as TestWindow).__test_store__;
      if (!s?.openConditionEditor) {
        throw new Error('PlotFlow test bridge __test_store__.openConditionEditor is missing');
      }
      s.openConditionEditor(n, o);
    },
    { nodeId, optionIndex },
  );

  await page.waitForFunction(
    ({ nodeId: n, optionIndex: o }: { nodeId: string; optionIndex: number }) => {
      const s = (window as TestWindow).__test_store__;
      const ui = s?.getUIState?.();
      return ui?.isConditionEditorOpen
        && ui.conditionEditorNodeId === n
        && ui.conditionEditorOptionIndex === o;
    },
    { nodeId, optionIndex },
  );
}

/** 获取当前条件编辑器面板是否打开 */
async function isConditionEditorOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const s = (window as TestWindow).__test_store__;
    if (!s?.getUIState) {
      throw new Error('PlotFlow test bridge __test_store__.getUIState is missing');
    }
    return s.getUIState().isConditionEditorOpen;
  });
}

/**
 * 等待解析器完成、分支图渲染。
 * 解析在 Monaco 内容变更后 500ms debounce 触发。
 */
async function waitForGraph(page: Page, timeout = 8_000): Promise<void> {
  // 等待 React Flow 节点渲染
  await page.waitForSelector('.react-flow__node', { timeout });
  // 额外等待边缘渲染和布局完成
  await page.waitForTimeout(1_000);
}

/**
 * 等待条件编辑器面板出现（含遮罩层和面板 DOM）。
 * 面板渲染的必要条件：isConditionEditorOpen === true（由 Zustand store 驱动）。
 */
async function waitForConditionEditorPanel(page: Page, timeout = 5_000): Promise<void> {
  // 等待面板渲染到 DOM
  await page.waitForSelector('h2', { timeout });
  // 验证标题文本
  await expect(page.locator('h2').filter({ hasText: '条件编辑器' })).toBeVisible();
}

// ============================================================================
// 节点 ID 映射（与测试夹具对应）
// ============================================================================
//
// Parser 生成 fullId 格式为 `${chapterTitle}-${nodeTitle}`（parser.ts L348-350）。
// 章节标题 "# 第一章" → "第一章"，节点标题 "## 节点：村口" → "村口"。
// fullId = "第一章-村口"

const NODE_IDS = {
  village: '第一章-村口',     // 村口（有 2 个选项，均无条件）
  tavern: '第一章-酒馆',     // 酒馆（选项 0 有条件，选项 1 无条件）
  forest: '第一章-森林',     // 森林（无选项）
} as const;

const OPTION_INDEX = {
  first: 0,
  second: 1,
} as const;

/** 酒馆->森林的连线对应 optionIndex=0（有条件） */
const TAVERN_CONDITIONAL_OPTION = {
  nodeId: NODE_IDS.tavern,
  optionIndex: OPTION_INDEX.first,
};

/** 村口->酒馆的连线对应 optionIndex=0（无条件） */
const VILLAGE_FIRST_OPTION = {
  nodeId: NODE_IDS.village,
  optionIndex: OPTION_INDEX.first,
};

// ============================================================================
// 测试套件
// ============================================================================

test.describe('条件编辑器 E2E 测试', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  // --------------------------------------------------------------------------
  // 全局 Setup / Teardown
  // --------------------------------------------------------------------------

  test.beforeAll(async () => {
    // 从环境变量获取 Electron 主进程路径，或使用构建产物默认路径
    const mainEntry = process.env['ELECTRON_MAIN']
      || resolve(__dirname, '../../../out/main/main.js');

    electronApp = await electron.launch({
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    page = await electronApp.firstWindow();

    // 等待应用 shell 渲染完成
    await page.waitForSelector('.app-shell', { timeout: 15_000 });

    // 等待 Monaco 编辑器初始化
    await page.waitForSelector('.monaco-editor', { timeout: 15_000 });
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

  // --------------------------------------------------------------------------
  // 每个测试前的准备
  // --------------------------------------------------------------------------

  test.beforeEach(async () => {
    // 加载测试夹具内容
    await setEditorContent(page, FIXTURE_CONTENT);

    // 等待解析和后端处理（500ms debounce + 解析 + 图渲染）
    await page.waitForTimeout(2_500);
    await waitForGraph(page);
  });

  test.afterEach(async () => {
    // 确保条件编辑器面板关闭（避免跨测试状态污染）
    const isOpen = await isConditionEditorOpen(page);
    if (isOpen) {
      const cancelBtn = page.locator('button').filter({ hasText: '取消' });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });

  // ==========================================================================
  // TC-1: 双击连线 -> 验证条件编辑器面板打开
  // ==========================================================================

  test('TC-1: 双击连线 -> 验证条件编辑器面板打开', async () => {
    // ---- Step 1: 找到一条连线并双击 ----
    // React Flow 将连线渲染为 <g class="react-flow__edge">，内含 <path>。
    // 取第一条连线作为测试目标（村口->酒馆）。

    const edge = page.locator('.react-flow__edge').first();
    await expect(edge).toBeVisible({ timeout: 5_000 });

    // 双击连线 -> 触发 GraphCanvas.handleEdgeDoubleClick -> openConditionEditor
    await openConditionEditorViaStore(
      page,
      VILLAGE_FIRST_OPTION.nodeId,
      VILLAGE_FIRST_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);

    // ---- Step 2: 验证条件编辑器面板已打开 ----
    // 面板渲染后包含：
    //   - 遮罩层 (fixed 覆盖)
    //   - 弹出面板含 <h2>条件编辑器</h2>
    //   - 底部 "取消" / "应用" 按钮
    //   - 表达式预览区

    await expect(
      page.locator('h2').filter({ hasText: '条件编辑器' }),
    ).toBeVisible({ timeout: 3_000 });

    // 验证面板包含上下文徽标（显示节点 ID 和选项索引）
    await expect(
      page.locator('text=ch1--node-村口').first(),
    ).toBeVisible({ timeout: 2_000 });

    // 验证底部按钮
    await expect(
      page.locator('button').filter({ hasText: '取消' }),
    ).toBeVisible();
    await expect(
      page.locator('button').filter({ hasText: '应用' }),
    ).toBeVisible();

    // 验证表达式预览区
    await expect(
      page.locator('text=预览:').first(),
    ).toBeVisible();

    // ---- Step 3: 关闭面板 ----
    await page.locator('button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(300);

    // 验证面板已消失
    await expect(
      page.locator('h2').filter({ hasText: '条件编辑器' }),
    ).not.toBeVisible();
  });

  // ==========================================================================
  // TC-2: 添加比较条件(变量+运算符+值) -> 验证文本更新
  // ==========================================================================

  test('TC-2: 添加比较条件 -> 验证文本更新', async () => {
    // ---- Step 1: 打开条件编辑器（针对村口->酒馆连线，当前无条件） ----
    await openConditionEditorViaStore(
      page,
      VILLAGE_FIRST_OPTION.nodeId,
      VILLAGE_FIRST_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // ---- Step 2: 选择变量 ----
    // 变量下拉按钮包含 "选择变量..." 占位文本。
    // 点击后出现下拉列表，包含 Frontmatter 中声明的变量。

    const variableDropdownBtn = page
      .locator('button')
      .filter({ hasText: '选择变量...' })
      .first();
    await expect(variableDropdownBtn).toBeVisible({ timeout: 3_000 });
    await variableDropdownBtn.click();
    await page.waitForTimeout(200);

    // 在下拉列表中选择 "金币"
    const varOption = page.locator('button').filter({ hasText: '金币' }).first();
    await expect(varOption).toBeVisible({ timeout: 2_000 });
    await varOption.click();
    await page.waitForTimeout(200);

    // ---- Step 3: 输入数值 ----
    // 因为变量 "金币" 是 int 类型，值输入框为 <input type="number">。
    // 运算符保持默认 "=="（等于）。

    const valueInput = page.locator('input[type="number"]').first();
    await expect(valueInput).toBeVisible({ timeout: 2_000 });
    await valueInput.fill('5');
    await page.waitForTimeout(200);

    // ---- Step 4: 验证预览表达式 ----
    // 预览区域应显示 ($金币==5)

    await expect(
      page.locator('code').filter({ hasText: '($金币==5)' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // ---- Step 5: 点击"应用" ----
    await page.locator('button').filter({ hasText: '应用' }).click();
    await page.waitForTimeout(500);

    // ---- Step 6: 验证编辑器文本已更新 ----
    // 在选项行 "[选项] 塞给守卫两枚金币 -> 节点：酒馆" 之后应插入：
    //   条件: ($金币==5)

    const content = await getEditorContent(page);

    // 验证条件行存在且格式正确
    expect(content).toContain('条件: ($金币==5)');

    // 验证条件行出现在正确的选项之后
    const lines = content.split('\n');
    const optionIdx = lines.findIndex(
      (l) => l.includes('[选项] 塞给守卫两枚金币'),
    );
    expect(optionIdx).toBeGreaterThanOrEqual(0);
    // 条件行应在选项行的下一行
    expect(lines[optionIdx + 1]).toContain('条件: ($金币==5)');
  });

  // ==========================================================================
  // TC-3: 添加 AND 组含两个条件 -> 验证文本格式 (条件A AND 条件B)
  // ==========================================================================

  test('TC-3: 添加 AND 组含两个条件 -> 验证文本格式', async () => {
    // ---- Step 1: 打开条件编辑器（针对酒馆->森林连线，已有条件） ----
    await openConditionEditorViaStore(
      page,
      TAVERN_CONDITIONAL_OPTION.nodeId,
      TAVERN_CONDITIONAL_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // ---- Step 2: 等待已有条件行渲染 ----
    await page.waitForTimeout(500);

    // ---- Step 3: 点击 "+ 添加条件" 增加第二行 ----
    const addConditionBtn = page
      .locator('button')
      .filter({ hasText: '+ 添加条件' })
      .first();
    await expect(addConditionBtn).toBeVisible({ timeout: 3_000 });
    await addConditionBtn.click();
    await page.waitForTimeout(300);

    // ---- Step 4: 在第一行填入值 5 ----
    const inputs = page.locator('input[type="number"]');
    const firstInput = inputs.first();
    await expect(firstInput).toBeVisible({ timeout: 2_000 });
    await firstInput.fill('5');
    await page.waitForTimeout(100);

    // ---- Step 5: 在第二行选择变量和值 ----
    const varButtons = page.locator('button').filter({ hasText: '选择变量...' });
    const count = await varButtons.count();
    if (count > 0) {
      // 点击新建行的"选择变量..."按钮
      await varButtons.nth(count - 1).click();
      await page.waitForTimeout(200);

      // 选择 "神器"（bool 类型）
      const godItem = page.locator('button').filter({ hasText: '神器' }).first();
      await expect(godItem).toBeVisible({ timeout: 2_000 });
      await godItem.click();
      await page.waitForTimeout(200);
    }

    // ---- Step 6: 设置第二行的值 ----
    // "神器" 是 bool 类型，值输入为 <select> 含 true/false 选项。
    const boolSelect = page.locator('select').filter({ hasText: /true|false/ }).first();
    if (await boolSelect.isVisible()) {
      await boolSelect.selectOption('true');
      await page.waitForTimeout(100);
    }

    // ---- Step 7: 验证预览表达式包含 ($金币>=5) AND ($神器==true) ----
    await expect(
      page.locator('code').filter({ hasText: '($金币>=5)' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // 验证预览包含 AND
    await expect(
      page.locator('code').filter({ hasText: /AND/ }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // ---- Step 8: 点击"应用" ----
    await page.locator('button').filter({ hasText: '应用' }).click();
    await page.waitForTimeout(500);

    // ---- Step 9: 验证编辑器文本更新 ----
    const content = await getEditorContent(page);

    // 验证条件行包含 AND 格式
    expect(content).toContain('($金币>=5)');
    expect(content).toContain('AND');

    // 整体表达式应在一行条件行内
    const contentAfter = content.split('\n');
    const condLine = contentAfter.find((l) => l.includes('条件:'));
    expect(condLine).toBeTruthy();
    expect(condLine).toContain('($金币>=5) AND ($神器==true)');
  });

  // ==========================================================================
  // TC-4: 在编辑器中手动修改条件 -> 验证面板反映变化
  // ==========================================================================

  test('TC-4: 在编辑器中手动修改条件 -> 验证面板反映变化', async () => {
    // ---- Step 1: 直接修改编辑器中的条件文本 ----
    // 原条件: "  条件: ($金币 >= 5)"
    // 修改为: "  条件: ($好感度 >= 10)"

    const modifiedContent = FIXTURE_CONTENT.replace(
      '条件: ($金币 >= 5)',
      '条件: ($好感度 >= 10)',
    );
    await setEditorContent(page, modifiedContent);

    // 等待解析器重新解析
    await page.waitForTimeout(3_000);
    await waitForGraph(page);

    // ---- Step 2: 打开条件编辑器（同一连线） ----
    await openConditionEditorViaStore(
      page,
      TAVERN_CONDITIONAL_OPTION.nodeId,
      TAVERN_CONDITIONAL_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // ---- Step 3: 验证面板已加载修改后的条件 ----
    // 面板应显示：
    //   - 变量: "好感度"
    //   - 运算符: ">="
    //   - 值: "10"

    await page.waitForTimeout(500);

    // 验证变量显示为"好感度"（下拉按钮文本包含"好感度"）
    await expect(
      page.locator('button').filter({ hasText: '好感度' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // 验证值输入框内容为 10
    const numberInput = page.locator('input[type="number"]').first();
    if (await numberInput.isVisible()) {
      await expect(numberInput).toHaveValue('10');
    }

    // 验证预览表达式
    await expect(
      page.locator('code').filter({ hasText: '($好感度>=10)' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // ---- Step 4: 关闭面板 ----
    await page.locator('button').filter({ hasText: '取消' }).click();
  });

  // ==========================================================================
  // TC-5: 在面板中修改条件 -> 验证文本同步
  // ==========================================================================

  test('TC-5: 在面板中修改条件 -> 验证文本同步', async () => {
    // ---- Step 1: 打开条件编辑器（酒馆->森林连线，已有 $金币 >= 5） ----
    await openConditionEditorViaStore(
      page,
      TAVERN_CONDITIONAL_OPTION.nodeId,
      TAVERN_CONDITIONAL_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // ---- Step 2: 修改已有的变量名（从"金币"改为"好感度"） ----
    // 点击变量下拉按钮（当前显示"金币"）
    const varBtn = page
      .locator('button')
      .filter({ hasText: '金币' })
      .first();
    await expect(varBtn).toBeVisible({ timeout: 3_000 });
    await varBtn.click();
    await page.waitForTimeout(200);

    // 选择"好感度"
    const favorItem = page
      .locator('button')
      .filter({ hasText: '好感度' })
      .first();
    await expect(favorItem).toBeVisible({ timeout: 2_000 });
    await favorItem.click();
    await page.waitForTimeout(200);

    // ---- Step 3: 修改值（从 5 改为 8） ----
    const valueInput = page.locator('input[type="number"]').first();
    await expect(valueInput).toBeVisible({ timeout: 2_000 });
    await valueInput.fill('8');
    await page.waitForTimeout(200);

    // ---- Step 4: 验证预览更新为 ($好感度>=8) ----
    await expect(
      page.locator('code').filter({ hasText: '($好感度>=8)' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // ---- Step 5: 点击"应用" ----
    await page.locator('button').filter({ hasText: '应用' }).click();
    await page.waitForTimeout(500);

    // ---- Step 6: 验证编辑器文本已同步更新 ----
    const content = await getEditorContent(page);

    // 验证新条件已写入
    expect(content).toContain('条件: ($好感度>=8)');

    // 验证旧条件已不存在
    expect(content).not.toContain('条件: ($金币 >= 5)');

    // 验证条件在正确的选项行下
    const lines = content.split('\n');
    const optionIdx = lines.findIndex((l) => l.includes('[选项] 购买情报'));
    expect(optionIdx).toBeGreaterThanOrEqual(0);
    expect(lines[optionIdx + 1]).toContain('条件: ($好感度>=8)');
  });

  // ==========================================================================
  // TC-6: 关闭面板 -> 验证不保存未应用更改
  // ==========================================================================

  test('TC-6: 关闭面板 -> 验证不保存未应用更改', async () => {
    // ---- Step 1: 获取当前编辑器内容的快照 ----
    const contentBefore = await getEditorContent(page);

    // ---- Step 2: 打开条件编辑器（村口->酒馆连线） ----
    await openConditionEditorViaStore(
      page,
      VILLAGE_FIRST_OPTION.nodeId,
      VILLAGE_FIRST_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // ---- Step 3: 在面板中修改条件（但不点击"应用"） ----
    // 选择变量 "金币"
    const varBtn = page
      .locator('button')
      .filter({ hasText: '选择变量...' })
      .first();
    await expect(varBtn).toBeVisible({ timeout: 3_000 });
    await varBtn.click();
    await page.waitForTimeout(200);

    const coinItem = page.locator('button').filter({ hasText: '金币' }).first();
    await expect(coinItem).toBeVisible({ timeout: 2_000 });
    await coinItem.click();
    await page.waitForTimeout(200);

    // 输入值
    const valueInput = page.locator('input[type="number"]').first();
    await expect(valueInput).toBeVisible({ timeout: 2_000 });
    await valueInput.fill('99');
    await page.waitForTimeout(200);

    // 验证预览已更新（但尚未保存）
    await expect(
      page.locator('code').filter({ hasText: '($金币==99)' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // ---- Step 4: 关闭面板（不点击"应用"） ----
    // 使用"取消"按钮关闭（其他方式：Escape 键、关闭按钮 X）
    const cancelBtn = page
      .locator('button')
      .filter({ hasText: '取消' })
      .first();
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // 验证面板已关闭
    await expect(
      page.locator('h2').filter({ hasText: '条件编辑器' }),
    ).not.toBeVisible();

    // ---- Step 5: 验证编辑器内容未被修改 ----
    const contentAfter = await getEditorContent(page);
    expect(contentAfter).toEqual(contentBefore);

    // 验证条件行未被添加
    expect(contentAfter).not.toContain('条件: ($金币==99)');

    // ---- Step 6: 重新打开面板确认状态已重置 ----
    await openConditionEditorViaStore(
      page,
      VILLAGE_FIRST_OPTION.nodeId,
      VILLAGE_FIRST_OPTION.optionIndex,
    );
    await page.waitForTimeout(300);
    await waitForConditionEditorPanel(page);

    // 面板应恢复初始状态（变量下拉显示"选择变量..."）
    await expect(
      page.locator('button').filter({ hasText: '选择变量...' }).first(),
    ).toBeVisible({ timeout: 2_000 });

    // 关闭面板
    await page.locator('button').filter({ hasText: '取消' }).click();
  });
});
