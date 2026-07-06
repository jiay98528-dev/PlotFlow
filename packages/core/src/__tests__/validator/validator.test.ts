/**
 * 验证器单元测试 — E001~E008 错误检测规则
 *
 * @packageDocumentation
 * @remarks
 * 覆盖所有 8 种错误诊断类型，验证：
 * - 命中规则时产生正确的 DiagnosticCode
 * - Diagnostic 的 code / severity / range / relatedNodeId 正确
 * - 未命中规则时返回空数组
 * - 边界条件处理（空数据、极端值）
 * - 聚合函数 computeSummary / validateErrors / runValidations / checkAllErrors
 *
 * 对应规范：
 * - spec/syntax-formal.md 各节的错误规则
 * - doc/TAD.md 6 类型系统 (Validator 层)
 * - spec/milestones.md M3 验证器
 */

import { describe, it, expect } from 'vitest';
import type {
  PlotFlowData,
  Chapter,
  StoryNode,
  Option,
  SideEffect,
  VariableDeclaration,
} from '../../types/ast.js';
import type { ConditionNode } from '../../types/ast.js';

import {
  checkUndefinedTargetNode,
  checkUndeclaredVariable,
  checkInvalidEnumValue,
  checkTypeMismatch,
  checkE005,
  checkE006,
  checkE007,
  checkE008,
  validateErrors,
  runValidations,
  checkAllErrors,
  validate,
  computeSummary,
} from '../../validator/index.js';

import type { Diagnostic } from '../../types/diagnostic.js';
import { createDiagnostic, rangeAtLine } from '../../validator/helpers.js';

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

function createChapter(
  id: string,
  title: string,
  nodes: StoryNode[],
  overrides?: Partial<Chapter>,
): Chapter {
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
// E001 — 未定义目标节点
// ============================================================================

describe('E001 - 未定义目标节点', () => {
  it('检测选项 targetFullId 指向不存在的节点', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('去不存在的地方', 'non-existent-node'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    const result = checkUndefinedTargetNode(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E001');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.relatedNodeId).toBe('root');
    expect(result[0]!.detail).toContain('non-existent-node');
  });

  it('检测选项 targetNodeId 指向不存在的节点（targetFullId 为空时）', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('去未知节点', 'unknown', { targetFullId: null }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    const result = checkUndefinedTargetNode(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E001');
    expect(result[0]!.detail).toContain('unknown');
  });

  it('所有目标节点都存在时不产生诊断', () => {
    const n1 = createNode('n1', 'A', '正文', [
      createOption('去B', 'n2'),
      createOption('去C', 'n3'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', 'B', '正文', []);
    const n3 = createNode('n3', 'C', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2, n3])],
    });

    expect(checkUndefinedTargetNode(data)).toHaveLength(0);
  });

  it('targetNodeId 为 null 时跳过检查', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('无条件选项', null),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    expect(checkUndefinedTargetNode(data)).toHaveLength(0);
  });

  it('空章节不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkUndefinedTargetNode(data)).toHaveLength(0);
  });
});

// ============================================================================
// E002 — 未声明变量
// ============================================================================

