/**
 * PlotFlow 验证器 — E001~E009 错误检测规则
 *
 * @packageDocumentation
 * @remarks
 * 本模块在解析器完成 .mdstory → PlotFlowData AST 转换后执行二次验证。
 * 每个 checkXxx 函数检查 PlotFlowData 中的一个维度，返回诊断列表。
 *
 * 与解析器中的检查不同：解析器在构建 AST 的同时做验证（产生 ParseResult 中的
 * diagnostics/errors），而本模块接收已完成的 AST，做结构化完整性和一致性检查。
 *
 * 对应规范：
 * - spec/syntax-formal.md 各节的错误规则
 * - doc/TAD.md 6 类型系统 (Validator 层)
 *
 * @version 0.1.0
 */

import type { PlotFlowData, VariableDeclaration, ConditionNode, VariableType } from '../types/ast.js';
import type { Diagnostic } from '../types/diagnostic.js';
import { createDiagnostic, rangeAtLine } from './helpers.js';
import { buildStoryAdjacency } from './adjacency.js';
import { ANONYMOUS_CHAPTER_ID, createFullId } from '../fullId.js';

interface DeclaredVariableInfo {
  readonly type: VariableType;
  readonly lineNumber: number;
  readonly enumValues?: string[];
  readonly scope: 'global' | 'chapter';
  readonly chapterId?: string;
}

// ============================================================================
// 局部工具：收集所有已声明的变量名（含嵌套字段的 dotted path）
// ============================================================================

/**
 * 递归收集所有变量声明，将嵌套 object 字段展开为 flat map。
 * 字段路径以点号分隔，如 "角色.体力"、"角色.状态.中毒"。
 */
function collectDeclaredVariables(
  variables: VariableDeclaration[],
  parentPath: string,
  map: Map<string, DeclaredVariableInfo>,
  inheritedScope: 'global' | 'chapter' = 'global',
  inheritedChapterId?: string,
): void {
  for (const v of variables) {
    const fullName = parentPath ? `${parentPath}.${v.name}` : v.name;
    const scope = parentPath ? inheritedScope : (v.scope ?? 'global');
    const chapterId = parentPath ? inheritedChapterId : v.chapterId;
    map.set(fullName, {
      type: v.type,
      lineNumber: v.lineNumber,
      enumValues: v.enumValues,
      scope,
      chapterId,
    });
    if (v.type === 'object' && v.fields) {
      collectDeclaredVariables(v.fields, fullName, map, scope, chapterId);
    }
  }
}

/**
 * 构建声明的变量全路径名集合。
 */
function buildDeclaredVarMap(data: PlotFlowData): Map<string, DeclaredVariableInfo> {
  const map = new Map<string, DeclaredVariableInfo>();
  collectDeclaredVariables(data.variables, '', map);
  return map;
}

// ============================================================================
// 局部工具：从条件树中提取所有引用的变量名
// ============================================================================

function collectConditionVarNames(condition: ConditionNode, collected: Set<string>): void {
  if (condition.type === 'comparison') {
    if (condition.left.operandType === 'variable' && condition.left.variableName) {
      collected.add(condition.left.variableName);
    }
    if (condition.right.operandType === 'variable' && condition.right.variableName) {
      collected.add(condition.right.variableName);
    }
  } else if (condition.type === 'logical') {
    for (const op of condition.operands) {
      collectConditionVarNames(op, collected);
    }
  }
}

// ============================================================================
// E001 — 未定义目标节点
// ============================================================================

