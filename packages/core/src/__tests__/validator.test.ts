/**
 * 验证器单元测试 — W001-W006 + I001-I003
 *
 * @packageDocumentation
 * @remarks
 * 对每个检测规则构造独立数据场景，验证：
 * - 命中规则时产生正确的 DiagnosticCode
 * - 未命中规则时返回空数组
 * - 边界条件处理（空数据、极端值）
 */

import { describe, it, expect } from 'vitest';
import type { PlotFlowData, Chapter, StoryNode, Option, SideEffect } from '../types/ast.js';
import type { ConditionNode } from '../types/ast.js';

import {
  checkOrphanNodes,
  checkDeadEndNodes,
  checkUnusedVariables,
  checkDuplicateOptionDescriptions,
  checkEmptyBodyNodes,
  checkFormatIrregularities,
  checkPotentialSoftlock,
  checkShortBody,
  checkMissingChapter,
  validateAll,
  validate,
} from '../validator/index.js';

// ============================================================================
// 测试数据工厂
// ============================================================================

function createMinimalData(overrides?: Partial<PlotFlowData>): PlotFlowData {
  return {
    sourcePath: '/test/story.mdstory',
    meta: { plotflow: '0.1', title: '测试故事', author: 'test' },
    variables: [],
    chapters: [],
    ...overrides,
  };
}

function createChapter(id: string, title: string, nodes: StoryNode[], overrides?: Partial<Chapter>): Chapter {
  return {
    id,
    title,
    isAnonymous: false,
    nodes,
    lineNumber: 1,
    ...overrides,
  };
}

function createNode(
  id: string,
  title: string,
  body: string,
  options: Option[],
  overrides?: Partial<StoryNode>,
): StoryNode {
  return {
    id,
    fullId: id,
    title,
    body,
    options,
    chapterId: 'ch1',
    diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    lineNumber: 10,
    ...overrides,
  };
}

function createOption(
  description: string,
  targetNodeId: string | null,
  overrides?: Partial<Option>,
): Option {
  return {
    description,
    targetNodeId,
    targetChapterId: null,
    targetFullId: targetNodeId,
    indentLevel: 0,
    condition: null,
    sideEffects: [],
    conditionRaw: null,
    effectsRaw: null,
    lineNumber: 20,
    ...overrides,
  };
}

// ============================================================================
// W001 — 孤立节点
// ============================================================================

describe('W001 - 孤立节点', () => {
  it('标记无入口指向的非根节点为孤立', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('继续', 'node-a'),
    ], { diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] } });
    const orphan = createNode('orphan', '孤立节点', '正文', [], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const reachable = createNode('node-a', '可到达', '正文', [], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, orphan, reachable])],
    });

    const result = checkOrphanNodes(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W001');
    expect(result[0]!.relatedNodeId).toBe('orphan');
  });

  it('不标记根节点为孤立', () => {
    const root = createNode('root', '开始', '正文', [], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });
    expect(checkOrphanNodes(data)).toHaveLength(0);
  });

  it('所有节点都有入口时不产生诊断', () => {
    const n1 = createNode('n1', 'A', '正文', [createOption('去B', 'n2')], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', 'B', '正文', [createOption('去C', 'n3')]);
    const n3 = createNode('n3', 'C', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2, n3])],
    });

    expect(checkOrphanNodes(data)).toHaveLength(0);
  });

  it('空章节不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkOrphanNodes(data)).toHaveLength(0);
  });
});

// ============================================================================
// W002 — 死胡同节点
// ============================================================================

describe('W002 - 死胡同节点', () => {
  it('标记无选项的节点为死胡同', () => {
    const leaf = createNode('leaf', '终点', '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [leaf])],
    });

    const result = checkDeadEndNodes(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W002');
  });

  it('有选项的节点不标记', () => {
    const node = createNode('n1', '有选项', '正文', [createOption('继续', 'n2')]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkDeadEndNodes(data)).toHaveLength(0);
  });
});

// ============================================================================
// W003 — 未使用变量
// ============================================================================

