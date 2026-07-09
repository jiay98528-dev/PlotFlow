import type {
  ConditionNode,
  NodeNextTarget,
  Option,
  SideEffect,
  StoryNode,
  VariableValue,
} from '@plotflow/core';

export type NodeRouteText = (
  key: string,
  params?: Readonly<Record<string, string | number>>,
) => string;

export type NodeRouteKind = 'option' | 'next' | 'terminal';
export type NodeRouteTargetState = 'linked' | 'pending' | 'missing' | 'terminal';

export interface NodeRouteSummary {
  readonly id: string;
  readonly kind: NodeRouteKind;
  readonly optionIndex: number | null;
  readonly sourceHandleId: string | null;
  readonly label: string;
  readonly requirementLabel: string;
  readonly requirementTitle: string;
  readonly targetLabel: string;
  readonly targetTitle: string;
  readonly targetState: NodeRouteTargetState;
  readonly effectsLabel: string | null;
  readonly effectsTitle: string | null;
  readonly ariaLabel: string;
  readonly isConditional: boolean;
  readonly hasEffects: boolean;
}

interface TargetSummary {
  readonly label: string;
  readonly title: string;
  readonly state: NodeRouteTargetState;
}

interface RequirementSummary {
  readonly label: string;
  readonly title: string;
  readonly isConditional: boolean;
}

interface RawComparison {
  readonly left: string;
  readonly operator: string;
  readonly right: string;
}

interface EffectsSummary {
  readonly label: string | null;
  readonly title: string | null;
  readonly hasEffects: boolean;
}

function formatValue(value: VariableValue | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return '{...}';
}

function formatConditionOperand(
  operand: Extract<ConditionNode, { type: 'comparison' }>['left'],
): string {
  if (operand.operandType === 'variable') return operand.variableName ?? '';
  return formatValue(operand.literalValue);
}