/**
 * E001: 检测选项引用的跳转目标节点是否在故事中存在。
 *
 * 遍历所有选项的 targetNodeId（或 targetFullId），检查是否有对应的节点定义。
 * 如果 targetNodeId 非 null 且没有任何节点的 ID 或 fullId 与之匹配，则报错。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkUndefinedTargetNode(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 收集完整 ID，以及短 ID 到完整 ID 的映射。短 ID 不能直接视为全局有效：
  // 不同章节允许存在同名节点，未解析的短 ID 可能是歧义引用。
  const allNodeFullIds = new Set<string>();
  const nodeIdToFullIds = new Map<string, string[]>();
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      allNodeFullIds.add(node.fullId);
      const matches = nodeIdToFullIds.get(node.id) ?? [];
      matches.push(node.fullId);
      nodeIdToFullIds.set(node.id, matches);
    }
  }

  // 遍历所有选项
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (option.targetNodeId === null) continue;

        // 如果 targetFullId 已填充，优先用它检查
        if (option.targetFullId !== null) {
          if (!allNodeFullIds.has(option.targetFullId)) {
            diagnostics.push(
              createDiagnostic(
                'E001',
                rangeAtLine(option.lineNumber),
                `选项 "${option.description}" 的目标节点 "${option.targetFullId}" 在故事中不存在`,
                node.fullId,
              ),
            );
          }
          continue;
        }

        const explicitTargetFullId = option.targetChapterId
          ? createFullId(option.targetChapterId, option.targetNodeId)
          : null;
        const sameChapterTargetFullId = createFullId(node.chapterId, option.targetNodeId);
        const globalMatches = nodeIdToFullIds.get(option.targetNodeId) ?? [];
        const isResolvable = explicitTargetFullId
          ? allNodeFullIds.has(explicitTargetFullId)
          : allNodeFullIds.has(sameChapterTargetFullId) || globalMatches.length === 1;

        if (!isResolvable) {
          const targetLabel = explicitTargetFullId ?? option.targetNodeId;
          const reason = !explicitTargetFullId && globalMatches.length > 1
            ? `（存在 ${globalMatches.length} 个同名节点，请显式指定章节）`
            : '';
          diagnostics.push(
            createDiagnostic(
              'E001',
              rangeAtLine(option.lineNumber),
              `选项 "${option.description}" 的目标节点 "${targetLabel}" 无法解析${reason}`,
              node.fullId,
            ),
          );
        }
      }

      const nextTarget = node.nextTarget;
      if (nextTarget?.targetNodeId) {
        const expectedTargetId = createFullId(
          nextTarget.targetChapterId ?? node.chapterId,
          nextTarget.targetNodeId,
        );
        if (nextTarget.targetFullId !== null) {
          if (!allNodeFullIds.has(nextTarget.targetFullId)) {
            diagnostics.push(
              createDiagnostic(
                'E001',
                rangeAtLine(nextTarget.lineNumber),
                `Next target "${nextTarget.targetFullId}" does not exist in story`,
                node.fullId,
              ),
            );
          }
        } else if (!allNodeFullIds.has(expectedTargetId)) {
          diagnostics.push(
            createDiagnostic(
              'E001',
              rangeAtLine(nextTarget.lineNumber),
              `Next target "${nextTarget.raw}" does not exist in story`,
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
// E002 — 未声明变量
// ============================================================================

/**
 * E002: 检测条件和效果中引用的变量是否在 Frontmatter 中声明。
 *
 * 遍历所有条件的 Variable 类型 operand 和所有效果的 variableName，
 * 与 Frontmatter 中声明的变量名（含嵌套字段路径）比对。
 * 引用了未声明的变量即报错。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkUndeclaredVariable(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const declaredVars = buildDeclaredVarMap(data);
  const referencedVars = new Set<string>();

  // 收集所有被引用的变量名
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (option.condition) {
          collectConditionVarNames(option.condition, referencedVars);
        }
        for (const effect of option.sideEffects) {
          referencedVars.add(effect.variableName);
        }
      }
      for (const effect of node.nextTarget?.sideEffects ?? []) {
        referencedVars.add(effect.variableName);
      }
    }
  }

  // 检查每个引用是否在声明中
  for (const varName of referencedVars) {
    if (!declaredVars.has(varName)) {
      // 尝试查找引用出现的行号
      let refLine = 0;
      outer:
      for (const chapter of data.chapters) {
        for (const node of chapter.nodes) {
          for (const option of node.options) {
            if (option.condition) {
              const found = findVariableLineInCondition(option.condition, varName);
              if (found !== null) {
                refLine = found;
                break outer;
              }
            }
            for (const effect of option.sideEffects) {
              if (effect.variableName === varName) {
                refLine = effect.lineNumber;
                break outer;
              }
            }
          }
          for (const effect of node.nextTarget?.sideEffects ?? []) {
            if (effect.variableName === varName) {
              refLine = effect.lineNumber;
              break outer;
            }
          }
        }
      }

      diagnostics.push(
        createDiagnostic(
          'E002',
          rangeAtLine(refLine || 1),
          `变量 "${varName}" 未在 Frontmatter 中声明`,
          undefined,
        ),
      );
    }
  }

  // Chapter-scoped variables remain alive for the play session, but are only
  // visible from nodes in their declared chapter. Report inaccessible uses as
  // E002 so the existing export error gate blocks invalid runtime semantics.
  const checkAccess = (
    varName: string,
    chapterId: string,
    lineNumber: number,
    relatedNodeId: string,
  ): void => {
    const declaration = declaredVars.get(varName);
    if (
      !declaration
      || declaration.scope !== 'chapter'
      || declaration.chapterId === chapterId
    ) return;
    diagnostics.push(createDiagnostic(
      'E002',
      rangeAtLine(lineNumber),
      `章节变量 "${varName}" 仅可在章节 "${declaration.chapterId ?? ''}" 中访问`,
      relatedNodeId,
    ));
  };

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (option.condition) {
          const names = new Set<string>();
          collectConditionVarNames(option.condition, names);
          names.forEach((name) => checkAccess(name, node.chapterId, option.lineNumber, node.fullId));
        }
        for (const effect of option.sideEffects) {
          checkAccess(effect.variableName, node.chapterId, effect.lineNumber, node.fullId);
        }
      }
      for (const effect of node.nextTarget?.sideEffects ?? []) {
        checkAccess(effect.variableName, node.chapterId, effect.lineNumber, node.fullId);
      }
    }
  }

  return diagnostics;
}

/**
 * 在条件树中查找指定变量名首次出现的行号。
 */
