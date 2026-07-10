import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2Off, ListPlus, Plus, Trash2, X } from 'lucide-react';
import type { Option, StoryNode, VariableDeclaration } from '@plotflow/core';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { graphEditService } from '../../services/graphEditService';
import { useAppText } from '../../i18n/appI18n';

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
  readonly multiline?: boolean;
  readonly onCommit: (value: string) => void;
}

function EditableField({ label, value, testId, multiline = false, onCommit }: FieldProps): React.ReactElement {
  const [draft, setDraft] = useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    if (draft !== value) onCommit(draft);
  }, [draft, onCommit, value]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((!multiline && event.key === 'Enter') || (multiline && event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    }
  }, [commit, multiline]);

  return (
    <label className="graph-lab-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          data-testid={testId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={5}
        />
      ) : (
        <input
          data-testid={testId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      )}
    </label>
  );
}

function getSelectedStoryNode(): StoryNode | undefined {
  const selectedNodeId = useGraphStore.getState().selectedNodeId ?? useEditorStore.getState().activeNodeId;
  return selectedNodeId ? useStoryStore.getState().getNodeByFullId(selectedNodeId) : undefined;
}

function formatVariableDefault(variable: VariableDeclaration): string {
  if (variable.type === 'object') return '{...}';
  if (Array.isArray(variable.defaultValue)) return variable.defaultValue.join(', ');
  return String(variable.defaultValue ?? '');
}

function quoteEffectValue(variable: VariableDeclaration | undefined, value: string): string {
  if (!variable) return value.trim();
  if (variable.type === 'string' || variable.type === 'enum') return JSON.stringify(value);
  if (variable.type === 'bool') return value === 'true' ? 'true' : 'false';
  return value.trim() || '0';
}

type ConditionOperator = '==' | '!=' | '>=' | '<=' | '>' | '<';
type EffectOperation = 'set' | 'add' | 'subtract' | 'append';

interface ParsedCondition {
  readonly variableName: string;
  readonly operator: ConditionOperator;
  readonly value: string;
}

interface ParsedEffect {
  readonly variableName: string;
  readonly operation: EffectOperation;
  readonly value: string;
}

const CONDITION_OPERATORS: readonly ConditionOperator[] = ['==', '!=', '>=', '<=', '>', '<'];
const EFFECT_OPERATIONS: readonly EffectOperation[] = ['set', 'add', 'subtract', 'append'];

function effectOperationLabel(operation: EffectOperation, text: ReturnType<typeof useAppText>): string {
  if (operation === 'add') return text('inspector.effectOperationAdd');
  if (operation === 'subtract') return text('inspector.effectOperationSubtract');
  if (operation === 'append') return text('inspector.effectOperationAppend');
  return text('inspector.effectOperationSet');
}

