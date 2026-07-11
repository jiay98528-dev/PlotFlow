/**
 * Monaco TextModel 基本输入操作测试
 *
 * 验证 Monaco Editor TextModel API 的基本输入操作（Backspace/方向键/连续编辑）
 * 不会产生异常或不一致状态。所有测试均使用纯 TextModel API，无需完整 Editor DOM。
 *
 * @module __tests__/editor-input
 */

// vitest 需要 jsdom 环境来满足 Monaco 初始化时的 DOM 依赖
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as monaco from 'monaco-editor';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 模拟 Backspace 删除光标前的字符。
 * Backspace 删除 (line, column-1) 处的字符，即光标前的字符。
 * 结果范围 = [line, col-1, line, col]。
 */
function simulateBackspace(
  model: monaco.editor.ITextModel,
  lineNumber: number,
  column: number,
): void {
  if (column <= 1) {
    // 行首 Backspace：删除上一行的换行符（行尾 + 当前行首）
    // 即删除 range [line-1, lineNLen+1, line, 1]
    if (lineNumber <= 1) return;
    const prevLineLen = model.getLineLength(lineNumber - 1);
    model.applyEdits([
      {
        range: new monaco.Range(
          lineNumber - 1,
          prevLineLen + 1,
          lineNumber,
          1,
        ),
        text: '',
      },
    ]);
  } else {
    // 行中 Backspace：删除前一个字符
    model.applyEdits([
      {
        range: new monaco.Range(
          lineNumber,
          column - 1,
          lineNumber,
          column,
        ),
        text: '',
      },
    ]);
  }
}

/**
 * 模拟方向键上移（移至上一行，尽量保持列位置）。
 * 源位置先通过 validatePosition 规范化（处理越界情况），
 * 再计算目标位置。
 */
function simulateArrowUp(
  model: monaco.editor.ITextModel,
  lineNumber: number,
  column: number,
): { lineNumber: number; column: number } {
  const srcPos = model.validatePosition({ lineNumber, column });
  const targetLine = Math.max(1, srcPos.lineNumber - 1);
  const targetColumn = Math.min(
    srcPos.column,
    model.getLineLength(targetLine) + 1,
  );
  return model.validatePosition({
    lineNumber: targetLine,
    column: targetColumn,
  });
}

/**
 * 模拟方向键下移（移至下一行，尽量保持列位置）。
 * 源位置先通过 validatePosition 规范化（处理越界情况），
 * 再计算目标位置。
 */
function simulateArrowDown(
  model: monaco.editor.ITextModel,
  lineNumber: number,
  column: number,
): { lineNumber: number; column: number } {
  const srcPos = model.validatePosition({ lineNumber, column });
  const targetLine = Math.min(model.getLineCount(), srcPos.lineNumber + 1);
  const targetColumn = Math.min(
    srcPos.column,
    model.getLineLength(targetLine) + 1,
  );
  return model.validatePosition({
    lineNumber: targetLine,
    column: targetColumn,
  });
}

// ============================================================================
// 测试套件
// ============================================================================