function findVariableLineInCondition(condition: ConditionNode, targetName: string): number | null {
  if (condition.type === 'comparison') {
    if (condition.left.operandType === 'variable' && condition.left.variableName === targetName) return 1;
    if (condition.right.operandType === 'variable' && condition.right.variableName === targetName) return 1;
  } else if (condition.type === 'logical') {
    for (const op of condition.operands) {
      const found = findVariableLineInCondition(op, targetName);
      if (found !== null) return found;
    }
  }
  return null;
}

// ============================================================================
// E003 — 枚举值非法
// ============================================================================

/**
 * E003: 检测枚举变量的取值是否在其合法枚举值列表内。
 *
 * 检查场景：
 * 1. 条件中枚举变量与字面量的 ==/!= 比较，字面量是否在 enumValues 中
 * 2. 效果中 set 枚举变量时，值是否在 enumValues 中
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkInvalidEnumValue(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const declaredVars = buildDeclaredVarMap(data);

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        // 检查条件中的枚举值
        if (option.condition) {
          checkConditionEnumValues(option.condition, declaredVars, diagnostics);
        }

        // 检查效果中的枚举值
        for (const effect of option.sideEffects) {
          const varInfo = declaredVars.get(effect.variableName);
          if (varInfo && varInfo.type === 'enum' && varInfo.enumValues) {
            if (typeof effect.value === 'string' && !varInfo.enumValues.includes(effect.value)) {
              diagnostics.push(
                createDiagnostic(
                  'E003',
                  rangeAtLine(effect.lineNumber),
                  `枚举变量 "${effect.variableName}" 的值 "${effect.value}" 不在合法值列表 [${varInfo.enumValues.join(', ')}] 中`,
                  node.fullId,
                ),
              );
            }
          }
        }
      }

      for (const effect of node.nextTarget?.sideEffects ?? []) {
        const varInfo = declaredVars.get(effect.variableName);
        if (varInfo && varInfo.type === 'enum' && varInfo.enumValues) {
          if (typeof effect.value === 'string' && !varInfo.enumValues.includes(effect.value)) {
            diagnostics.push(
              createDiagnostic(
                'E003',
                rangeAtLine(effect.lineNumber),
                `Enum variable "${effect.variableName}" value "${effect.value}" is not allowed`,
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

/**
 * 递归检查条件树中枚举比较的字面量是否合法。
 */
