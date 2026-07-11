/**
 * 单元测试 — 选项解析器 (M1-03)
 */
import { describe, it, expect } from 'vitest';
import { parseOptions } from '../../parser/options.js';
import type { VariableDeclaration } from '../../types/ast.js';

const variables: VariableDeclaration[] = [
  { name: '金币', type: 'int', defaultValue: 0, lineNumber: 2 },
  { name: '好感度', type: 'float', defaultValue: 0.0, lineNumber: 3 },
  { name: '存活', type: 'bool', defaultValue: false, lineNumber: 4 },
  { name: '玩家名', type: 'string', defaultValue: '', lineNumber: 5 },
  { name: '职业', type: 'enum', defaultValue: '战士', enumValues: ['战士', '法师', '盗贼'], lineNumber: 6 },
  { name: '角色', type: 'object', defaultValue: {}, fields: [
    { name: '体力', type: 'int', defaultValue: 100, lineNumber: 8 },
    { name: '魔力', type: 'int', defaultValue: 50, lineNumber: 9 },
  ], lineNumber: 7 },
];

describe('parseOptions', () => {
  // ==========================================================================
  // 1. 空/边缘
  // ==========================================================================

  it('空 body → 空选项列表', () => {
    const result = parseOptions('', 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('只有空白 → 空选项列表', () => {
    const result = parseOptions('   \n  \n  ', 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('无 [选项] 行的正文 → 空选项', () => {
    const result = parseOptions('这是一段纯叙述文字。\n没有选项。', 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  // ==========================================================================
  // 2. 无条件无跳转选项（死胡同）
  // ==========================================================================

  it('选项缺少 -> 语法 → E005（死胡同）', () => {
    const body = '[选项] 结束旅程';
    const result = parseOptions(body, 5, variables);
    // 解析器容错：即使缺少 -> 也生成选项（targetNodeId=null），以 success + diagnostics 返回
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.targetNodeId).toBeNull();
      expect(result.diagnostics.some((d) => d.code === 'E005')).toBe(true);
    }
  });

  // ==========================================================================
  // 3. 无条件有跳转
  // ==========================================================================

  it('选项带 -> 跳转', () => {
    const body = '[选项] 向前走 -> 节点：森林深处';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.description).toBe('向前走');
      expect(result.data[0]!.targetNodeId).toBe('森林深处');
      expect(result.data[0]!.targetChapterId).toBeNull();
      expect(result.data[0]!.indentLevel).toBe(0);
    }
  });

  it('选项带章节前缀的目标引用：章节/节点', () => {
    const body = '[选项] 去城堡 -> 第二章/节点：城堡大门';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.targetNodeId).toBe('城堡大门');
      expect(result.data[0]!.targetChapterId).toBe('第二章');
    }
  });

  it('选项使用全角冒号 节点： → 正常解析', () => {
    const body = '[选项] 向左转 -> 节点：密道';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.targetNodeId).toBe('密道');
    }
  });

  // ==========================================================================
  // 4. 带条件子行
  // ==========================================================================

  it('选项带条件子行', () => {
    const body = `[选项] 购买药剂
  条件：$金币 >= 50`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.conditionRaw).toBe('$金币 >= 50');
      expect(result.data[0]!.condition).not.toBeNull();
      expect(result.data[0]!.condition!.type).toBe('comparison');
    }
  });

  it('选项带条件子行（全角冒号）', () => {
    const body = `[选项] 购买药剂
  条件：$金币 >= 50`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.conditionRaw).toBe('$金币 >= 50');
    }
  });

  it('条件子行无表达式 → E005', () => {
    const body = `[选项] 购买
  条件：`;
    const result = parseOptions(body, 5, variables);
    // 解析器容错：选项自身有效，条件子行空 → 选项被解析，E005 在 diagnostics 中
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.diagnostics.some((d) => d.code === 'E005')).toBe(true);
    }
  });

  // ==========================================================================
  // 5. 带效果子行
  // ==========================================================================

  it('选项带效果子行', () => {
    const body = `[选项] 获得奖励
  效果：(金币+10)`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.sideEffects).toHaveLength(1);
      expect(result.data[0]!.sideEffects[0]!.variableName).toBe('金币');
      expect(result.data[0]!.sideEffects[0]!.operation).toBe('add');
      expect(result.data[0]!.sideEffects[0]!.value).toBe(10);
    }
  });

  it('效果子行无表达式 → E005', () => {
    const body = `[选项] 测试
  效果：`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.diagnostics.some((d) => d.code === 'E005')).toBe(true);
    }
  });

  // ==========================================================================
  // 6. 条件+效果同时存在
  // ==========================================================================

  it('选项同时带条件和效果', () => {
    const body = `[选项] 购买 -> 节点：商店
  条件：$金币 >= 100
  效果：(金币-50)`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const opt = result.data[0]!;
      expect(opt.targetNodeId).toBe('商店');
      expect(opt.condition).not.toBeNull();
      expect(opt.sideEffects).toHaveLength(1);
      expect(opt.sideEffects[0]!.operation).toBe('subtract');
    }
  });

  // ==========================================================================
  // 7. 缩进选项
  // ==========================================================================

  it('选项缩进 1 级（一个 Tab）', () => {
    const body = '\t[选项] 缩进选项 -> 节点：目标';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.indentLevel).toBe(1);
    }
  });

  it('选项缩进超过最大限制 → 钳制为 1 并报 W006', () => {
    const body = '\t\t[选项] 过度缩进 -> 节点：目标';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.indentLevel).toBe(1);
      const hasW006 = result.diagnostics.some((d) => d.code === 'W006');
      expect(hasW006).toBe(true);
    }
  });

  // ==========================================================================
  // 8. 格式错误
  // ==========================================================================

  it('只有 [选项] 无描述 → E005', () => {
    const body = '[选项]';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(false);
  });

  it('[选项] 后无空格 → 正则不匹配 → E005', () => {
    const body = '[选项]无空格';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(false);
  });

  it('-> 之后缺少目标 → E005', () => {
    const body = '[选项] 描述 -> ';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.targetNodeId).toBeNull();
      expect(result.diagnostics.some((d) => d.code === 'E005')).toBe(true);
    }
  });

  it('目标引用格式错误（不是节点：XXX） → E005', () => {
    const body = '[选项] 描述 -> 直接跳转';
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.targetNodeId).toBeNull();
      expect(result.diagnostics.some((d) => d.code === 'E005')).toBe(true);
    }
  });

  it('重复条件子行 → W006 警告', () => {
    const body = `[选项] 测试
  条件：$金币 > 0
  条件：$金币 >= 10`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const hasW006 = result.diagnostics.some((d) => d.code === 'W006');
      expect(hasW006).toBe(true);
    }
  });

  // ==========================================================================
  // 9. 多选项节点
  // ==========================================================================

  it('多选项节点', () => {
    const body = `[选项] 选项一 -> 节点：目标A
[选项] 选项二 -> 节点：目标B
[选项] 选项三 -> 节点：目标C`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]!.targetNodeId).toBe('目标A');
      expect(result.data[1]!.targetNodeId).toBe('目标B');
      expect(result.data[2]!.targetNodeId).toBe('目标C');
    }
  });

  it('混合选项（有条件/效果的和无条件的）', () => {
    const body = `[选项] 选项一 -> 节点：A
[选项] 选项二
  条件：$金币 > 0
[选项] 选项三 -> 节点：B
  效果：(好感度+5)`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('选项描述过长（超 1024 码点） → 截断并报 W006', () => {
    const longDesc = 'x'.repeat(1030);
    const body = `[选项] ${longDesc} -> 节点：目标`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.data[0]!.description].length).toBe(1024);
      const hasW006 = result.diagnostics.some((d) => d.code === 'W006');
      expect(hasW006).toBe(true);
    }
  });

  // ==========================================================================
  // 10. 条件/效果子解析错误容错
  // ==========================================================================

  it('条件子解析错误不阻止选项生成', () => {
    const body = `[选项] 测试 -> 节点：目标
  条件：$未声明变量 > 0`;
    const result = parseOptions(body, 5, variables);
    // 选项自身成功，但条件解析错误
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      // 条件解析的 E002 会出现在 diagnostics 中
    }
  });

  it('效果子解析错误不阻止选项生成', () => {
    const body = `[选项] 测试 -> 节点：目标
  效果：(未声明变量+10)`;
    const result = parseOptions(body, 5, variables);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });
});