function parseSimpleCondition(raw: string | null | undefined): ParsedCondition | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const match = /^\$?([\p{L}\p{N}_.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/u.exec(value);
  if (!match) return null;
  return {
    variableName: match[1] ?? '',
    operator: match[2] as ConditionOperator,
    value: match[3]?.trim() ?? '',
  };
}

function serializeCondition(variableName: string, operator: string, value: string): string | null {
  const name = variableName.trim().replace(/^\$/, '');
  const rhs = value.trim();
  if (!name || !operator || !rhs) return null;
  return `${name} ${operator} ${rhs}`;
}

function parseSimpleEffects(raw: string | null | undefined): ParsedEffect[] | null {
  const value = raw?.trim() ?? '';
  if (!value) return [];
  const parsed = value.split(/[,，]/u).map((part): ParsedEffect | null => {
    const match = /^([\p{L}\p{N}_.]+)\s*(=|\+|-|←)\s*(.+)$/u.exec(part.trim());
    if (!match) return null;
    const symbol = match[2] ?? '=';
    return {
      variableName: match[1] ?? '',
      operation: symbol === '+' ? 'add' : symbol === '-' ? 'subtract' : symbol === '←' ? 'append' : 'set',
      value: match[3]?.trim() ?? '',
    };
  });
  if (parsed.some((effect) => effect === null)) return null;
  return parsed as ParsedEffect[];
}

function serializeEffect(effect: Pick<ParsedEffect, 'variableName' | 'operation' | 'value'>, variables: readonly VariableDeclaration[]): string | null {
  const variableName = effect.variableName.trim().replace(/^\$/, '');
  if (!variableName) return null;
  const variable = variables.find((item) => item.name === variableName);
  const rhs = quoteEffectValue(variable, effect.value);
  if (effect.operation === 'add') return `${variableName}+${rhs}`;
  if (effect.operation === 'subtract') return `${variableName}-${rhs}`;
  if (effect.operation === 'append') return `${variableName}←${rhs}`;
  return `${variableName}=${rhs}`;
}

function serializeEffects(effects: readonly ParsedEffect[], variables: readonly VariableDeclaration[]): string | null {
  const raw = effects
    .map((effect) => serializeEffect(effect, variables))
    .filter((effect): effect is string => Boolean(effect))
    .join(', ');
  return raw || null;
}

function variableDefaultValue(variable: VariableDeclaration | undefined): string {
  if (!variable) return '';
  if (variable.type === 'bool') return 'true';
  if (variable.type === 'enum') return variable.enumValues?.[0] ?? '';
  if (variable.type === 'string') return '';
  return '0';
}

function VariableValueInput({
  variable,
  value,
  testId,
  ariaLabel,
  onChange,
  onBlur,
  onEnter,
}: {
  readonly variable: VariableDeclaration | undefined;
  readonly value: string;
  readonly testId?: string;
  readonly ariaLabel: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly onEnter?: () => void;
}): React.ReactElement {
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === 'Enter' && onEnter) {
      event.preventDefault();
      onEnter();
    }
  }, [onEnter]);

  if (variable?.type === 'bool') {
    return (
      <select data-testid={testId} value={value || 'true'} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} onKeyDown={handleKeyDown} aria-label={ariaLabel}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (variable?.type === 'enum' && variable.enumValues?.length) {
    return (
      <select data-testid={testId} value={value || variable.enumValues[0]} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} onKeyDown={handleKeyDown} aria-label={ariaLabel}>
        {variable.enumValues.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    );
  }
  const isNumeric = variable?.type === 'int' || variable?.type === 'float';
  return (
    <input
      data-testid={testId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      inputMode={isNumeric ? 'decimal' : undefined}
      placeholder={variable?.type === 'string' ? '' : '0'}
      aria-label={ariaLabel}
    />
  );
}

function ConditionBuilder({
  variables,
  raw,
  index,
  onCommit,
}: {
  readonly variables: readonly VariableDeclaration[];
  readonly raw: string | null;
  readonly index: number;
  readonly onCommit: (raw: string | null) => void;
}): React.ReactElement {
  const text = useAppText();
  const parsed = parseSimpleCondition(raw);
  const fallback = Boolean(raw?.trim()) && !parsed;
  const firstVariable = variables[0]?.name ?? '';
  const [variableName, setVariableName] = useState(parsed?.variableName || firstVariable);
  const [operator, setOperator] = useState<ConditionOperator>(parsed?.operator ?? '==');
  const [value, setValue] = useState(parsed?.value ?? '');

  React.useEffect(() => {
    const next = parseSimpleCondition(raw);
    setVariableName(next?.variableName || firstVariable);
    setOperator(next?.operator ?? '==');
    setValue(next?.value ?? '');
  }, [firstVariable, raw]);

  const commit = useCallback(() => {
    onCommit(serializeCondition(variableName, operator, value));
  }, [onCommit, operator, value, variableName]);

  if (fallback) {
    return (
      <div className="graph-lab-expression-fallback">
        <EditableField
          label={text('inspector.rawCondition')}
          testId={`graph-inspector-option-condition-${index}`}
          value={raw ?? ''}
          onCommit={(nextRaw) => onCommit(nextRaw.trim() ? nextRaw : null)}
        />
        <p>{text('inspector.rawConditionHint')}</p>
      </div>
    );
  }

  return (
    <div className="graph-lab-condition-builder" data-testid={`graph-inspector-condition-builder-${index}`}>
      <select
        data-testid={`graph-inspector-option-condition-variable-${index}`}
        value={variableName}
        onChange={(event) => {
          setVariableName(event.target.value);
          if (value.trim()) onCommit(serializeCondition(event.target.value, operator, value));
        }}
        disabled={variables.length === 0}
        aria-label={text('inspector.conditionVariable')}
      >
        {variables.length === 0 ? (
          <option value="">{text('inspector.noVariables')}</option>
        ) : variables.map((variable) => (
          <option key={variable.name} value={variable.name}>{variable.name}</option>
        ))}
      </select>
      <select
        data-testid={`graph-inspector-option-condition-operator-${index}`}
        value={operator}
        onChange={(event) => {
          const nextOperator = event.target.value as ConditionOperator;
          setOperator(nextOperator);
          if (value.trim()) onCommit(serializeCondition(variableName, nextOperator, value));
        }}
        disabled={variables.length === 0}
        aria-label={text('inspector.conditionOperator')}
      >
        {CONDITION_OPERATORS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <VariableValueInput
        variable={variables.find((item) => item.name === variableName)}
        value={value}
        testId={`graph-inspector-option-condition-${index}`}
        ariaLabel={text('inspector.conditionValue')}
        onChange={setValue}
        onBlur={commit}
        onEnter={commit}
      />
      <button type="button" className="icon-button" title={text('inspector.clearCondition')} aria-label={text('inspector.clearCondition')} onClick={() => onCommit(null)} disabled={!raw?.trim()}>
        <X aria-hidden="true" size={14} strokeWidth={2} />
      </button>
      {variables.length === 0 && <p className="graph-lab-control-hint">{text('inspector.noVariablesDeclared')}</p>}
    </div>
  );
}

function EffectsEditor({
  variables,
  raw,
  index,
  onCommit,
}: {
  readonly variables: readonly VariableDeclaration[];
  readonly raw: string | null;
  readonly index: number;
  readonly onCommit: (raw: string | null) => void;
}): React.ReactElement {
  const text = useAppText();
  const parsed = parseSimpleEffects(raw);
  const fallback = parsed === null;
  const effects = parsed ?? [];
  const firstVariable = variables[0]?.name ?? '';
  const [draftVariable, setDraftVariable] = useState(firstVariable);
  const [draftOperation, setDraftOperation] = useState<EffectOperation>('set');
  const [draftValue, setDraftValue] = useState('');
  const draftVariableDef = variables.find((item) => item.name === draftVariable);

  React.useEffect(() => {
    if (!draftVariable && firstVariable) setDraftVariable(firstVariable);
  }, [draftVariable, firstVariable]);

  const updateEffect = useCallback((effectIndex: number, patch: Partial<ParsedEffect>) => {
    const nextEffects = effects.map((effect, itemIndex) =>
      itemIndex === effectIndex ? { ...effect, ...patch } : effect,
    );
    onCommit(serializeEffects(nextEffects, variables));
  }, [effects, onCommit, variables]);

  const removeEffect = useCallback((effectIndex: number) => {
    const nextEffects = effects.filter((_, itemIndex) => itemIndex !== effectIndex);
    onCommit(serializeEffects(nextEffects, variables));
  }, [effects, onCommit, variables]);

  const addEffect = useCallback(() => {
    if (!draftVariable) return;
    const nextEffect: ParsedEffect = {
      variableName: draftVariable,
      operation: draftOperation,
      value: draftValue || variableDefaultValue(draftVariableDef),
    };
    onCommit(serializeEffects([...effects, nextEffect], variables));
    setDraftValue('');
  }, [draftOperation, draftValue, draftVariable, draftVariableDef, effects, onCommit, variables]);

  if (fallback) {
    return (
      <div className="graph-lab-expression-fallback">
        <EditableField
          label={text('inspector.rawEffects')}
          testId={`graph-inspector-option-effects-${index}`}
          value={raw ?? ''}
          onCommit={(nextRaw) => onCommit(nextRaw.trim() ? nextRaw : null)}
        />
        <p>{text('inspector.rawEffectsHint')}</p>
      </div>
    );
  }

  return (
    <div className="graph-lab-effect-editor" data-testid={`graph-inspector-effect-editor-${index}`}>
      {effects.length > 0 && (
        <div className="graph-lab-effect-list">
          {effects.map((effect, effectIndex) => {
            const variable = variables.find((item) => item.name === effect.variableName);
            return (
              <div className="graph-lab-effect-row" key={`${effect.variableName}-${effectIndex}`}>
                <select
                  value={effect.variableName}
                  onChange={(event) => updateEffect(effectIndex, {
                    variableName: event.target.value,
                    value: variableDefaultValue(variables.find((item) => item.name === event.target.value)),
                  })}
                  aria-label={text('inspector.effectVariable')}
                >
                  {variables.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <select
                  value={effect.operation}
                  onChange={(event) => updateEffect(effectIndex, { operation: event.target.value as EffectOperation })}
                  aria-label={text('inspector.effectOperationLabel')}
                >
                  {EFFECT_OPERATIONS.map((item) => <option key={item} value={item}>{effectOperationLabel(item, text)}</option>)}
                </select>
                <VariableValueInput
                  variable={variable}
                  value={effect.value}
                  ariaLabel={text('inspector.effectValue')}
                  onChange={(nextValue) => updateEffect(effectIndex, { value: nextValue })}
                />
                <button type="button" className="icon-button icon-button--danger" title={text('inspector.deleteEffect')} aria-label={text('inspector.deleteEffect')} onClick={() => removeEffect(effectIndex)}>
                  <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="graph-lab-effect-builder" data-testid="graph-inspector-effect-builder">
        <select
          data-testid={`graph-inspector-option-effect-variable-${index}`}
          value={draftVariable}
          onChange={(event) => setDraftVariable(event.target.value)}
          disabled={variables.length === 0}
          aria-label={text('inspector.effectVariable')}
        >
          {variables.length === 0 ? (
            <option value="">{text('inspector.noVariables')}</option>
          ) : variables.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>
        <select
          data-testid={`graph-inspector-option-effect-operation-${index}`}
          value={draftOperation}
          onChange={(event) => setDraftOperation(event.target.value as EffectOperation)}
          disabled={variables.length === 0}
          aria-label={text('inspector.effectOperationLabel')}
        >
          {EFFECT_OPERATIONS.map((item) => <option key={item} value={item}>{effectOperationLabel(item, text)}</option>)}
        </select>
        <VariableValueInput
          variable={draftVariableDef}
          value={draftValue}
          testId={`graph-inspector-option-effect-value-${index}`}
          ariaLabel={text('inspector.effectValue')}
          onChange={setDraftValue}
          onEnter={addEffect}
        />
        <button
          type="button"
          className="graph-lab-inline-button"
          data-testid={`graph-inspector-option-effect-add-${index}`}
          onClick={addEffect}
          disabled={!draftVariable}
        >
          <Plus aria-hidden="true" size={14} strokeWidth={2} />
          <span>{text('inspector.addEffect')}</span>
        </button>
        {variables.length === 0 && <p className="graph-lab-control-hint">{text('inspector.noVariablesDeclared')}</p>}
      </div>
    </div>
  );
}

export function GraphInspector(): React.ReactElement {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const allNodes = useStoryStore((state) => state.getAllNodes());
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const [variableName, setVariableName] = useState('');
  const [variableType, setVariableType] = useState('int');
  const text = useAppText();

  const node = useMemo(
    () => {
      const id = selectedNodeId ?? activeNodeId;
      return id ? useStoryStore.getState().getNodeByFullId(id) : undefined;
    },
    [activeNodeId, selectedNodeId, plotFlowData],
  );

  const chapterOptions = useMemo(
    () => plotFlowData?.chapters.map((chapter) => chapter.title).filter(Boolean) ?? [],
    [plotFlowData],
  );
  const variables = plotFlowData?.variables ?? [];

  const commitNodePatch = useCallback((patch: Parameters<typeof graphEditService.updateNode>[1]) => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    graphEditService.updateNode(selected, patch);
    if ((patch.title && patch.title.trim()) || (patch.chapterTitle && patch.chapterTitle.trim())) {
      const nextChapterId = patch.chapterTitle?.trim() || selected.chapterId;
      const nextTitle = patch.title?.trim() || selected.title;
      const nextFullId = `${nextChapterId}-${nextTitle}`;
      useGraphStore.getState().selectNode(nextFullId);
      useEditorStore.getState().setActiveNodeId(nextFullId);
    }
    setStatusMessage(text('inspector.updatedNode'));
  }, [setStatusMessage, text]);

  const commitOptionPatch = useCallback((option: Option, patch: Parameters<typeof graphEditService.updateOption>[1]) => {
    graphEditService.updateOption(option, patch);
    setStatusMessage(text('inspector.updatedOption'));
  }, [setStatusMessage, text]);

  const handleAddOption = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    graphEditService.addOption(selected, { description: text('inspector.newOption') });
    setStatusMessage(text('inspector.addedOption'));
  }, [setStatusMessage, text]);

  const handleDeleteNode = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    graphEditService.deleteNode(selected);
    useGraphStore.getState().selectNode(null);
    setStatusMessage(text('inspector.deletedNode'));
  }, [setStatusMessage, text]);

  const handleVariableSubmit = useCallback(() => {
    if (!variableName.trim()) return;
    graphEditService.upsertVariable({
      name: variableName.trim(),
      type: variableType,
    });
    setVariableName('');
    setVariableType('int');
    setStatusMessage(text('inspector.updatedVariable'));
  }, [setStatusMessage, text, variableName, variableType]);

  const handleVariableNameKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleVariableSubmit();
  }, [handleVariableSubmit]);

  const handleVariableDelete = useCallback((name: string) => {
    graphEditService.deleteVariable(name);
    setStatusMessage(text('inspector.updatedVariable'));
  }, [setStatusMessage, text]);

  return (
    <aside className="graph-lab-inspector" aria-label={text('inspector.aria')} data-testid="graph-lab-inspector">
      <div className="graph-lab-panel__header">
        <span className="graph-lab-panel__eyebrow">Inspector</span>
        <h2>{node ? node.title : text('inspector.emptyTitle')}</h2>
      </div>

      <section className="graph-lab-section">
        <h3>{text('inspector.storyInfo')}</h3>
        <EditableField
          label={text('inspector.title')}
          testId="graph-inspector-meta-title"
          value={plotFlowData?.meta.title ?? ''}
          onCommit={(value) => {
            graphEditService.updateMeta('title', value);
            setStatusMessage(text('inspector.updatedStoryTitle'));
          }}
        />
        <EditableField
          label={text('inspector.author')}
          testId="graph-inspector-meta-author"
          value={plotFlowData?.meta.author ?? ''}
          onCommit={(value) => {
            graphEditService.updateMeta('author', value);
            setStatusMessage(text('inspector.updatedAuthor'));
          }}
        />
      </section>

      {node ? (
        <>
          <section className="graph-lab-section">
            <div className="graph-lab-section__title">
              <h3>{text('inspector.node')}</h3>
              <button type="button" className="icon-button" title={text('inspector.deleteNode')} aria-label={text('inspector.deleteNode')} onClick={handleDeleteNode}>
                <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
              </button>
            </div>
            <EditableField
              label={text('inspector.title')}
              testId="graph-inspector-node-title"
              value={node.title}
              onCommit={(value) => commitNodePatch({ title: value })}
            />
            <label className="graph-lab-field">
              <span>{text('inspector.chapter')}</span>
              <select
                data-testid="graph-inspector-node-chapter"
                value={node.chapterId}
                onChange={(event) => commitNodePatch({ chapterTitle: event.target.value })}
              >
                {chapterOptions.length === 0 && <option value={node.chapterId}>{node.chapterId || text('inspector.defaultChapter')}</option>}
                {chapterOptions.map((chapter) => (
                  <option key={chapter} value={chapter}>{chapter}</option>
                ))}
              </select>
            </label>
            <EditableField
              label={text('inspector.body')}
              testId="graph-inspector-node-body"
              value={node.body}
              multiline
              onCommit={(value) => commitNodePatch({ body: value })}
            />
          </section>

          <section className="graph-lab-section">
            <div className="graph-lab-section__title">
              <h3>{text('inspector.options')}</h3>
              <button type="button" className="graph-lab-inline-button" data-testid="graph-inspector-add-option" onClick={handleAddOption}>
                <ListPlus aria-hidden="true" size={15} strokeWidth={2} />
                <span>{text('inspector.add')}</span>
              </button>
            </div>
            {node.options.length === 0 ? (
              <p className="graph-lab-empty">{text('inspector.noOptions')}</p>
            ) : (
              <div className="graph-lab-options">
                {node.options.map((option, index) => (
                  <div className="graph-lab-option" key={`${option.lineNumber}-${index}`}>
                    <EditableField
                      label={text('inspector.optionLabel', { index: index + 1 })}
                      testId={`graph-inspector-option-description-${index}`}
                      value={option.description}
                      onCommit={(value) => commitOptionPatch(option, { description: value })}
                    />
                    <label className="graph-lab-field">
                      <span>{text('inspector.targetNode')}</span>
                      <select
                        data-testid={`graph-inspector-option-target-${index}`}
                        value={option.targetNodeId ?? ''}
                        onChange={(event) => commitOptionPatch(option, { targetNodeId: event.target.value || null })}
                      >
                        <option value="">{text('inspector.noJump')}</option>
                        {allNodes
                          .filter((target) => target.fullId !== node.fullId)
                          .map((target) => (
                            <option key={target.fullId} value={target.id}>{target.title}</option>
                          ))}
                      </select>
                    </label>
                    <div className="graph-lab-field-group">
                      <span>{text('inspector.condition')}</span>
                      <ConditionBuilder
                        variables={variables}
                        raw={option.conditionRaw ?? null}
                        index={index}
                        onCommit={(value) => commitOptionPatch(option, { conditionRaw: value })}
                      />
                    </div>
                    <div className="graph-lab-field-group">
                      <span>{text('inspector.effects')}</span>
                      <EffectsEditor
                        variables={variables}
                        raw={option.effectsRaw ?? null}
                        index={index}
                        onCommit={(value) => commitOptionPatch(option, { effectsRaw: value })}
                      />
                    </div>
                    <div className="graph-lab-option__actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.moveUp')}
                        aria-label={text('inspector.moveUp')}
                        disabled={index === 0}
                        onClick={() => graphEditService.reorderOption(node, index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.moveDown')}
                        aria-label={text('inspector.moveDown')}
                        disabled={index === node.options.length - 1}
                        onClick={() => graphEditService.reorderOption(node, index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.clearJump')}
                        aria-label={text('inspector.clearJump')}
                        onClick={() => graphEditService.connectOption(option, null)}
                      >
                        <Link2Off aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        title={text('inspector.deleteOption')}
                        aria-label={text('inspector.deleteOption')}
                        onClick={() => graphEditService.deleteOption(option)}
                      >
                        <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="graph-lab-empty">{text('inspector.selectHint')}</p>
      )}

      <section className="graph-lab-section">
        <h3>{text('inspector.variables')}</h3>
        {variables.length > 0 ? (
          <div className="graph-lab-variable-list" data-testid="graph-inspector-variable-list">
            {variables.map((variable) => (
              <div className="graph-lab-variable-row" key={variable.name}>
                <div>
                  <strong>{variable.name}</strong>
                  <small>{variable.type} = {formatVariableDefault(variable)}</small>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  title={text('inspector.deleteVariable')}
                  aria-label={text('inspector.deleteVariable')}
                  onClick={() => handleVariableDelete(variable.name)}
                >
                  <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="graph-lab-empty">{text('inspector.noVariablesDeclared')}</p>
        )}
        <label className="graph-lab-field">
          <span>{text('inspector.variableName')}</span>
          <input
            data-testid="graph-inspector-variable-name"
            value={variableName}
            onChange={(event) => setVariableName(event.target.value)}
            onKeyDown={handleVariableNameKeyDown}
            placeholder={text('inspector.variablePlaceholder')}
          />
        </label>
        <label className="graph-lab-field">
          <span>{text('inspector.variableType')}</span>
          <select data-testid="graph-inspector-variable-type" value={variableType} onChange={(event) => setVariableType(event.target.value)}>
            <option value="int">int</option>
            <option value="float">float</option>
            <option value="bool">bool</option>
            <option value="string">string</option>
          </select>
        </label>
        <button type="button" className="graph-lab-inline-button" data-testid="graph-inspector-save-variable" onClick={handleVariableSubmit} disabled={!variableName.trim()}>{text('inspector.saveVariable')}</button>
      </section>
    </aside>
  );
}