function checkConditionEnumValues(
  condition: ConditionNode,
  declaredVars: Map<string, DeclaredVariableInfo>,
  diagnostics: Diagnostic[],
): void {
  if (condition.type === 'comparison') {
    // 仅检查 == 和 != 比较（枚举的有意义比较）
    if (condition.operator !== '==' && condition.operator !== '!=') return;

    // 左操作数为枚举变量，右操作数为字面量
    if (
      condition.left.operandType === 'variable' &&
      condition.right.operandType === 'literal' &&
      typeof condition.right.literalValue === 'string' &&
      condition.left.variableName
    ) {
      const varInfo = declaredVars.get(condition.left.variableName);
      if (varInfo && varInfo.type === 'enum' && varInfo.enumValues) {
        if (!varInfo.enumValues.includes(condition.right.literalValue as string)) {
          diagnostics.push(
            createDiagnostic(
              'E003',
              rangeAtLine(1), // 条件无具体行号，用默认值
              `枚举变量 "${condition.left.variableName}" 比较值 "${condition.right.literalValue}" 不在合法值列表 [${varInfo.enumValues.join(', ')}] 中`,
              undefined,
            ),
          );
        }
      }
    }

    // 右操作数为枚举变量，左操作数为字面量
    if (
      condition.right.operandType === 'variable' &&
      condition.left.operandType === 'literal' &&
      typeof condition.left.literalValue === 'string' &&
      condition.right.variableName
    ) {
      const varInfo = declaredVars.get(condition.right.variableName);
      if (varInfo && varInfo.type === 'enum' && varInfo.enumValues) {
        if (!varInfo.enumValues.includes(condition.left.literalValue as string)) {
          diagnostics.push(
            createDiagnostic(
              'E003',
              rangeAtLine(1),
              `枚举变量 "${condition.right.variableName}" 比较值 "${condition.left.literalValue}" 不在合法值列表 [${varInfo.enumValues.join(', ')}] 中`,
              undefined,
            ),
          );
        }
      }
    }
  } else if (condition.type === 'logical') {
    for (const op of condition.operands) {
      checkConditionEnumValues(op, declaredVars, diagnostics);
    }
  }
}

// ============================================================================
// E004 — 类型不匹配
// ============================================================================

/**
 * 检查字面量类型是否与声明的变量类型兼容。
 * 类型兼容规则：
 * - int 与 float 互相兼容
 * - string 与 enum 互相兼容
 * - 其余组合必须严格匹配
 */
function isTypeCompatible(declaredType: VariableType, literalValue: unknown): boolean {
  const literalType = typeof literalValue;

  if (declaredType === 'int' || declaredType === 'float') {
    return literalType === 'number';
  }
  if (declaredType === 'bool') {
    return literalType === 'boolean';
  }
  if (declaredType === 'string' || declaredType === 'enum') {
    return literalType === 'string';
  }
  if (declaredType === 'object') {
    return literalType === 'object' && literalValue !== null;
  }
  return false;
}

/**
 * E004: 检测条件和效果中的类型不匹配。
 *
 * 检查场景：
 * 1. 条件中变量与字面量比较时，字面量类型是否与变量声明类型兼容
 * 2. 效果中 set/add/subtract 的值类型是否与变量声明类型兼容
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkTypeMismatch(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const declaredVars = buildDeclaredVarMap(data);

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        // 检查条件中的类型匹配
        if (option.condition) {
          checkConditionTypeMatch(option.condition, declaredVars, diagnostics);
        }

        // 检查效果中的类型匹配
        for (const effect of option.sideEffects) {
          const varInfo = declaredVars.get(effect.variableName);
          if (!varInfo) continue;

          if (!isTypeCompatible(varInfo.type, effect.value)) {
            diagnostics.push(
              createDiagnostic(
                'E004',
                rangeAtLine(effect.lineNumber),
                `变量 "${effect.variableName}" 的类型为 ${varInfo.type}，但效果值类型为 ${typeof effect.value}，不匹配`,
                node.fullId,
              ),
            );
          }
        }
      }

      for (const effect of node.nextTarget?.sideEffects ?? []) {
        const varInfo = declaredVars.get(effect.variableName);
        if (!varInfo) continue;

        if (!isTypeCompatible(varInfo.type, effect.value)) {
          diagnostics.push(
            createDiagnostic(
              'E004',
              rangeAtLine(effect.lineNumber),
              `Variable "${effect.variableName}" type is ${varInfo.type}, but effect value type is ${typeof effect.value}`,
              node.fullId,
            ),
          );
        }
      }
    }
  }

  return diagnostics;
}

/**
 * 递归检查条件树中每个比较操作数的类型匹配。
 */