function parseRawComparison(raw: string): RawComparison | null {
  const match = /^\$?([\p{L}_][\p{L}\p{N}_.]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/u.exec(raw.trim());
  if (!match) return null;
  return {
    left: match[1] ?? '',
    operator: match[2] ?? '',
    right: match[3]?.trim() ?? '',
  };
}

function collectRawVariables(raw: string): string[] {
  const ignored = new Set(['AND', 'OR', 'NOT', 'true', 'false']);
  const variables = new Set<string>();
  for (const match of raw.matchAll(/\$?([\p{L}_][\p{L}\p{N}_.]*)/gu)) {
    const name = match[1] ?? '';
    if (!name || ignored.has(name)) continue;
    variables.add(name);
  }
  return [...variables];
}

function formatComplexConditionLabel(
  variables: readonly string[],
  text: NodeRouteText,
): string {
  const visibleNames = variables.slice(0, 2).join(', ');
  const overflow = variables.length > 2 ? ` +${variables.length - 2}` : '';
  return visibleNames
    ? `${text('themeNode.complexCondition')} · ${visibleNames}${overflow}`
    : text('themeNode.complexCondition');
}

function collectConditionVariables(condition: ConditionNode | null | undefined, variables: Set<string>): void {
  if (!condition) return;
  if (condition.type === 'comparison') {
    if (condition.left.operandType === 'variable' && condition.left.variableName) {
      variables.add(condition.left.variableName);
    }
    if (condition.right.operandType === 'variable' && condition.right.variableName) {
      variables.add(condition.right.variableName);
    }
    return;
  }

  for (const operand of condition.operands) {
    collectConditionVariables(operand, variables);
  }
}

function summarizeRequirement(
  condition: ConditionNode | null | undefined,
  raw: string | null | undefined,
  text: NodeRouteText,
): RequirementSummary {
  const rawText = raw?.trim() ?? '';
  if (!condition && !rawText) {
    const label = text('themeNode.noCondition');
    return { label, title: label, isConditional: false };
  }

  const rawComparison = rawText ? parseRawComparison(rawText) : null;
  if (rawComparison) {
    const expression = [rawComparison.left, rawComparison.operator, rawComparison.right].join(' ');
    return {
      label: text('themeNode.requires', { expression }),
      title: rawText,
      isConditional: true,
    };
  }

  if (condition?.type === 'comparison') {
    const left = formatConditionOperand(condition.left);
    const right = formatConditionOperand(condition.right);
    const expression = [left, condition.operator, right].filter(Boolean).join(' ');
    const label = text('themeNode.requires', { expression });
    return {
      label,
      title: rawText || expression,
      isConditional: true,
    };
  }

  if (condition?.type === 'logical') {
    const variables = new Set<string>();
    collectConditionVariables(condition, variables);
    const label = formatComplexConditionLabel([...variables], text);
    return {
      label,
      title: rawText || label,
      isConditional: true,
    };
  }

  const rawVariables = rawText ? collectRawVariables(rawText) : [];
  const label = formatComplexConditionLabel(rawVariables, text);
  return {
    label,
    title: rawText || label,
    isConditional: true,
  };
}

function formatEffect(effect: SideEffect): string {
  const value = formatValue(effect.value);
  if (effect.operation === 'add') return `${effect.variableName} +${value}`;
  if (effect.operation === 'subtract') return `${effect.variableName} -${value}`;
  if (effect.operation === 'append') return `${effect.variableName}←${value}`;
  return `${effect.variableName} = ${value}`;
}

function summarizeEffects(
  effects: readonly SideEffect[],
  raw: string | null | undefined,
  text: NodeRouteText,
): EffectsSummary {
  const rawText = raw?.trim() ?? '';
  if (effects.length === 0 && !rawText) {
    return { label: null, title: null, hasEffects: false };
  }

  if (effects.length > 0) {
    const visible = effects.slice(0, 2).map(formatEffect);
    const overflow = effects.length > 2 ? ` ${text('themeNode.moreEffects', { count: effects.length - 2 })}` : '';
    const effectsText = `${visible.join(', ')}${overflow}`;
    return {
      label: text('themeNode.effectPreview', { effects: effectsText }),
      title: effects.map(formatEffect).join(', '),
      hasEffects: true,
    };
  }

  return {
    label: text('themeNode.effectPreview', { effects: rawText }),
    title: rawText,
    hasEffects: true,
  };
}

function resolveTarget(
  targetFullId: string | null | undefined,
  targetNodeId: string | null | undefined,
  nodeByFullId: ReadonlyMap<string, StoryNode>,
  text: NodeRouteText,
): TargetSummary {
  if (!targetFullId && !targetNodeId) {
    const label = text('themeNode.targetPreview', { target: text('themeNode.pendingTarget') });
    return { label, title: text('themeNode.pendingTarget'), state: 'pending' };
  }

  if (targetFullId) {
    const targetNode = nodeByFullId.get(targetFullId);
    if (targetNode) {
      return {
        label: text('themeNode.targetPreview', { target: targetNode.title }),
        title: targetNode.fullId,
        state: 'linked',
      };
    }
  }

  const missingTarget = targetFullId ?? targetNodeId ?? '';
  return {
    label: text('themeNode.targetPreview', { target: text('themeNode.missingTarget') }),
    title: missingTarget || text('themeNode.missingTarget'),
    state: 'missing',
  };
}

function buildAriaLabel(
  label: string,
  requirement: RequirementSummary,
  target: TargetSummary,
  effects: EffectsSummary,
  text: NodeRouteText,
): string {
  return text('themeNode.routeAria', {
    label,
    requirement: requirement.label,
    target: target.title,
    effects: effects.label ?? text('themeNode.noEffects'),
  });
}

function summarizeOption(
  option: Option,
  index: number,
  nodeByFullId: ReadonlyMap<string, StoryNode>,
  text: NodeRouteText,
): NodeRouteSummary {
  const label = option.description.trim() || text('themeNode.routeLabel', { index: index + 1 });
  const requirement = summarizeRequirement(option.condition, option.conditionRaw, text);
  const target = resolveTarget(option.targetFullId, option.targetNodeId, nodeByFullId, text);
  const effects = summarizeEffects(option.sideEffects, option.effectsRaw, text);

  return {
    id: `option-${index}`,
    kind: 'option',
    optionIndex: index,
    sourceHandleId: `option-${index}`,
    label,
    requirementLabel: requirement.label,
    requirementTitle: requirement.title,
    targetLabel: target.label,
    targetTitle: target.title,
    targetState: target.state,
    effectsLabel: effects.label,
    effectsTitle: effects.title,
    ariaLabel: buildAriaLabel(label, requirement, target, effects, text),
    isConditional: requirement.isConditional,
    hasEffects: effects.hasEffects,
  };
}

function summarizeNextTarget(
  nextTarget: NodeNextTarget | null | undefined,
  nodeByFullId: ReadonlyMap<string, StoryNode>,
  text: NodeRouteText,
): NodeRouteSummary {
  const label = text('themeNode.nextRoute');
  const requirement = summarizeRequirement(null, null, text);
  const hasTarget = Boolean(nextTarget?.targetFullId || nextTarget?.targetNodeId);
  const target = hasTarget
    ? resolveTarget(nextTarget?.targetFullId, nextTarget?.targetNodeId, nodeByFullId, text)
    : {
        label: text('themeNode.terminalNode'),
        title: text('themeNode.terminalNode'),
        state: 'terminal' as const,
      };
  const effects = summarizeEffects(nextTarget?.sideEffects ?? [], nextTarget?.effectsRaw, text);

  return {
    id: 'next',
    kind: hasTarget ? 'next' : 'terminal',
    optionIndex: null,
    sourceHandleId: 'next',
    label,
    requirementLabel: requirement.label,
    requirementTitle: requirement.title,
    targetLabel: target.label,
    targetTitle: target.title,
    targetState: target.state,
    effectsLabel: effects.label,
    effectsTitle: effects.title,
    ariaLabel: buildAriaLabel(label, requirement, target, effects, text),
    isConditional: false,
    hasEffects: effects.hasEffects,
  };
}

export function buildNodeRouteSummaries(
  storyNode: StoryNode | null | undefined,
  allNodes: readonly StoryNode[],
  text: NodeRouteText,
): NodeRouteSummary[] {
  if (!storyNode) return [];

  const nodeByFullId = new Map(allNodes.map((node) => [node.fullId, node]));
  if (storyNode.options.length > 0) {
    return storyNode.options.map((option, index) => summarizeOption(option, index, nodeByFullId, text));
  }

  return [summarizeNextTarget(storyNode.nextTarget, nodeByFullId, text)];
}