describe('Monaco TextModel 基本输入操作 (Backspace/方向键/连续编辑)', () => {
  // ====================================================================
  // TC-1: Backspace 删除尾随空行
  // ====================================================================
  //
  // 场景: 'line1\nline2\n\nline4'
  //   行 1: "line1"
  //   行 2: "line2"
  //   行 3: "" (空行)
  //   行 4: "line4"
  //
  // 操作: 在空行 (line 3, col 1) 执行 Backspace:
  //   - 删除 line 2 和 line 3 之间的换行符
  //   - line 3 变为空并被合并，line 4 上移
  //
  // 预期: getLineCount() 从 4 减少为 3
  // ====================================================================
  it('[TC-1] Backspace 删除尾随空行后行数减少', () => {
    const model = monaco.editor.createModel('line1\nline2\n\nline4');

    expect(model.getLineCount()).toBe(4);
    expect(model.getLineContent(1)).toBe('line1');
    expect(model.getLineContent(2)).toBe('line2');
    expect(model.getLineContent(3)).toBe('');
    expect(model.getLineContent(4)).toBe('line4');

    // Act: 在 line 3 col 1（空行首）执行 Backspace
    simulateBackspace(model, 3, 1);

    // Assert: 行数减少 1
    expect(model.getLineCount()).toBe(3);

    // Assert: line 2 和 line 3 的合并结果正确
    expect(model.getLineContent(2)).toBe('line2');
    expect(model.getLineContent(3)).toBe('line4');

    // Assert: 模型全文符合预期
    expect(model.getValue()).toBe('line1\nline2\nline4');
  });

  // ====================================================================
  // TC-2: Backspace 行中删除单字符
  // ====================================================================
  //
  // 在非行首位执行 Backspace 应仅删除前一个字符，不影响行结构。
  // ====================================================================
  it('[TC-2] Backspace 在行中删除单个字符不影响行结构', () => {
    const model = monaco.editor.createModel('hello\nworld');

    expect(model.getLineCount()).toBe(2);

    // Act: cursor at (1, 6), Backspace deletes 'o' (range [1,5]-[1,6]) → "hell"
    simulateBackspace(model, 1, 6);

    expect(model.getLineCount()).toBe(2);
    expect(model.getLineContent(1)).toBe('hell');
    expect(model.getValue()).toBe('hell\nworld');

    // Act: cursor at (1, 2), Backspace deletes 'h' (range [1,1]-[1,2]) → "ell"
    simulateBackspace(model, 1, 2);

    expect(model.getLineContent(1)).toBe('ell');
    expect(model.getLineCount()).toBe(2);
  });

  // ====================================================================
  // TC-3: 方向键移动光标位置合法性
  // ====================================================================
  //
  // validatePosition 验证位置合法性，越界位置会被自动裁剪。
  // 上移/下移保持列号尽量不变。
  // ====================================================================
  it('[TC-3] validatePosition 验证位置合法性', () => {
    const model = monaco.editor.createModel('line1\nline2\n\nline4');

    // 有效位置: line 2 col 3 → 原样返回
    const pos = model.validatePosition({ lineNumber: 2, column: 3 });
    expect(pos.lineNumber).toBe(2);
    expect(pos.column).toBe(3);

    // 列号越界: column 超过了 line 长度 → 自动裁剪到行尾 + 1
    const clamped = model.validatePosition({ lineNumber: 2, column: 100 });
    expect(clamped.lineNumber).toBe(2);
    // "line2" = 5 chars, 最大有效 column = 6
    expect(clamped.column).toBe(6);

    // 空行 line 3: column 1 有效
    const emptyLine = model.validatePosition({ lineNumber: 3, column: 1 });
    expect(emptyLine.lineNumber).toBe(3);
    expect(emptyLine.column).toBe(1);

    // 空行越界: column > 1 → 裁剪为 1
    const emptyClamped = model.validatePosition({ lineNumber: 3, column: 5 });
    expect(emptyClamped.lineNumber).toBe(3);
    expect(emptyClamped.column).toBe(1);
  });

  // ====================================================================
  // TC-4: 方向键上移保持列位置
  // ====================================================================
  it('[TC-4] 方向键上移保持列位置', () => {
    const model = monaco.editor.createModel('line1\nline2\n\nline4');

    // From (2, 3) → up → (1, 3): "line1" has 5 chars, col 3 is valid
    const up = simulateArrowUp(model, 2, 3);
    expect(up.lineNumber).toBe(1);
    expect(up.column).toBe(3);

    // From (2, 6) → up → (1, 6): "line1" has 5 chars, max col is 6
    const upEdge = simulateArrowUp(model, 2, 6);
    expect(upEdge.lineNumber).toBe(1);
    expect(upEdge.column).toBe(6);

    // From (2, 6) → up → (1, 6), OK
    const upWide = simulateArrowUp(model, 2, 6);
    expect(upWide.lineNumber).toBe(1);
    expect(upWide.column).toBe(6);
  });

  // ====================================================================
  // TC-5: 方向键下移保持列位置
  // ====================================================================
  it('[TC-5] 方向键下移保持列位置', () => {
    const model = monaco.editor.createModel('line1\nline2\n\nline4');

    // From (1, 3) → down → (2, 3)
    const down = simulateArrowDown(model, 1, 3);
    expect(down.lineNumber).toBe(2);
    expect(down.column).toBe(3);

    // From (1, 6) → down → (2, 6): "line2" has 5 chars, max col is 6
    const downEdge = simulateArrowDown(model, 1, 6);
    expect(downEdge.lineNumber).toBe(2);
    expect(downEdge.column).toBe(6);

    // From (1, 3) → down 2 steps → (3, 1): line 3 is empty, max col is 1
    const downEmpty = simulateArrowDown(model, 2, 3);
    expect(downEmpty.lineNumber).toBe(3);
    expect(downEmpty.column).toBe(1);

    // From (2, 3) → down to line 3 (empty) → clamped to (3, 1)
    // From (3, 1) → down to line 4 → column min(1, 5+1) = 1
    const downLast = simulateArrowDown(model, 3, 3);
    expect(downLast.lineNumber).toBe(4);
    expect(downLast.column).toBe(1);
  });

  // ====================================================================
  // TC-6: 快速连续输入不产生内容重复
  // ====================================================================
  //
  // 使用 applyEdits 模拟快速连续键入操作，验证最终内容与预期一致，
  // 不会出现字符重复或遗漏。
  // ====================================================================
  it('[TC-6] 快速连续输入不产生内容重复', () => {
    const model = monaco.editor.createModel('');

    // 第1次编辑: 在行首插入 "Hello"
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 1),
        text: 'Hello',
      },
    ]);
    expect(model.getValue()).toBe('Hello');

    // 第2次编辑: 在行尾追加 " World"
    model.applyEdits([
      {
        range: new monaco.Range(1, 6, 1, 6),
        text: ' World',
      },
    ]);
    expect(model.getValue()).toBe('Hello World');

    // 第3次编辑: 删除 "Hello"（range [1,1] - [1,6]）
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 6),
        text: '',
      },
    ]);
    expect(model.getValue()).toBe(' World');

    // 第4次编辑: 在行首插入 "Good"
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 1),
        text: 'Good',
      },
    ]);
    expect(model.getValue()).toBe('Good World');

    // 第5次编辑: 替换 "World" 为 "Moon"
    model.applyEdits([
      {
        range: new monaco.Range(1, 6, 1, 11),
        text: 'Moon',
      },
    ]);
    expect(model.getValue()).toBe('Good Moon');

    // 验证行结构不变（始终单行）
    expect(model.getLineCount()).toBe(1);
  });

  // ====================================================================
  // TC-7: 多行连续编辑保持行结构正确
  // ====================================================================
  //
  // 模拟在文本中间插入多行内容，验证行号和内容正确。
  // ====================================================================
  it('[TC-7] 多行连续编辑保持行结构正确', () => {
    const model = monaco.editor.createModel('line1\nline3');

    // 在 line 2 的起始位置插入新行 "line2"
    model.applyEdits([
      {
        range: new monaco.Range(2, 1, 2, 1),
        text: 'line2\n',
      },
    ]);

    expect(model.getLineCount()).toBe(3);
    expect(model.getLineContent(1)).toBe('line1');
    expect(model.getLineContent(2)).toBe('line2');
    expect(model.getLineContent(3)).toBe('line3');
    expect(model.getValue()).toBe('line1\nline2\nline3');

    // 在 line 1 和 line 2 之间再插入 "line1.5"
    model.applyEdits([
      {
        range: new monaco.Range(1, 6, 1, 6),
        text: '\nline1.5',
      },
    ]);

    expect(model.getLineCount()).toBe(4);
    expect(model.getLineContent(1)).toBe('line1');
    expect(model.getLineContent(2)).toBe('line1.5');
    expect(model.getLineContent(3)).toBe('line2');
    expect(model.getLineContent(4)).toBe('line3');
  });

  // ====================================================================
  // TC-8: 大范围替换不产生重复
  // ====================================================================
  //
  // 批量替换操作应原子化完成，不会导致中间状态泄漏或内容重复。
  // ====================================================================
  it('[TC-8] 大范围替换不产生重复', () => {
    const model = monaco.editor.createModel('aaa\nbbb\nccc');

    // 单次替换覆盖整个模型
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 3, 4),
        text: 'xxx\nyyy\nzzz',
      },
    ]);

    expect(model.getValue()).toBe('xxx\nyyy\nzzz');
    expect(model.getLineCount()).toBe(3);
    expect(model.getLineContent(1)).toBe('xxx');
    expect(model.getLineContent(2)).toBe('yyy');
    expect(model.getLineContent(3)).toBe('zzz');
  });

  // ====================================================================
  // TC-9: applyEdits 批量编辑保持一致性
  // ====================================================================
  //
  // 验证 applyEdits 的顺序执行和范围计算的正确性。
  // 每次编辑后重新计算范围（因为内容已经变化）。
  // ====================================================================
  it('[TC-9] 批量编辑保持一致性', () => {
    const model = monaco.editor.createModel('Hello World');

    // 第一次 applyEdits: 删除 "Hello "（6 个字符，范围 [1,1]-[1,7]）
    // "Hello World" → "World"
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 7),
        text: '',
      },
    ]);
    expect(model.getValue()).toBe('World');

    // 第二次 applyEdits: 在行尾追加 "s"
    model.applyEdits([
      {
        range: new monaco.Range(1, 6, 1, 6),
        text: 's',
      },
    ]);
    expect(model.getValue()).toBe('Worlds');

    // 第三次 applyEdits: 在开头插入 "Hello "
    model.applyEdits([
      {
        range: new monaco.Range(1, 1, 1, 1),
        text: 'Hello ',
      },
    ]);
    expect(model.getValue()).toBe('Hello Worlds');

    // 单行结构始终不变
    expect(model.getLineCount()).toBe(1);
  });
});