function checkConditionTypeMatch(
  condition: ConditionNode,
  declaredVars: Map<string, DeclaredVariableInfo>,
  diagnostics: Diagnostic[],
): void {
  if (condition.type === 'comparison') {
    // 变量 vs 字面量：检查字面量是否与变量类型兼容
    if (condition.left.operandType === 'variable' && condition.right.operandType === 'literal') {
      const varInfo = condition.left.variableName ? declaredVars.get(condition.left.variableName) : undefined;
      if (varInfo && !isTypeCompatible(varInfo.type, condition.right.literalValue)) {
        diagnostics.push(
          createDiagnostic(
            'E004',
            rangeAtLine(1),
            `变量 "${condition.left.variableName}" 类型为 ${varInfo.type}，无法与 ${typeof condition.right.literalValue} 类型的字面量比较`,
            undefined,
          ),
        );
      }
    }

    // 字面量 vs 变量
    if (condition.right.operandType === 'variable' && condition.left.operandType === 'literal') {
      const varInfo = condition.right.variableName ? declaredVars.get(condition.right.variableName) : undefined;
      if (varInfo && !isTypeCompatible(varInfo.type, condition.left.literalValue)) {
        diagnostics.push(
          createDiagnostic(
            'E004',
            rangeAtLine(1),
            `变量 "${condition.right.variableName}" 类型为 ${varInfo.type}，无法与 ${typeof condition.left.literalValue} 类型的字面量比较`,
            undefined,
          ),
        );
      }
    }

    // 变量 vs 变量：检查两者类型是否兼容
    if (condition.left.operandType === 'variable' && condition.right.operandType === 'variable') {
      const leftInfo = condition.left.variableName ? declaredVars.get(condition.left.variableName) : undefined;
      const rightInfo = condition.right.variableName ? declaredVars.get(condition.right.variableName) : undefined;
      if (leftInfo && rightInfo && leftInfo.type !== rightInfo.type) {
        // int/float 互兼容
        const intFloatLeft = leftInfo.type === 'int' || leftInfo.type === 'float';
        const intFloatRight = rightInfo.type === 'int' || rightInfo.type === 'float';
        const strEnumLeft = leftInfo.type === 'string' || leftInfo.type === 'enum';
        const strEnumRight = rightInfo.type === 'string' || rightInfo.type === 'enum';

        if (!(intFloatLeft && intFloatRight) && !(strEnumLeft && strEnumRight)) {
          diagnostics.push(
            createDiagnostic(
              'E004',
              rangeAtLine(1),
              `变量 "${condition.left.variableName}"（${leftInfo.type}）与 "${condition.right.variableName}"（${rightInfo.type}）类型不兼容`,
              undefined,
            ),
          );
        }
      }
    }
  } else if (condition.type === 'logical') {
    for (const op of condition.operands) {
      checkConditionTypeMatch(op, declaredVars, diagnostics);
    }
  }
}

// ============================================================================
// E005 — 语法解析失败
// ============================================================================

