/**
 * 警告检测规则 W001 — W006
 *
 * @packageDocumentation
 * @remarks
 * 每个函数接收 PlotFlowData，返回该规则检测到的 Diagnostic[]。
 * 对应 PRD §9.1 中定义的 6 种警告类型。
 *
 * @version 0.1.0
 */

import type { PlotFlowData, Option, VariableDeclaration } from '../types/ast.js';
import type { Diagnostic } from '../types/diagnostic.js';
import { createDiagnostic, rangeAtLine } from './helpers.js';
import { buildStoryAdjacency } from './adjacency.js';

// ============================================================================
// W001 — 孤立节点
// ============================================================================

/**
 * W001: 检测孤立节点。
 *
 * 定义：非根节点但没有任何选项的 targetNodeId 指向它。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkOrphanNodes(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 收集所有选项的目标节点 ID（fullId）
  const adjacency = buildStoryAdjacency(data);
  // 遍历所有节点，找出孤立节点
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      // 跳过根节点（根节点由解析器标记）
      if (node.diagnostics.isRoot) {
        continue;
      }

      // 如果没有任何选项指向此节点，且非根节点 → 孤立
      if (!adjacency.incomingByTargetFullId.has(node.fullId)) {
        diagnostics.push(
          createDiagnostic(
            'W001',
            rangeAtLine(node.lineNumber),
            `节点「${node.title}」（${node.id}）无任何入口选项指向，为孤立节点`,
            node.fullId,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// W002 — 死胡同节点
// ============================================================================

/**
 * W002: 检测死胡同节点。
 *
 * 定义：节点有 0 个选项（leaf node）。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkDeadEndNodes(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const adjacency = buildStoryAdjacency(data);

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      if (!adjacency.outgoingBySourceFullId.has(node.fullId)) {
        diagnostics.push(
          createDiagnostic(
            'W002',
            rangeAtLine(node.lineNumber),
            `节点「${node.title}」无出口选项，读者将在此处卡住`,
            node.fullId,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// W003 — 未使用变量
// ============================================================================

/**
 * W003: 检测未使用的变量。
 *
 * 定义：variables 中声明但在任何条件/效果中未引用的变量。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkUnusedVariables(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 如果没有声明任何变量，直接返回
  if (data.variables.length === 0) {
    return diagnostics;
  }

  // 收集所有在条件和效果中被引用的变量名
  const referencedVariables = new Set<string>();

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        // 检查条件中的变量引用
        if (option.condition) {
          collectConditionVariables(option.condition, referencedVariables);
        }

        // 检查效果中的变量引用
        for (const effect of option.sideEffects) {
          referencedVariables.add(effect.variableName);
        }
      }

      for (const effect of node.nextTarget?.sideEffects ?? []) {
        referencedVariables.add(effect.variableName);
      }
    }
  }

  // 扁平化变量声明（含嵌套对象字段），找出声明的但未被引用的变量
  const declaredVars = flattenVars(data.variables);
  for (const [fullName, info] of declaredVars) {
    if (!referencedVariables.has(fullName)) {
      diagnostics.push(
        createDiagnostic(
          'W003',
          rangeAtLine(info.lineNumber),
          `变量「${fullName}」在故事中未使用，建议移除或添加引用`,
          undefined,
        ),
      );
    }
  }

  return diagnostics;
}

/**
 * 扁平化变量声明（含嵌套对象字段），构建完整路径名映射。
 * 与 validator.ts 中 collectDeclaredVariables 的递归模式一致。
 */
function flattenVars(
  variables: VariableDeclaration[],
): Map<string, { lineNumber: number }> {
  const map = new Map<string, { lineNumber: number }>();
  function walk(vars: VariableDeclaration[], prefix: string) {
    for (const v of vars) {
      const fullName = prefix ? `${prefix}.${v.name}` : v.name;
      map.set(fullName, { lineNumber: v.lineNumber });
      if (v.type === 'object' && v.fields) {
        walk(v.fields, fullName);
      }
    }
  }
  walk(variables, '');
  return map;
}

/**
 * 递归收集条件表达式树中引用的所有变量名。
 */
function collectConditionVariables(
  condition: { type: string; left?: { variableName?: string }; right?: { variableName?: string }; operands?: unknown[] },
  collected: Set<string>,
): void {
  if (condition.type === 'comparison') {
    // 比较表达式：检查左右操作数
    if (condition.left?.variableName) {
      collected.add(condition.left.variableName);
    }
    if (condition.right?.variableName) {
      collected.add(condition.right.variableName);
    }
  } else if (condition.type === 'logical') {
    // 逻辑表达式：递归检查子表达式
    if (condition.operands) {
      for (const operand of condition.operands) {
        collectConditionVariables(operand as Parameters<typeof collectConditionVariables>[0], collected);
      }
    }
  }
}

// ============================================================================
// W004 — 重复选项描述
// ============================================================================