describe('W003 - 未使用变量', () => {
  it('标记在条件中未使用的声明变量', () => {
    const data = createMinimalData({
      variables: [
        { name: 'used', type: 'bool', defaultValue: true, lineNumber: 2 },
        { name: 'unused', type: 'int', defaultValue: 0, lineNumber: 3 },
      ],
      chapters: [createChapter('ch1', '第一章', [
        createNode('n1', '测试', '正文', [
          createOption('去B', 'n2', {
            condition: {
              type: 'comparison',
              left: { operandType: 'variable', variableName: 'used' },
              operator: '==',
              right: { operandType: 'literal', literalValue: true },
            },
          }),
        ]),
      ])],
    });

    const result = checkUnusedVariables(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W003');
    expect(result[0]!.detail).toContain('unused');
  });

  it('标记在效果中未使用的声明变量', () => {
    const effect: SideEffect = { variableName: 'used', operation: 'set', value: 42, lineNumber: 21 };
    const data = createMinimalData({
      variables: [
        { name: 'used', type: 'int', defaultValue: 0, lineNumber: 2 },
        { name: 'unused', type: 'string', defaultValue: '', lineNumber: 3 },
      ],
      chapters: [createChapter('ch1', '第一章', [
        createNode('n1', '测试', '正文', [
          createOption('继续', 'n2', { sideEffects: [effect] }),
        ]),
      ])],
    });

    const result = checkUnusedVariables(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W003');
    expect(result[0]!.detail).toContain('unused');
  });

  it('所有变量都被引用时不产生诊断', () => {
    const effect: SideEffect = { variableName: 'hp', operation: 'set', value: 100, lineNumber: 21 };
    const data = createMinimalData({
      variables: [
        { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [
        createNode('n1', '测试', '正文', [
          createOption('继续', 'n2', { sideEffects: [effect] }),
        ]),
      ])],
    });

    expect(checkUnusedVariables(data)).toHaveLength(0);
  });

  it('无变量声明不产生诊断', () => {
    const data = createMinimalData();
    expect(checkUnusedVariables(data)).toHaveLength(0);
  });
});

// ============================================================================
// W004 — 重复选项描述
// ============================================================================

describe('W004 - 重复选项描述', () => {
  it('标记同一节点内的重复选项描述', () => {
    const node = createNode('n1', '测试', '正文', [
      createOption('往前走', 'n2'),
      createOption('往前走', 'n3'),  // 重复
      createOption('往右走', 'n4'),
    ]);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkDuplicateOptionDescriptions(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W004');
  });

  it('多组重复时正确计数', () => {
    const node = createNode('n1', '测试', '正文', [
      createOption('A', 'n2'),
      createOption('A', 'n3'), // 重复1
      createOption('B', 'n4'),
      createOption('B', 'n5'), // 重复2
    ]);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    expect(checkDuplicateOptionDescriptions(data)).toHaveLength(2);
  });

  it('无重复不产生诊断', () => {
    const node = createNode('n1', '测试', '正文', [
      createOption('往前走', 'n2'),
      createOption('往右走', 'n3'),
      createOption('往回走', 'n4'),
    ]);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    expect(checkDuplicateOptionDescriptions(data)).toHaveLength(0);
  });
});

// ============================================================================
// W005 — 空描述节点
// ============================================================================

describe('W005 - 空描述节点', () => {
  it('标记 body 为空的节点', () => {
    const node = createNode('n1', '测试', '', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkEmptyBodyNodes(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W005');
  });

  it('标记 body 仅为空白字符的节点', () => {
    const node = createNode('n1', '测试', '   \n  \t  ', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkEmptyBodyNodes(data)).toHaveLength(1);
  });

  it('非空 body 不产生诊断', () => {
    const node = createNode('n1', '测试', '这是一段正文描述', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkEmptyBodyNodes(data)).toHaveLength(0);
  });
});

// ============================================================================
// W006 — 格式不规范
// ============================================================================

describe('W006 - 格式不规范', () => {
  it('标记标题过长的节点', () => {
    const longTitle = 'A'.repeat(129);
    const node = createNode('n1', longTitle, '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkFormatIrregularities(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W006');
    expect(result[0]!.detail).toContain('129');
  });

  it('不标记标题长度恰好 128 的节点', () => {
    const title128 = 'A'.repeat(128);
    const node = createNode('n1', title128, '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkFormatIrregularities(data)).toHaveLength(0);
  });

  it('标记缩进超过 1 层的选项', () => {
    const node = createNode('n1', '测试', '正文', [
      createOption('正常', 'n2', { indentLevel: 0 }),
      createOption('缩进过深', 'n3', { indentLevel: 2 }),
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkFormatIrregularities(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('W006');
  });

  it('同时命中标题过长和缩进过深时产生多条诊断', () => {
    const longTitle = 'B'.repeat(129);
    const node = createNode('n1', longTitle, '正文', [
      createOption('缩进过深', 'n2', { indentLevel: 3 }),
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    // 1 条标题过长 + 1 条缩进过深
    expect(checkFormatIrregularities(data)).toHaveLength(2);
  });
});

// ============================================================================
// I001 — 可能卡关
// ============================================================================

describe('I001 - 可能卡关', () => {
  it('标记全部选项都有条件的节点', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: 'hp' },
      operator: '>',
      right: { operandType: 'literal', literalValue: 0 },
    };

    const node = createNode('n1', '战斗', '正文', [
      createOption('攻击', 'n2', { condition }),
      createOption('防御', 'n3', { condition }),
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkPotentialSoftlock(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('I001');
  });

  it('有选项无条件时不标记', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: 'hp' },
      operator: '>',
      right: { operandType: 'literal', literalValue: 0 },
    };

    const node = createNode('n1', '战斗', '正文', [
      createOption('攻击', 'n2', { condition }),
      createOption('逃跑', 'n3'), // 无条件 → 永远可达
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    expect(checkPotentialSoftlock(data)).toHaveLength(0);
  });

  it('跳过无选项的节点', () => {
    const node = createNode('n1', '终点', '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkPotentialSoftlock(data)).toHaveLength(0);
  });
});

// ============================================================================
// I002 — 描述过短
// ============================================================================

describe('I002 - 描述过短', () => {
  it('标记 body 少于 10 字符的节点', () => {
    const node = createNode('n1', '测试', '太短', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });

    const result = checkShortBody(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('I002');
  });

  it('不标记 body 恰好 10 个字符的节点', () => {
    const node = createNode('n1', '测试', '1234567890', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkShortBody(data)).toHaveLength(0);
  });

  it('跳过空 body 节点（由 W005 处理）', () => {
    const node = createNode('n1', '测试', '', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node])],
    });
    expect(checkShortBody(data)).toHaveLength(0);
  });
});

// ============================================================================
// I003 — 无章节归属
// ============================================================================

describe('I003 - 无章节归属', () => {
  it('标记匿名章节中的节点', () => {
    const node = createNode('n1', '孤立节点', '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('_anonymous', '', [node], { isAnonymous: true })],
    });

    const result = checkMissingChapter(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('I003');
  });

  it('不标记非匿名章节中的节点', () => {
    const node = createNode('n1', '正常节点', '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [node], { isAnonymous: false })],
    });
    expect(checkMissingChapter(data)).toHaveLength(0);
  });

  it('多个匿名节点正确计数', () => {
    const n1 = createNode('n1', '节点1', '正文', []);
    const n2 = createNode('n2', '节点2', '正文', []);
    const data = createMinimalData({
      chapters: [createChapter('_anon', '', [n1, n2], { isAnonymous: true })],
    });
    expect(checkMissingChapter(data)).toHaveLength(2);
  });
});

// ============================================================================
// validateAll — 一站式整合测试
// ============================================================================

describe('validateAll - 一站式验证', () => {
  it('返回所有规则的综合结果', () => {
    // W001: orphan（非 root 无入口）
    const orphan = createNode('orphan', '孤立', '', [], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    // W002: dead end（无选项）
    const deadEnd = createNode('deadend', '死胡同', '正文', []);
    // W005: empty body
    const emptyBody = createNode('empty', '空描述', '', [createOption('走', 'nowhere')]);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [orphan, deadEnd, emptyBody], { isAnonymous: true })],
    });

    const result = validateAll(data);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
    expect(result.summary.warnings).toBeGreaterThanOrEqual(3);
    expect(result.summary.infos).toBeGreaterThanOrEqual(1); // I003 — 匿名章节
    expect(result.summary.total).toBe(result.summary.errors + result.summary.warnings + result.summary.infos);
  });

  it('无问题的数据产生空诊断列表', () => {
    const root = createNode('root', '开始', '这是一个完整的描述文本。', [
      createOption('继续', 'next'),
    ], {
      lineNumber: 5,
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const next = createNode('next', '前进', '继续前进的完整描述文本。', [
      createOption('返回', 'root'),
    ], {
      lineNumber: 8,
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, next], { isAnonymous: false })],
    });
    const result = validateAll(data);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['W007']);
    expect(result.summary).toEqual({ errors: 0, warnings: 1, infos: 0, total: 1 });
  });
});

// ============================================================================
// computeSummary
// ============================================================================

describe('computeSummary', () => {
  it('正确统计各严重级别的数量', () => {
    const result = validateAll(createMinimalData({ chapters: [] }));
    // 无章节无节点 → 0 诊断
    expect(result.summary).toEqual({ errors: 0, warnings: 0, infos: 0, total: 0 });
  });
});

// ============================================================================
// validate — 主验证函数（17 条规则）
// ============================================================================

describe('validate - 17 条规则一站式验证', () => {
  it('至少检测出 3 种不同类型的诊断', () => {
    // 构造数据触发多种诊断：
    // E001: 选项指向不存在的节点
    // W002: 死胡同节点（无选项）
    // W005: 空描述节点
    // I003: 匿名章节节点
    const root = createNode('root', '开始', '正文', [
      createOption('去不存在的地方', 'no-such-node'), // E001
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const deadEnd = createNode('deadend', '死胡同', '正文', []); // W002
    const emptyBody = createNode('empty', '空描述', '', [createOption('走', 'nowhere')]); // W005 + E001

    const data = createMinimalData({
      chapters: [createChapter('_anon', '', [root, deadEnd, emptyBody], { isAnonymous: true })],
    });

    const result = validate(data);

    // 验证至少 3 种不同的诊断代码
    const codes = new Set(result.diagnostics.map((d) => d.code));
    expect(codes.size).toBeGreaterThanOrEqual(3);

    // 验证至少包含 E001 (错误), W002 (死胡同), I003 (匿名章节)
    expect(codes.has('E001')).toBe(true);
    expect(codes.has('W002')).toBe(true);
    expect(codes.has('I003')).toBe(true);

    // 验证 summary 正确
    expect(result.summary.errors).toBeGreaterThanOrEqual(2); // 2 个 E001
    expect(result.summary.warnings).toBeGreaterThanOrEqual(2); // W005 + W002
    expect(result.summary.infos).toBeGreaterThanOrEqual(3); // I003 × 3
    expect(result.summary.total).toBe(
      result.summary.errors + result.summary.warnings + result.summary.infos,
    );
  });

  it('Node diagnostics 字段被正确更新', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('继续', 'next'),
    ], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const orphan = createNode('orphan', '孤立', '正文', [], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const deadEnd = createNode('next', '前进', '', [], {
      diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('_anon', '', [root, orphan, deadEnd], { isAnonymous: true })],
    });

    validate(data);

    // root: 有入口? 检查——root 有个选项指向 next，但没有任何选项指向 root
    // root 本身没有入口 → 第一个无入口节点 → isRoot=true
    expect(root.diagnostics.isRoot).toBe(true);
    expect(root.diagnostics.isOrphan).toBe(false);
    expect(root.diagnostics.isDeadEnd).toBe(false);

    // orphan: 无入口，非根 → isOrphan=true
    expect(orphan.diagnostics.isOrphan).toBe(true);
    expect(orphan.diagnostics.isDeadEnd).toBe(true); // 也无出口

    // next: 有入口（root 的选项指向它），有出口? next 本身无选项
    // 有入口 → 非根，非孤立
    expect(deadEnd.diagnostics.isRoot).toBe(false);
    expect(deadEnd.diagnostics.isOrphan).toBe(false);
    expect(deadEnd.diagnostics.isDeadEnd).toBe(true); // 无出口选项

    // diagnosticIds 被追加
    expect(root.diagnostics.diagnosticIds.length).toBeGreaterThanOrEqual(1); // I003
    expect(orphan.diagnostics.diagnosticIds.length).toBeGreaterThanOrEqual(2); // W001 + I003
    expect(deadEnd.diagnostics.diagnosticIds.length).toBeGreaterThanOrEqual(2); // W002 + W005 + I003
  });

  it('validate 与 validateAll 结果一致', () => {
    const root = createNode('root', '开始', '完整的描述文本', [
      createOption('继续', 'next'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const next = createNode('next', '前进', '一段完整的描述', [
      createOption('返回', 'root'),
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, next], { isAnonymous: false })],
    });

    const resultA = validate(data);
    const resultB = validateAll(data);

    expect(resultA.diagnostics.length).toBe(resultB.diagnostics.length);
    expect(resultA.summary).toEqual(resultB.summary);
  });
});