/**
 * E005: 检查 AST 中是否存在解析阶段遗留的语法错误。
 *
 * 检测条件：
 * 1. 选项的 targetNodeId 为 null 且 condition 为 null（完全无目标）
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkE005(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    if (!chapter.isAnonymous && (
      chapter.id === ANONYMOUS_CHAPTER_ID
      || chapter.title === ANONYMOUS_CHAPTER_ID
      || chapter.id.startsWith(`\u0000reserved:${ANONYMOUS_CHAPTER_ID}:`)
    )) {
      diagnostics.push(
        createDiagnostic(
          'E005',
          rangeAtLine(Math.max(1, chapter.lineNumber)),
          `章节名 "${ANONYMOUS_CHAPTER_ID}" 是系统保留名称，请重命名该章节。`,
        ),
      );
    }
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        // targetNodeId === null && condition === null 无跳转目标且无执行条件
        if (option.targetNodeId === null && option.condition === null) {
          diagnostics.push(
            createDiagnostic(
              'E005',
              rangeAtLine(option.lineNumber),
              `选项 "${option.description}" 缺少跳转目标且无执行条件`,
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
// E006 — 嵌套深度超限
// ============================================================================

/**
 * 递归计算 object 类型变量的字段最大嵌套深度。
 *
 * @param fields - 字段声明列表
 * @param currentDepth - 当前深度（顶级 fields 从 1 开始计数）
 * @returns 最大嵌套深度
 */