/**
 * W004: 检测同一节点内重复的选项描述文本。
 *
 * 定义：同一节点内，两个或多个选项的 description 字符串相同。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkDuplicateOptionDescriptions(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      // 用 Map 分组：描述文本 → 选项列表
      const descMap = new Map<string, Option[]>();

      for (const option of node.options) {
        const existing = descMap.get(option.description) ?? [];
        existing.push(option);
        descMap.set(option.description, existing);
      }

      // 找出出现次数 > 1 的描述文本
      for (const [, options] of descMap) {
        if (options.length > 1) {
          // 第一个保留，其余标记为重复
          const duplicates = options.slice(1);
          for (const dup of duplicates) {
            diagnostics.push(
              createDiagnostic(
                'W004',
                rangeAtLine(dup.lineNumber),
                `选项描述「${dup.description}」与节点内其他选项重复`,
                node.fullId,
              ),
            );
          }
        }
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// W005 — 空描述节点
// ============================================================================

/**
 * W005: 检测正文为空的节点。
 *
 * 定义：节点 body 为空字符串或仅含空白字符。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkEmptyBodyNodes(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      if (node.body.trim() === '') {
        diagnostics.push(
          createDiagnostic(
            'W005',
            rangeAtLine(node.lineNumber),
            `节点「${node.title}」（${node.id}）正文描述为空，建议补充叙事内容`,
            node.fullId,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// W006 — 格式不规范
// ============================================================================

/**
 * W006: 检测格式不规范的编码实践。
 *
 * 定义含以下情况之一：
 * - 节点标题过长（>128 个字符）
 * - 缩进超过 1 层（indentLevel > 1）
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkFormatIrregularities(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      // 1. 节点标题过长（>128 字符）
      if (node.title.length > 128) {
        diagnostics.push(
          createDiagnostic(
            'W006',
            rangeAtLine(node.lineNumber),
            `节点标题过长（${node.title.length} 字符），建议不超过 128 字符`,
            node.fullId,
          ),
        );
      }

      // 2. 选项缩进超过 1 层
      for (const option of node.options) {
        if (option.indentLevel > 1) {
          diagnostics.push(
            createDiagnostic(
              'W006',
              rangeAtLine(option.lineNumber),
              `选项缩进超过 1 层（当前 ${option.indentLevel} 层），建议使用扁平结构`,
              node.fullId,
            ),
          );
        }
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// W007 - closed cycle risk
// ============================================================================

export function checkClosedCycles(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const adjacency = buildStoryAdjacency(data);
  const nodeMeta = new Map<string, { title: string; lineNumber: number }>();
  const graph = new Map<string, string[]>();

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      nodeMeta.set(node.fullId, { title: node.title, lineNumber: node.lineNumber });
      graph.set(node.fullId, []);
    }
  }

  for (const edge of adjacency.edges) {
    if (!edge.targetFullId || !adjacency.nodeFullIds.has(edge.targetFullId)) continue;
    graph.get(edge.sourceFullId)?.push(edge.targetFullId);
  }

  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let index = 0;

  const strongConnect = (nodeId: string): void => {
    indexByNode.set(nodeId, index);
    lowLinkByNode.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of graph.get(nodeId) ?? []) {
      if (!indexByNode.has(targetId)) {
        strongConnect(targetId);
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, lowLinkByNode.get(targetId) ?? 0),
        );
      } else if (onStack.has(targetId)) {
        lowLinkByNode.set(
          nodeId,
          Math.min(lowLinkByNode.get(nodeId) ?? 0, indexByNode.get(targetId) ?? 0),
        );
      }
    }

    if (lowLinkByNode.get(nodeId) !== indexByNode.get(nodeId)) return;

    const component: string[] = [];
    let next: string | undefined;
    do {
      next = stack.pop();
      if (!next) break;
      onStack.delete(next);
      component.push(next);
    } while (next !== nodeId);
    components.push(component);
  };

  for (const nodeId of graph.keys()) {
    if (!indexByNode.has(nodeId)) strongConnect(nodeId);
  }

  for (const component of components) {
    const componentSet = new Set(component);
    const isCycle = component.length > 1
      || (component.length === 1 && (graph.get(component[0]!) ?? []).includes(component[0]!));
    if (!isCycle) continue;

    const hasExit = component.some((nodeId) =>
      (adjacency.outgoingBySourceFullId.get(nodeId) ?? []).some((edge) =>
        edge.targetFullId !== null && !componentSet.has(edge.targetFullId),
      ),
    );
    if (hasExit) continue;

    const firstNodeId = component
      .slice()
      .sort((a, b) => (nodeMeta.get(a)?.lineNumber ?? 0) - (nodeMeta.get(b)?.lineNumber ?? 0))[0]!;
    const firstNode = nodeMeta.get(firstNodeId);
    diagnostics.push(
      createDiagnostic(
        'W007',
        rangeAtLine(firstNode?.lineNumber ?? 1),
        `Closed cycle detected: ${component.map((id) => nodeMeta.get(id)?.title ?? id).join(' -> ')}`,
        firstNodeId,
      ),
    );
  }

  return diagnostics;
}