describe('E002 - 未声明变量', () => {
  it('检测条件中引用了未声明的变量', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '未声明变量' },
      operator: '==',
      right: { operandType: 'literal', literalValue: 42 },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查条件', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '声明的变量', type: 'int', defaultValue: 0, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkUndeclaredVariable(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E002');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.detail).toContain('未声明变量');
  });

  it('检测效果中引用了未声明的变量', () => {
    const effect: SideEffect = {
      variableName: '未声明变量',
      operation: 'set',
      value: 100,
      lineNumber: 21,
    };

    const root = createNode('root', '开始', '正文', [
      createOption('设置变量', 'n2', { sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkUndeclaredVariable(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E002');
    expect(result[0]!.detail).toContain('未声明变量');
  });

  it('所有引用变量都已声明时不产生诊断', () => {
    const effect: SideEffect = {
      variableName: 'hp',
      operation: 'set',
      value: 100,
      lineNumber: 21,
    };

    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: 'hp' },
      operator: '>',
      right: { operandType: 'literal', literalValue: 0 },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('战斗', 'n2', { condition, sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkUndeclaredVariable(data)).toHaveLength(0);
  });

  it('无变量引用时不产生诊断', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('继续', 'n2'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkUndeclaredVariable(data)).toHaveLength(0);
  });
});

// ============================================================================
// E003 — 枚举值非法
// ============================================================================

describe('E003 - 枚举值非法', () => {
  it('检测效果中 set 枚举变量为非法值', () => {
    const effect: SideEffect = {
      variableName: '武器',
      operation: 'set',
      value: '非法武器',
      lineNumber: 21,
    };

    const root = createNode('root', '开始', '正文', [
      createOption('装备武器', 'n2', { sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkInvalidEnumValue(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E003');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.detail).toContain('武器');
    expect(result[0]!.detail).toContain('非法武器');
  });

  it('检测条件中枚举变量与非法字面量比较', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '武器' },
      operator: '==',
      right: { operandType: 'literal', literalValue: '非法值' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查武器', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkInvalidEnumValue(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E003');
    expect(result[0]!.detail).toContain('非法值');
  });

  it('检测条件中右侧枚举变量与非法字面量比较', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'literal', literalValue: '非法值' },
      operator: '==',
      right: { operandType: 'variable', variableName: '武器' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查武器', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkInvalidEnumValue(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E003');
  });

  it('合法的枚举值不产生诊断', () => {
    const effect: SideEffect = {
      variableName: '武器',
      operation: 'set',
      value: '剑',
      lineNumber: 21,
    };

    const root = createNode('root', '开始', '正文', [
      createOption('装备剑', 'n2', { sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkInvalidEnumValue(data)).toHaveLength(0);
  });

  it('非 ==/!= 比较运算符跳过枚举检查', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '武器' },
      operator: '>',
      right: { operandType: 'literal', literalValue: '剑' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('比较武器', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkInvalidEnumValue(data)).toHaveLength(0);
  });
});

// ============================================================================
// E004 — 类型不匹配
// ============================================================================

describe('E004 - 类型不匹配', () => {
  it('检测条件中 int 变量与 string 字面量比较', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '血量' },
      operator: '==',
      right: { operandType: 'literal', literalValue: '满血' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查血量', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '血量', type: 'int', defaultValue: 100, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkTypeMismatch(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E004');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.detail).toContain('血量');
  });

  it('检测效果中 bool 变量被设为 string 值', () => {
    const effect: SideEffect = {
      variableName: '有钥匙',
      operation: 'set',
      value: '是',
      lineNumber: 21,
    };

    const root = createNode('root', '开始', '正文', [
      createOption('获得钥匙', 'n2', { sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '有钥匙', type: 'bool', defaultValue: false, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkTypeMismatch(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E004');
    expect(result[0]!.detail).toContain('有钥匙');
  });

  it('检测两个变量类型不兼容的比较', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '血量' },
      operator: '==',
      right: { operandType: 'variable', variableName: '有钥匙' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('对比变量', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '血量', type: 'int', defaultValue: 100, lineNumber: 2 },
        { name: '有钥匙', type: 'bool', defaultValue: false, lineNumber: 3 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    const result = checkTypeMismatch(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E004');
    expect(result[0]!.detail).toContain('血量');
    expect(result[0]!.detail).toContain('有钥匙');
  });

  it('int 与 float 互相兼容不产生诊断', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '血量' },
      operator: '>',
      right: { operandType: 'literal', literalValue: 50.5 },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查血量', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '血量', type: 'int', defaultValue: 100, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkTypeMismatch(data)).toHaveLength(0);
  });

  it('string 与 enum 互相兼容不产生诊断', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '武器' },
      operator: '==',
      right: { operandType: 'literal', literalValue: '剑' },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('检查武器', 'n2', { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkTypeMismatch(data)).toHaveLength(0);
  });

  it('效果值与声明类型匹配时不产生诊断', () => {
    const effect: SideEffect = {
      variableName: '血量',
      operation: 'set',
      value: 100,
      lineNumber: 21,
    };

    const root = createNode('root', '开始', '正文', [
      createOption('设置血量', 'n2', { sideEffects: [effect] }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      variables: [
        { name: '血量', type: 'int', defaultValue: 0, lineNumber: 2 },
      ],
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkTypeMismatch(data)).toHaveLength(0);
  });
});

// ============================================================================
// E005 — 语法解析失败（无跳转目标且无条件）
// ============================================================================

describe('E005 - 语法解析失败', () => {
  it('检测 targetNodeId 和 condition 均为 null 的选项', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('缺失目标', null),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    const result = checkE005(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E005');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.relatedNodeId).toBe('root');
  });

  it('有 targetNodeId 的选项不触发', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('正常选项', 'n2'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', '目标', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, n2])],
    });

    expect(checkE005(data)).toHaveLength(0);
  });

  it('有 condition 但无 target 的选项不触发 E005', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: 'hp' },
      operator: '>',
      right: { operandType: 'literal', literalValue: 0 },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('条件选项', null, { condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    expect(checkE005(data)).toHaveLength(0);
  });

  it('空章节不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkE005(data)).toHaveLength(0);
  });
});

// ============================================================================
// E006 — 嵌套深度超限
// ============================================================================

describe('E006 - 嵌套深度超限', () => {
  it('检测超过 3 层的 object 嵌套', () => {
    const variables: VariableDeclaration[] = [
      {
        name: 'deep',
        type: 'object',
        defaultValue: {},
        lineNumber: 2,
        fields: [
          {
            name: 'lvl1',
            type: 'object',
            defaultValue: {},
            lineNumber: 3,
            fields: [
              {
                name: 'lvl2',
                type: 'object',
                defaultValue: {},
                lineNumber: 4,
                fields: [
                  {
                    name: 'lvl3',
                    type: 'object',
                    defaultValue: {},
                    lineNumber: 5,
                    fields: [
                      // This is level 4 → should trigger E006
                      {
                        name: 'lvl4',
                        type: 'int',
                        defaultValue: 0,
                        lineNumber: 6,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const data = createMinimalData({ variables, chapters: [] });

    const result = checkE006(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E006');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.detail).toContain('deep');
    expect(result[0]!.detail).toContain('4 层');
  });

  it('恰好 3 层嵌套不触发', () => {
    const variables: VariableDeclaration[] = [
      {
        name: '角色',
        type: 'object',
        defaultValue: {},
        lineNumber: 2,
        fields: [
          {
            name: '属性',
            type: 'object',
            defaultValue: {},
            lineNumber: 3,
            fields: [
              {
                name: '基础',
                type: 'object',
                defaultValue: {},
                lineNumber: 4,
                fields: [
                  {
                    name: '体力',
                    type: 'int',
                    defaultValue: 100,
                    lineNumber: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const data = createMinimalData({ variables, chapters: [] });

    expect(checkE006(data)).toHaveLength(0);
  });

  it('非 object 变量不触发', () => {
    const variables: VariableDeclaration[] = [
      { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 2 },
      { name: 'name', type: 'string', defaultValue: '', lineNumber: 3 },
      { name: 'alive', type: 'bool', defaultValue: true, lineNumber: 4 },
    ];

    const data = createMinimalData({ variables, chapters: [] });

    expect(checkE006(data)).toHaveLength(0);
  });

  it('无变量不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkE006(data)).toHaveLength(0);
  });
});

// ============================================================================
// E007 — 节点 ID 重名
// ============================================================================

describe('E007 - 节点 ID 重名', () => {
  it('检测同一章节内重复的 fullId', () => {
    const n1 = createNode('duplicate', '重复节点', '正文A', []);
    const n2 = createNode('duplicate', '重复节点', '正文B', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2])],
    });

    const result = checkE007(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E007');
    expect(result[0]!.severity).toBe('error');
    // fullId = 'duplicate' 重复
    expect(result[0]!.detail).toContain('duplicate');
    expect(result[0]!.detail).toContain('重复');
  });

  it('不同 chapter 中相同 id 的节点 fullId 不同，不触发', () => {
    const nCh1 = createNode('node-a', '节点A', '正文', [], {
      fullId: 'ch1-node-a',
      chapterId: 'ch1',
    });
    const nCh2 = createNode('node-a', '节点A', '正文', [], {
      fullId: 'ch2-node-a',
      chapterId: 'ch2',
    });

    const data = createMinimalData({
      chapters: [
        createChapter('ch1', '第一章', [nCh1]),
        createChapter('ch2', '第二章', [nCh2]),
      ],
    });

    expect(checkE007(data)).toHaveLength(0);
  });

  it('三个相同 fullId 时正确计数（第 2、3 个标记为重复）', () => {
    const n1 = createNode('trip', '三连', '正文A', []);
    const n2 = createNode('trip', '三连', '正文B', []);
    const n3 = createNode('trip', '三连', '正文C', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2, n3])],
    });

    const result = checkE007(data);
    expect(result).toHaveLength(2);
    expect(result[0]!.code).toBe('E007');
    expect(result[1]!.code).toBe('E007');
  });

  it('空节点不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkE007(data)).toHaveLength(0);
  });
});

// ============================================================================
// E008 — 变量重复声明
// ============================================================================

describe('E008 - 变量重复声明', () => {
  it('检测顶层变量同名', () => {
    const variables: VariableDeclaration[] = [
      { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 2 },
      { name: 'hp', type: 'int', defaultValue: 50, lineNumber: 3 },
    ];

    const data = createMinimalData({
      variables,
      chapters: [],
    });

    const result = checkE008(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E008');
    expect(result[0]!.severity).toBe('error');
    expect(result[0]!.detail).toContain('hp');
    expect(result[0]!.detail).toContain('重复声明');
  });

  it('检测嵌套 object 字段与顶层变量同名', () => {
    const variables: VariableDeclaration[] = [
      {
        name: '角色',
        type: 'object',
        defaultValue: {},
        lineNumber: 2,
        fields: [
          { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 3 },
        ],
      },
      { name: 'hp', type: 'int', defaultValue: 50, lineNumber: 5 },
    ];

    const data = createMinimalData({
      variables,
      chapters: [],
    });

    const result = checkE008(data);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E008');
    expect(result[0]!.detail).toContain('hp');
  });

  it('检测嵌套 object 字段之间的同名', () => {
    const variables: VariableDeclaration[] = [
      {
        name: '角色',
        type: 'object',
        defaultValue: {},
        lineNumber: 2,
        fields: [
          {
            name: '属性',
            type: 'object',
            defaultValue: {},
            lineNumber: 3,
            fields: [
              { name: '体力', type: 'int', defaultValue: 100, lineNumber: 4 },
            ],
          },
        ],
      },
      {
        name: '敌人',
        type: 'object',
        defaultValue: {},
        lineNumber: 6,
        fields: [
          { name: '体力', type: 'int', defaultValue: 80, lineNumber: 7 },
        ],
      },
    ];

    const data = createMinimalData({
      variables,
      chapters: [],
    });

    const result = checkE008(data);
    // seenNames 跨所有变量共享，第二次出现 '体力' 时触发 1 条诊断
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('E008');
    expect(result[0]!.detail).toContain('体力');
  });

  it('所有变量名唯一时不产生诊断', () => {
    const variables: VariableDeclaration[] = [
      { name: 'hp', type: 'int', defaultValue: 100, lineNumber: 2 },
      { name: 'mp', type: 'int', defaultValue: 50, lineNumber: 3 },
      { name: 'name', type: 'string', defaultValue: '', lineNumber: 4 },
    ];

    const data = createMinimalData({
      variables,
      chapters: [],
    });

    expect(checkE008(data)).toHaveLength(0);
  });

  it('无变量不产生诊断', () => {
    const data = createMinimalData({ chapters: [] });
    expect(checkE008(data)).toHaveLength(0);
  });
});

// ============================================================================
// validateErrors — E001~E004 聚合
// ============================================================================

describe('validateErrors - E001~E004 聚合', () => {
  it('同时检测多种错误类型', () => {
    // E001: 选项指向不存在的节点
    // E002: 条件引用未声明变量
    // E003: 枚举变量设为非法值
    const effect: SideEffect = {
      variableName: '武器',
      operation: 'set',
      value: '火箭筒',
      lineNumber: 22,
    };

    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '未声明' },
      operator: '==',
      right: { operandType: 'literal', literalValue: true },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('去未知', 'non-existent', { sideEffects: [effect], condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      variables: [
        {
          name: '武器',
          type: 'enum',
          defaultValue: '无',
          lineNumber: 2,
          enumValues: ['无', '剑', '弓', '杖'],
        },
      ],
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    const result = validateErrors(data);
    // E001 (undefined target) + E002 (undeclared var) + E003 (invalid enum value)
    // + E004 (condition type mismatch between bool literal and undeclared var — skipped because undeclared)
    // Actually E002 and E003 both fire. E004 for the condition will check if the variable is declared
    // which it's not (no varInfo found), so E004 won't fire for that. But E003 for the side effect will.
    // Let's also check: the condition references undeclared var → E002
    // The effect sets enum to '火箭筒' not in list → E003
    // The option targets 'non-existent' → E001
    // So we should have at least 3
    expect(result.length).toBeGreaterThanOrEqual(3);
    const codes = result.map((d) => d.code);
    expect(codes).toContain('E001');
    expect(codes).toContain('E002');
    expect(codes).toContain('E003');
  });

  it('无错误时返回空数组', () => {
    const n1 = createNode('n1', 'A', '正文', [
      createOption('去B', 'n2'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', 'B', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2])],
    });

    expect(validateErrors(data)).toHaveLength(0);
  });
});

// ============================================================================
// runValidations — E005~E008 聚合
// ============================================================================

describe('runValidations - E005~E008 聚合', () => {
  it('同时检测多种后解析错误', () => {
    // E005: 选项无目标无条件
    // E007: 节点 ID 重复
    const n1 = createNode('dup', '重复', '正文', [
      createOption('无目标无条件', null),
    ]);
    const n2 = createNode('dup', '重复', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2])],
    });

    const result = runValidations(data);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const codes = result.map((d) => d.code);
    expect(codes).toContain('E005');
    expect(codes).toContain('E007');
  });

  it('无错误时返回空数组', () => {
    const n1 = createNode('n1', 'A', '正文', [
      createOption('去B', 'n2'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const n2 = createNode('n2', 'B', '正文', []);

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [n1, n2])],
    });

    expect(runValidations(data)).toHaveLength(0);
  });
});

// ============================================================================
// checkAllErrors — E001~E008 聚合
// ============================================================================

describe('checkAllErrors - E001~E008 全错误聚合', () => {
  it('同时检测所有 8 种错误', () => {
    // E001: undefined target
    // E002: undeclared variable (condition references undeclared var)
    // E003: invalid enum value
    // E004: type mismatch (string value set to bool var)
    // E005: option without target and without condition
    // E006: deep nested object (>3 levels)
    // E007: duplicate node ID
    // E008: duplicate variable name

    // E001 + E002 + E003 + E004 + E005: node options
    const effectEnum: SideEffect = {
      variableName: '武器',
      operation: 'set',
      value: '核弹',
      lineNumber: 22,
    };
    const effectBool: SideEffect = {
      variableName: '有钥匙',
      operation: 'set',
      value: 'yes',
      lineNumber: 23,
    };
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '未声明' },
      operator: '==',
      right: { operandType: 'literal', literalValue: true },
    };

    const root = createNode('root', '开始', '正文', [
      createOption('去未知', 'non-existent', { sideEffects: [effectEnum, effectBool], condition }),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    // E005: option without target/condition
    const orphan = createNode('orphan', '孤立', '正文', [
      createOption('无目标无条件', null),
    ]);

    // E007: duplicate node ID
    const dup1 = createNode('dup', '重复', '正文', []);
    const dup2 = createNode('dup', '重复', '正文', []);

    // E006: deep nested variable
    const variables: VariableDeclaration[] = [
      {
        name: 'deep',
        type: 'object',
        defaultValue: {},
        lineNumber: 2,
        fields: [
          {
            name: 'a',
            type: 'object',
            defaultValue: {},
            lineNumber: 3,
            fields: [
              {
                name: 'b',
                type: 'object',
                defaultValue: {},
                lineNumber: 4,
                fields: [
                  {
                    name: 'c',
                    type: 'object',
                    defaultValue: {},
                    lineNumber: 5,
                    fields: [
                      { name: 'd', type: 'int', defaultValue: 0, lineNumber: 6 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      // E008: duplicate variable name
      { name: '武器', type: 'enum', defaultValue: '无', lineNumber: 8, enumValues: ['无', '剑'] },
      { name: '武器', type: 'enum', defaultValue: '弓', lineNumber: 9, enumValues: ['弓', '杖'] },
      { name: '有钥匙', type: 'bool', defaultValue: false, lineNumber: 10 },
    ];

    const data = createMinimalData({
      variables,
      chapters: [createChapter('ch1', '第一章', [root, orphan, dup1, dup2])],
    });

    const result = checkAllErrors(data);
    const codes = new Set(result.map((d) => d.code));

    expect(codes.has('E001')).toBe(true);
    expect(codes.has('E002')).toBe(true);
    expect(codes.has('E003')).toBe(true);
    expect(codes.has('E004')).toBe(true);
    expect(codes.has('E005')).toBe(true);
    expect(codes.has('E006')).toBe(true);
    expect(codes.has('E007')).toBe(true);
    expect(codes.has('E008')).toBe(true);

    // summary: all are errors
    const summary = computeSummary(result);
    expect(summary.errors).toBe(result.length);
    expect(summary.total).toBe(result.length);
  });
});

// ============================================================================
// validate — 一站式验证（17 条规则）
// ============================================================================

describe('validate - 17 条规则一站式验证', () => {
  it('正确分类 error / warning / info', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('去未知', 'non-existent'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('_anon', '', [root], { isAnonymous: true })],
    });

    const result = validate(data);
    // E001 (error) + I003 (info for anonymous chapter node)
    expect(result.summary.errors).toBeGreaterThanOrEqual(1);
    expect(result.summary.infos).toBeGreaterThanOrEqual(1);
    expect(result.summary.total).toBe(
      result.summary.errors + result.summary.warnings + result.summary.infos,
    );
  });

  it('诊断 id 格式正确', () => {
    const root = createNode('root', '开始', '正文', [
      createOption('去未知', 'non-existent'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });

    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root])],
    });

    const result = validate(data);
    for (const d of result.diagnostics) {
      expect(d.id).toMatch(/^[A-Z]\d{3}@L\d+:\d+$/);
    }
  });

  it('validate 与 checkAllErrors + validateAll 一致', () => {
    const root = createNode('root', '开始', '这是一个完整的描述文本内容。', [
      createOption('继续', 'next'),
    ], {
      diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
    });
    const next = createNode('next', '前进', '继续前进的一段完整描述正文。', [
      createOption('返回', 'root'),
    ]);
    const data = createMinimalData({
      chapters: [createChapter('ch1', '第一章', [root, next], { isAnonymous: false })],
    });

    const result = validate(data);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['W007']);
    expect(result.summary).toEqual({ errors: 0, warnings: 1, infos: 0, total: 1 });
  });
});

// ============================================================================
// computeSummary
// ============================================================================

describe('computeSummary', () => {
  it('正确统计各严重级别的数量', () => {
    const diags: Diagnostic[] = [
      { id: 'E001@L1:1', code: 'E001', severity: 'error', message: 'm1', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } },
      { id: 'E002@L2:1', code: 'E002', severity: 'error', message: 'm2', range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 } },
      { id: 'W001@L3:1', code: 'W001', severity: 'warning', message: 'm3', range: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 2 } },
      { id: 'W002@L4:1', code: 'W002', severity: 'warning', message: 'm4', range: { startLine: 4, startColumn: 1, endLine: 4, endColumn: 2 } },
      { id: 'W003@L5:1', code: 'W003', severity: 'warning', message: 'm5', range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 2 } },
      { id: 'I001@L6:1', code: 'I001', severity: 'info', message: 'm6', range: { startLine: 6, startColumn: 1, endLine: 6, endColumn: 2 } },
      { id: 'I002@L7:1', code: 'I002', severity: 'info', message: 'm7', range: { startLine: 7, startColumn: 1, endLine: 7, endColumn: 2 } },
    ];

    const result = computeSummary(diags);
    expect(result).toEqual({ errors: 2, warnings: 3, infos: 2, total: 7 });
  });

  it('空列表返回全零', () => {
    expect(computeSummary([])).toEqual({ errors: 0, warnings: 0, infos: 0, total: 0 });
  });
});

// ============================================================================
// createDiagnostic / rangeAtLine (helper 工具函数)
// ============================================================================

describe('createDiagnostic 工具函数', () => {
  it('正确设置诊断属性', () => {
    const range = rangeAtLine(5);
    const diag = createDiagnostic('E001', range, '测试详情', 'node-1');

    expect(diag.id).toBe('E001@L5:1');
    expect(diag.code).toBe('E001');
    expect(diag.severity).toBe('error');
    expect(diag.message).toBeDefined();
    expect(diag.range).toEqual(range);
    expect(diag.detail).toBe('测试详情');
    expect(diag.relatedNodeId).toBe('node-1');
  });

  it('不带 detail 时不包含 detail 字段', () => {
    const range = rangeAtLine(1);
    const diag = createDiagnostic('I001', range);
    expect(diag.detail).toBeUndefined();
  });

  it('不带 relatedNodeId 时不包含该字段', () => {
    const range = rangeAtLine(1);
    const diag = createDiagnostic('W001', range);
    expect(diag.relatedNodeId).toBeUndefined();
  });

  it('rangeAtLine 生成正确的范围', () => {
    const range = rangeAtLine(42);
    expect(range).toEqual({
      startLine: 42,
      startColumn: 1,
      endLine: 42,
      endColumn: 2,
    });
  });
});