function getMaxFieldDepth(fields: VariableDeclaration[], currentDepth: number): number {
  let maxDepth = currentDepth;
  for (const field of fields) {
    if (field.type === 'object' && field.fields && field.fields.length > 0) {
      const childDepth = getMaxFieldDepth(field.fields, currentDepth + 1);
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
  }
  return maxDepth;
}

/**
 * E006: 检查 Frontmatter 中 object 类型变量的嵌套层数是否超过 3 层。
 *
 * 嵌套层级计数规则：
 * - 变量的直接 fields 为第 1 层
 * - fields 中 object 字段的 fields 为第 2 层
 * - 以此类推，最大允许 3 层
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkE006(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const variable of data.variables) {
    if (variable.type === 'object' && variable.fields && variable.fields.length > 0) {
      const maxDepth = getMaxFieldDepth(variable.fields, 1);
      if (maxDepth > 3) {
        diagnostics.push(
          createDiagnostic(
            'E006',
            rangeAtLine(variable.lineNumber),
            `变量 "${variable.name}" 的嵌套深度为 ${maxDepth} 层，超过最大限制 3 层。`
            + ' 请将深层嵌套的字段拆分为独立的顶层变量，或展平对象结构。',
            undefined,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// E007 — 节点 ID 重名
// ============================================================================

/**
 * E007: 检查所有节点的 fullId 是否有重复。
 *
 * fullId 由编码后的 "章节ID/节点ID" 组成（匿名章节直接用编码后的节点 ID）。
 * 同一 fullId 多次出现表示节点定义重复。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkE007(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  /** fullId 首次出现的行号 */
  const seenFullIds = new Map<string, number>();

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      const existingLine = seenFullIds.get(node.fullId);
      if (existingLine !== undefined) {
        diagnostics.push(
          createDiagnostic(
            'E007',
            rangeAtLine(node.lineNumber),
            `节点 ID "${node.fullId}" 重复（首次声明在第 ${existingLine} 行）`,
            undefined,
          ),
        );
      } else {
        seenFullIds.set(node.fullId, node.lineNumber);
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// E008 — 变量重复声明
// ============================================================================

/**
 * 递归检查变量名是否重复（包括嵌套 object 字段）。
 *
 * @param variables - 变量声明列表
 * @param seenNames - 已遇到的变量名 行号映射（跨层级共享）
 * @param parentPath - 父级路径（用于诊断信息中的定位显示）
 * @param diagnostics - 累积的诊断列表
 */
function checkVariableNamesRecursive(
  variables: VariableDeclaration[],
  seenNames: Map<string, number>,
  parentPath: string,
  diagnostics: Diagnostic[],
): void {
  for (const variable of variables) {
    const fullPath = parentPath ? `${parentPath}.${variable.name}` : variable.name;

    const existingLine = seenNames.get(variable.name);
    if (existingLine !== undefined) {
      diagnostics.push(
        createDiagnostic(
          'E008',
          rangeAtLine(variable.lineNumber),
          `变量 "${fullPath}" 重复声明（首次声明在第 ${existingLine} 行）`,
          undefined,
        ),
      );
    } else {
      seenNames.set(variable.name, variable.lineNumber);
    }

    if (variable.type === 'object' && variable.fields && variable.fields.length > 0) {
      checkVariableNamesRecursive(variable.fields, seenNames, fullPath, diagnostics);
    }
  }
}

/**
 * E008: 检查 Frontmatter 中是否有同名变量声明。
 *
 * 检测范围包括：
 * - 顶层变量之间的同名
 * - 顶层变量与嵌套 object 字段之间的同名
 * - 嵌套 object 字段之间的同名
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkE008(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  /** 变量名 首次出现的行号（跨层级共享） */
  const seenNames = new Map<string, number>();

  checkVariableNamesRecursive(data.variables, seenNames, '', diagnostics);

  return diagnostics;
}

// ============================================================================
// E009 — 故事结构不可导出
// ============================================================================

/**
 * E009: 确保故事至少包含一个章节，并且每个章节至少包含一个节点。
 * 该约束与 JSON Schema 0.2 的 chapters/nodes minItems 合同一致，也作为
 * HTML/TXT 等其他导出格式共用的结构门禁。
 */
export function checkE009(data: PlotFlowData): Diagnostic[] {
  if (data.chapters.length === 0) {
    return [{
      ...createDiagnostic(
        'E009',
        rangeAtLine(1),
        '故事至少需要一个包含节点的章节，当前故事没有章节。',
      ),
      detailKey: 'diagnostic.E009.detail',
      detailParams: { reason: 'noChapters' },
    }];
  }

  const diagnostics: Diagnostic[] = [];
  for (const chapter of data.chapters) {
    if (chapter.nodes.length > 0) continue;
    diagnostics.push({
      ...createDiagnostic(
        'E009',
        rangeAtLine(Math.max(1, chapter.lineNumber)),
        `章节 "${chapter.title || chapter.id}" 不包含节点；每个章节至少需要一个节点。`,
      ),
      detailKey: 'diagnostic.E009.detail',
      detailParams: { reason: 'emptyChapter', chapter: chapter.title || chapter.id },
    });
  }
  return diagnostics;
}

// ============================================================================
// 聚合函数
// ============================================================================

/**
 * 运行 E001-E004 全部错误规则（旧验证器接口）。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function validateErrors(data: PlotFlowData): Diagnostic[] {
  return [
    ...checkUndefinedTargetNode(data),
    ...checkUndeclaredVariable(data),
    ...checkInvalidEnumValue(data),
    ...checkTypeMismatch(data),
  ];
}

/**
 * 运行 E005-E009 全部后解析验证规则。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function runValidations(data: PlotFlowData): Diagnostic[] {
  return [
    ...checkE005(data),
    ...checkE006(data),
    ...checkE007(data),
    ...checkE008(data),
    ...checkE009(data),
  ];
}

/**
 * 运行 E001-E009 全部错误检测规则。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkAllErrors(data: PlotFlowData): Diagnostic[] {
  return [
    ...validateErrors(data),
    ...runValidations(data),
  ];
}

// ============================================================================
// 主验证函数 — validate()
// ============================================================================

import type { ValidationResult, DiagnosticSummary } from '../types/diagnostic.js';

// W 和 I 规则从对应模块导入
import {
  checkOrphanNodes,
  checkDeadEndNodes,
  checkUnusedVariables,
  checkDuplicateOptionDescriptions,
  checkEmptyBodyNodes,
  checkFormatIrregularities,
  checkClosedCycles,
} from './warnings.js';

import {
  checkPotentialSoftlock,
  checkShortBody,
  checkMissingChapter,
} from './infos.js';

/**
 * 对 PlotFlowData 运行全部 18 条验证规则，返回完整诊断结果。
 *
 * 规则清单：E001-E009（9 错误）+ W001-W006（6 警告）+ I001-I003（3 建议）= 18 条
 *
 * 副作用：更新 data 中每个 StoryNode 的 diagnostics 字段：
 *   - isOrphan: 非根节点且无入口选项指向
 *   - isDeadEnd: 无出口选项
 *   - diagnosticIds: 关联到此节点的所有诊断 ID
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ValidationResult — 包含所有诊断和汇总统计
 *
 * @remarks
 * - 诊断按 E → W → I 顺序排列
 * - 节点 diagnostics 字段通过 isRoot 标记区分根节点与孤立节点
 * - 此函数不抛异常
 *
 * @example
 * ```typescript
 * const result = validate(ast);
 * if (result.summary.errors > 0) {
 *   console.error('发现错误:', result.diagnostics);
 * }
 * ```
 */
export function validate(data: PlotFlowData): ValidationResult {
  const diagnostics: Diagnostic[] = [
    // 错误 E001-E009（9 条规则）
    ...checkUndefinedTargetNode(data),
    ...checkUndeclaredVariable(data),
    ...checkInvalidEnumValue(data),
    ...checkTypeMismatch(data),
    ...checkE005(data),
    ...checkE006(data),
    ...checkE007(data),
    ...checkE008(data),
    ...checkE009(data),
    // 警告 W001-W006（6 条规则）
    ...checkOrphanNodes(data),
    ...checkDeadEndNodes(data),
    ...checkUnusedVariables(data),
    ...checkDuplicateOptionDescriptions(data),
    ...checkEmptyBodyNodes(data),
    ...checkFormatIrregularities(data),
    ...checkClosedCycles(data),
    // 建议 I001-I003（3 条规则）
    ...checkPotentialSoftlock(data),
    ...checkShortBody(data),
    ...checkMissingChapter(data),
  ];

  // 更新每个 Node 的 diagnostics 字段
  updateNodeDiagnostics(data, diagnostics);

  const summary = computeSummary(diagnostics);

  return { diagnostics, summary };
}

// ============================================================================
// Node Diagnostics 更新
// ============================================================================

/**
 * 根据验证结果更新每个 StoryNode 的 diagnostics 元数据。
 *
 * 更新内容：
 * - isRoot: 标记第一个无入口的节点为根节点
 * - isOrphan: 非根节点且无任何选项指向它
 * - isDeadEnd: 节点没有出口选项
 * - diagnosticIds: 追加关联到此节点的诊断 ID（不去重已有的）
 */
function updateNodeDiagnostics(data: PlotFlowData, allDiagnostics: Diagnostic[]): void {
  // 1. 收集所有选项的目标节点 ID（fullId）
  const adjacency = buildStoryAdjacency(data);
  // 2. 按 relatedNodeId 分组诊断 ID
  const diagByNode = new Map<string, string[]>();
  for (const d of allDiagnostics) {
    if (d.relatedNodeId) {
      const ids = diagByNode.get(d.relatedNodeId);
      if (ids) {
        ids.push(d.id);
      } else {
        diagByNode.set(d.relatedNodeId, [d.id]);
      }
    }
  }

  // 3. 遍历所有节点，更新状态
  let foundRoot = false;
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      const nd = node.diagnostics;
      const hasEntry = adjacency.incomingByTargetFullId.has(node.fullId);

      // isRoot: 第一个没有入口的节点标记为根节点
      if (!foundRoot && !hasEntry) {
        nd.isRoot = true;
        foundRoot = true;
      } else if (hasEntry) {
        nd.isRoot = false;
      }

      // isOrphan: 非根节点且无入口
      nd.isOrphan = !nd.isRoot && !hasEntry;

      // isDeadEnd: 无出口选项
      nd.isDeadEnd = !adjacency.outgoingBySourceFullId.has(node.fullId);

      // 追加关联的诊断 ID（保留解析器已写入的 ID）
      const relatedIds = diagByNode.get(node.fullId);
      if (relatedIds) {
        for (const id of relatedIds) {
          if (!nd.diagnosticIds.includes(id)) {
            nd.diagnosticIds.push(id);
          }
        }
      }
    }
  }
}

// ============================================================================
// 汇总统计
// ============================================================================

/**
 * 计算诊断汇总统计。
 */
function computeSummary(diagnostics: Diagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }

  return { errors, warnings, infos, total: diagnostics.length };
}
