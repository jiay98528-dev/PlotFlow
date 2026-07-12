import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2Off, ListPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
  Option,
  StoryNode,
  VariableDeclaration,
  VariableScope,
  VariableType,
  VariableValue,
} from '@plotflow/core';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { graphEditService, type VariablePatch } from '../../services/graphEditService';
import { useAppText } from '../../i18n/appI18n';
import { useCompactGraphLayout } from '../../hooks/useCompactGraphLayout';
import {
  ConditionTreeEditor,
  serializeConditionExpression,
} from '../condition/ConditionTreeEditor';

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
  readonly multiline?: boolean;
  readonly onCommit: (value: string) => boolean;
}

function EditableField({ label, value, testId, multiline = false, onCommit }: FieldProps): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const [commitRejected, setCommitRejected] = useState(false);
  const lastCommittedRef = React.useRef(value);
  const text = useAppText();

  React.useEffect(() => {
    lastCommittedRef.current = value;
    setDraft(value);
    setCommitRejected(false);
  }, [value]);

  const commit = useCallback((nextValue: string): boolean => {
    if (nextValue === lastCommittedRef.current) return true;
    const committed = onCommit(nextValue);
    if (committed) {
      lastCommittedRef.current = nextValue;
      setCommitRejected(false);
      return true;
    }
    setCommitRejected(true);
    return false;
  }, [onCommit]);

  const updateDraft = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    setCommitRejected(false);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((!multiline && event.key === 'Enter') || (multiline && event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      if (commit(event.currentTarget.value)) event.currentTarget.blur();
    }
  }, [commit, multiline]);

  return (
    <label className="graph-lab-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          data-testid={testId}
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          aria-invalid={commitRejected || undefined}
          rows={5}
        />
      ) : (
        <input
          data-testid={testId}
          type="text"
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          aria-invalid={commitRejected || undefined}
        />
      )}
      {commitRejected && <small role="alert">{text('inspector.updateRejected')}</small>}
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

const VARIABLE_TYPES: readonly VariableType[] = ['int', 'float', 'bool', 'string', 'enum', 'object'];
const RESERVED_VARIABLE_NAMES = new Set([
  'int', 'float', 'bool', 'string', 'enum', 'object',
  'true', 'false', 'AND', 'OR', 'NOT', 'none',
  'plotflow', 'title', 'author', 'engine', 'layout', 'graph', 'version', 'nodes', 'x', 'y', 'vars',
]);
const VARIABLE_NAME_RE = /^[\p{L}][\p{L}\p{N}_]{0,63}$/u;

interface VariableFieldDraft {
  readonly key: string;
  readonly name: string;
  readonly type: VariableType;
  readonly defaultValue: string;
  readonly description: string;
  readonly enumValues: string;
  readonly fields: readonly VariableFieldDraft[];
}

let variableFieldSequence = 0;

function createVariableFieldDraft(): VariableFieldDraft {
  variableFieldSequence += 1;
  return {
    key: `variable-field-${variableFieldSequence}`,
    name: '',
    type: 'int',
    defaultValue: '0',
    description: '',
    enumValues: '',
    fields: [],
  };
}

function variableValueToDraft(value: VariableValue, type: VariableType): string {
  if (type === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function declarationToFieldDraft(variable: VariableDeclaration): VariableFieldDraft {
  variableFieldSequence += 1;
  return {
    key: `variable-field-${variableFieldSequence}`,
    name: variable.name,
    type: variable.type,
    defaultValue: variableValueToDraft(variable.defaultValue, variable.type),
    description: variable.description ?? '',
    enumValues: variable.enumValues?.join('\n') ?? '',
    fields: variable.fields?.map(declarationToFieldDraft) ?? [],
  };
}

function enumValuesFromDraft(raw: string): string[] {
  return raw.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
}

function variableNameIsValid(name: string): boolean {
  const normalized = name.trim();
  return VARIABLE_NAME_RE.test(normalized) && !RESERVED_VARIABLE_NAMES.has(normalized);
}

function parseVariableDefault(
  type: VariableType,
  raw: string,
  enumValues: string,
  fields: readonly VariableFieldDraft[],
): VariableValue | null {
  if (type === 'int') {
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (type === 'float') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  if (type === 'bool') return raw === 'true' ? true : raw === 'false' ? false : null;
  if (type === 'string') return raw;
  if (type === 'enum') {
    const values = enumValuesFromDraft(enumValues);
    return values.includes(raw) ? raw : null;
  }
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = parseVariableDefault(field.type, field.defaultValue, field.enumValues, field.fields);
    if (value === null) return null;
    result[field.name.trim()] = value;
  }
  return result;
}

function fieldDraftIsValid(field: VariableFieldDraft, objectDepth: number): boolean {
  if (!variableNameIsValid(field.name)) return false;
  const enumValues = enumValuesFromDraft(field.enumValues);
  if (field.type === 'enum' && (enumValues.length === 0 || new Set(enumValues).size !== enumValues.length)) return false;
  if (parseVariableDefault(field.type, field.defaultValue, field.enumValues, field.fields) === null) return false;
  if (field.type !== 'object') return true;
  if (objectDepth >= 3) return false;
  const names = field.fields.map((item) => item.name.trim()).filter(Boolean);
  return names.length === new Set(names).size
    && field.fields.every((item) => fieldDraftIsValid(item, objectDepth + 1));
}

function fieldsDraftIsValid(fields: readonly VariableFieldDraft[]): boolean {
  const names = fields.map((field) => field.name.trim()).filter(Boolean);
  return names.length === new Set(names).size
    && fields.every((field) => fieldDraftIsValid(field, 1));
}

function fieldDraftToPatch(field: VariableFieldDraft): VariablePatch {
  const defaultValue = parseVariableDefault(field.type, field.defaultValue, field.enumValues, field.fields);
  return {
    name: field.name.trim(),
    type: field.type,
    ...(defaultValue !== null ? { defaultValue } : {}),
    ...(field.description.trim() ? { description: field.description.trim() } : {}),
    ...(field.type === 'enum' ? { enumValues: enumValuesFromDraft(field.enumValues) } : {}),
    ...(field.type === 'object' ? { fields: field.fields.map(fieldDraftToPatch) } : {}),
  };
}

function defaultDraftForType(
  type: VariableType,
  enumValues: string,
  fields: readonly VariableFieldDraft[],
): string {
  if (type === 'int') return '0';
  if (type === 'float') return '0.0';
  if (type === 'bool') return 'false';
  if (type === 'string') return '';
  if (type === 'enum') return enumValuesFromDraft(enumValues)[0] ?? '—';
  const value = parseVariableDefault('object', '', '', fields) ?? {};
  return Object.keys(value).length > 0 ? JSON.stringify(value) : '{}';
}

function VariableDefaultControl({
  type,
  enumValues,
  fields,
  value,
  testId,
  onChange,
  text,
}: {
  readonly type: VariableType;
  readonly enumValues: string;
  readonly fields: readonly VariableFieldDraft[];
  readonly value: string;
  readonly testId?: string;
  readonly onChange: (value: string) => void;
  readonly text: ReturnType<typeof useAppText>;
}): React.ReactElement {
  if (type === 'object') {
    return (
      <div className="graph-lab-readonly-field">
        <span>{text('inspector.defaultValue')}</span>
        <output data-testid={testId}>{defaultDraftForType(type, enumValues, fields)}</output>
      </div>
    );
  }
  if (type === 'bool') {
    return (
      <label className="graph-lab-field">
        <span>{text('inspector.defaultValue')}</span>
        <select data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </label>
    );
  }
  if (type === 'enum') {
    const values = enumValuesFromDraft(enumValues);
    return (
      <label className="graph-lab-field">
        <span>{text('inspector.defaultValue')}</span>
        <select data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)}>
          {values.length === 0
            ? <option value="">{text('inspector.noEnumValues')}</option>
            : values.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="graph-lab-field">
      <span>{text('inspector.defaultValue')}</span>
      <input
        data-testid={testId}
        type={type === 'int' || type === 'float' ? 'number' : 'text'}
        step={type === 'float' ? 'any' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface VariableFieldsEditorProps {
  readonly fields: readonly VariableFieldDraft[];
  readonly objectDepth: number;
  readonly pathPrefix?: string;
  readonly onChange: (fields: readonly VariableFieldDraft[]) => void;
  readonly text: ReturnType<typeof useAppText>;
}

function VariableFieldsEditor({
  fields,
  objectDepth,
  pathPrefix = 'root',
  onChange,
  text,
}: VariableFieldsEditorProps): React.ReactElement {
  const updateField = useCallback((index: number, patch: Partial<VariableFieldDraft>) => {
    onChange(fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  }, [fields, onChange]);

  return (
    <div
      className="graph-lab-variable-fields"
      data-depth={objectDepth}
      data-testid={`graph-inspector-variable-fields-${pathPrefix}`}
    >
      {fields.map((field, index) => {
        const fieldPath = `${pathPrefix}-${index}`;
        return (
        <div className="graph-lab-variable-field" key={field.key}>
          <div className="graph-lab-variable-field__row">
            <input
              data-testid={`graph-inspector-variable-field-name-${fieldPath}`}
              value={field.name}
              onChange={(event) => updateField(index, { name: event.target.value })}
              placeholder={text('inspector.variableFieldName')}
              aria-label={text('inspector.variableFieldName')}
            />
            <select
              data-testid={`graph-inspector-variable-field-type-${fieldPath}`}
              value={field.type}
              onChange={(event) => {
                const type = event.target.value as VariableType;
                updateField(index, {
                  type,
                  defaultValue: defaultDraftForType(type, field.enumValues, field.fields),
                  ...(type === 'object' ? {} : { fields: [] }),
                  ...(type === 'enum' ? {} : { enumValues: '' }),
                });
              }}
              aria-label={text('inspector.variableFieldType')}
            >
              {VARIABLE_TYPES.filter((type) => type !== 'object' || objectDepth < 3).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button icon-button--danger"
              data-testid={`graph-inspector-variable-field-delete-${fieldPath}`}
              title={text('inspector.deleteVariableField')}
              aria-label={text('inspector.deleteVariableField')}
              onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}
            >
              <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
            </button>
          </div>
          {field.type === 'enum' && (
            <label className="graph-lab-field">
              <span>{text('inspector.enumValues')}</span>
              <textarea
                data-testid={`graph-inspector-variable-field-enum-${fieldPath}`}
                rows={3}
                value={field.enumValues}
                onChange={(event) => {
                  const enumValues = event.target.value;
                  const values = enumValuesFromDraft(enumValues);
                  updateField(index, {
                    enumValues,
                    defaultValue: values.includes(field.defaultValue) ? field.defaultValue : values[0] ?? '',
                  });
                }}
                placeholder={text('inspector.enumValuesPlaceholder')}
              />
            </label>
          )}
          <VariableDefaultControl
            type={field.type}
            enumValues={field.enumValues}
            fields={field.fields}
            value={field.defaultValue}
            testId={`graph-inspector-variable-field-default-${fieldPath}`}
            onChange={(defaultValue) => updateField(index, { defaultValue })}
            text={text}
          />
          <label className="graph-lab-field">
            <span>{text('inspector.variableDescription')}</span>
            <input
              data-testid={`graph-inspector-variable-field-description-${fieldPath}`}
              value={field.description}
              onChange={(event) => updateField(index, { description: event.target.value })}
            />
          </label>
          {field.type === 'object' && objectDepth < 3 && (
            <VariableFieldsEditor
              fields={field.fields}
              objectDepth={objectDepth + 1}
              pathPrefix={fieldPath}
              onChange={(nextFields) => updateField(index, { fields: nextFields })}
              text={text}
            />
          )}
        </div>
        );
      })}
      <button
        type="button"
        className="graph-lab-inline-button"
        data-testid={`graph-inspector-variable-field-add-${pathPrefix}`}
        onClick={() => onChange([...fields, createVariableFieldDraft()])}
      >
        <Plus aria-hidden="true" size={14} strokeWidth={2} />
        <span>{text('inspector.addVariableField', { depth: objectDepth })}</span>
      </button>
    </div>
  );
}

function quoteEffectValue(variable: VariableDeclaration | undefined, value: string): string {
  if (!variable) return value.trim();
  if (variable.type === 'string' || variable.type === 'enum') return JSON.stringify(value);
  if (variable.type === 'bool') return value === 'true' ? 'true' : 'false';
  return value.trim() || '0';
}

type EffectOperation = 'set' | 'add' | 'subtract' | 'append';

interface ParsedEffect {
  readonly variableName: string;
  readonly operation: EffectOperation;
  readonly value: string;
}

const EFFECT_OPERATIONS: readonly EffectOperation[] = ['set', 'add', 'subtract', 'append'];

function effectOperationLabel(operation: EffectOperation, text: ReturnType<typeof useAppText>): string {
  if (operation === 'add') return text('inspector.effectOperationAdd');
  if (operation === 'subtract') return text('inspector.effectOperationSubtract');
  if (operation === 'append') return text('inspector.effectOperationAppend');
  return text('inspector.effectOperationSet');
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

function OptionConditionEditor({
  option,
  variables,
  index,
  onCommit,
}: {
  readonly option: Option;
  readonly variables: readonly VariableDeclaration[];
  readonly index: number;
  readonly onCommit: (raw: string | null) => boolean;
}): React.ReactElement {
  const text = useAppText();
  const setSourceDrawerOpen = useUIStore((state) => state.setSourceDrawerOpen);
  const raw = option.conditionRaw?.trim() ?? '';
  const fallback = raw.length > 0 && option.condition === null;

  if (fallback) {
    return (
      <div className="graph-lab-expression-fallback">
        <label className="graph-lab-field">
          <span>{text('inspector.rawCondition')}</span>
          <textarea
            readOnly
            rows={3}
            data-testid={`graph-inspector-option-condition-${index}`}
            value={raw}
          />
        </label>
        <p>{text('inspector.rawConditionHint')}</p>
        <button
          type="button"
          className="graph-lab-inline-button"
          onClick={() => setSourceDrawerOpen(true)}
        >
          {text('sourceDock.title')}
        </button>
      </div>
    );
  }

  return (
    <ConditionTreeEditor
      value={option.condition}
      variables={variables}
      compact
      testId={`graph-inspector-condition-tree-${index}`}
      onChange={(next) => onCommit(serializeConditionExpression(next) || null)}
    />
  );
}

function EffectsEditor({
  variables,
  raw,
  index,
  draftIdentity,
  storySessionId,
  onCommit,
}: {
  readonly variables: readonly VariableDeclaration[];
  readonly raw: string | null;
  readonly index: number;
  readonly draftIdentity: string;
  readonly storySessionId: number;
  readonly onCommit: (raw: string | null) => boolean;
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

  React.useEffect(() => {
    setDraftVariable(firstVariable);
    setDraftOperation('set');
    setDraftValue('');
  }, [draftIdentity, firstVariable, storySessionId]);

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

export type GraphInspectorContentMode = 'node' | 'story' | 'variables';

interface GraphInspectorProps {
  readonly contentMode?: GraphInspectorContentMode;
  readonly embedded?: boolean;
}

export function GraphInspector({ contentMode = 'node', embedded = false }: GraphInspectorProps): React.ReactElement {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);
  const storySessionId = useEditorStore((state) => state.storySessionId);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const allNodes = useStoryStore((state) => state.getAllNodes());
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const compactGraphPanel = useUIStore((state) => state.compactGraphPanel);
  const isCompactGraphLayout = useCompactGraphLayout();
  const [editingVariableName, setEditingVariableName] = useState<string | null>(null);
  const [variableName, setVariableName] = useState('');
  const [variableType, setVariableType] = useState<VariableType>('int');
  const [variableDefaultValue, setVariableDefaultValue] = useState('0');
  const [variableScope, setVariableScope] = useState<VariableScope | ''>('');
  const [variableChapterId, setVariableChapterId] = useState('');
  const [variableDescription, setVariableDescription] = useState('');
  const [variableEnumValues, setVariableEnumValues] = useState('');
  const [variableFields, setVariableFields] = useState<readonly VariableFieldDraft[]>([]);
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
  const nodeVariables = variables.filter((variable) => (
    variable.scope !== 'chapter' || variable.chapterId === node?.chapterId
  ));

  const commitNodePatch = useCallback((patch: Parameters<typeof graphEditService.updateNode>[1]): boolean => {
    const selected = getSelectedStoryNode();
    if (!selected) return false;
    if (patch.title !== undefined && patch.title.trim().length === 0) return false;
    const committed = graphEditService.updateNode(selected, patch);
    if (committed) setStatusMessage(text('inspector.updatedNode'));
    return committed;
  }, [setStatusMessage, text]);

  const commitOptionPatch = useCallback((option: Option, patch: Parameters<typeof graphEditService.updateOption>[1]): boolean => {
    if (patch.description !== undefined && patch.description.trim().length === 0) return false;
    const committed = graphEditService.updateOption(option, patch);
    if (committed) setStatusMessage(text('inspector.updatedOption'));
    return committed;
  }, [setStatusMessage, text]);

  const handleAddOption = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    if (graphEditService.addOption(selected, { description: text('inspector.newOption') })) {
      setStatusMessage(text('inspector.addedOption'));
    }
  }, [setStatusMessage, text]);

  const handleDeleteNode = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    if (graphEditService.deleteNode(selected)) {
      setStatusMessage(text('inspector.deletedNode'));
    }
  }, [setStatusMessage, text]);

  const resetVariableDraft = useCallback(() => {
    setEditingVariableName(null);
    setVariableName('');
    setVariableType('int');
    setVariableDefaultValue('0');
    setVariableScope('');
    setVariableChapterId('');
    setVariableDescription('');
    setVariableEnumValues('');
    setVariableFields([]);
  }, []);

  React.useEffect(() => {
    resetVariableDraft();
  }, [resetVariableDraft, storySessionId]);

  const rootEnumValues = enumValuesFromDraft(variableEnumValues);
  const parsedRootDefault = parseVariableDefault(
    variableType,
    variableDefaultValue,
    variableEnumValues,
    variableFields,
  );
  const canSaveVariable = variableNameIsValid(variableName)
    && (variableType !== 'enum' || (rootEnumValues.length > 0 && new Set(rootEnumValues).size === rootEnumValues.length))
    && (variableType !== 'object' || fieldsDraftIsValid(variableFields))
    && parsedRootDefault !== null
    && (variableScope !== 'chapter' || chapterOptions.includes(variableChapterId));

  const handleVariableSubmit = useCallback(() => {
    if (!canSaveVariable) return;
    const committed = graphEditService.upsertVariable({
      name: variableName.trim(),
      type: variableType,
      ...(editingVariableName ? { originalName: editingVariableName } : {}),
      ...(parsedRootDefault !== null ? { defaultValue: parsedRootDefault } : {}),
      ...(variableScope ? { scope: variableScope } : {}),
      ...(variableScope === 'chapter' ? { chapterId: variableChapterId } : {}),
      ...(variableDescription.trim() ? { description: variableDescription.trim() } : {}),
      ...(variableType === 'enum' ? { enumValues: enumValuesFromDraft(variableEnumValues) } : {}),
      ...(variableType === 'object' ? { fields: variableFields.map(fieldDraftToPatch) } : {}),
    });
    if (!committed) return;
    resetVariableDraft();
    setStatusMessage(text('inspector.updatedVariable'));
  }, [canSaveVariable, editingVariableName, parsedRootDefault, resetVariableDraft, setStatusMessage, text, variableChapterId, variableDescription, variableEnumValues, variableFields, variableName, variableScope, variableType]);

  const handleVariableEdit = useCallback((variable: VariableDeclaration) => {
    setEditingVariableName(variable.name);
    setVariableName(variable.name);
    setVariableType(variable.type);
    setVariableDefaultValue(variableValueToDraft(variable.defaultValue, variable.type));
    setVariableScope(variable.scope ?? '');
    setVariableChapterId(variable.chapterId ?? '');
    setVariableDescription(variable.description ?? '');
    setVariableEnumValues(variable.enumValues?.join('\n') ?? '');
    setVariableFields(variable.fields?.map(declarationToFieldDraft) ?? []);
  }, []);

  const handleVariableNameKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleVariableSubmit();
  }, [handleVariableSubmit]);

  const handleVariableDelete = useCallback((name: string) => {
    if (graphEditService.deleteVariable(name)) {
      if (editingVariableName === name) resetVariableDraft();
      setStatusMessage(text('inspector.updatedVariable'));
    }
  }, [editingVariableName, resetVariableDraft, setStatusMessage, text]);
  const rootClassName = embedded
    ? 'graph-lab-global-editor__content'
    : `graph-lab-inspector${compactGraphPanel === 'inspector' ? ' is-compact-open' : ''}`;

  return (
    <aside
      className={rootClassName}
      aria-label={embedded ? text(`globalEditor.tabs.${contentMode}`) : text('inspector.aria')}
      data-testid={embedded ? 'graph-lab-global-editor-content' : 'graph-lab-inspector'}
      {...(!embedded && isCompactGraphLayout && compactGraphPanel !== 'inspector'
        ? { 'aria-hidden': true, inert: true }
        : {})}
    >
      {!embedded && <div className="graph-lab-panel__header">
        <span className="graph-lab-panel__eyebrow">{text('inspector.node')}</span>
        <h2>{node ? node.title : text('inspector.emptyTitle')}</h2>
      </div>}

      {contentMode === 'story' && <section className="graph-lab-section">
        <h3>{text('inspector.storyInfo')}</h3>
        <EditableField
          label={text('inspector.title')}
          testId="graph-inspector-meta-title"
          value={plotFlowData?.meta.title ?? ''}
          onCommit={(value) => {
            const committed = graphEditService.updateMeta('title', value);
            if (committed) setStatusMessage(text('inspector.updatedStoryTitle'));
            return committed;
          }}
        />
        <EditableField
          label={text('inspector.author')}
          testId="graph-inspector-meta-author"
          value={plotFlowData?.meta.author ?? ''}
          onCommit={(value) => {
            const committed = graphEditService.updateMeta('author', value);
            if (committed) setStatusMessage(text('inspector.updatedAuthor'));
            return committed;
          }}
        />
        <label className="graph-lab-field">
          <span>{text('inspector.engine')}</span>
          <select
            data-testid="graph-inspector-meta-engine"
            value={plotFlowData?.meta.engine ?? 'generic'}
            onChange={(event) => {
              if (graphEditService.updateMeta('engine', event.target.value)) {
                setStatusMessage(text('inspector.updatedEngine'));
              }
            }}
          >
            <option value="generic">generic</option>
            <option value="godot">godot</option>
            <option value="unity">unity</option>
            <option value="unreal">unreal</option>
          </select>
        </label>
        <div className="graph-lab-readonly-field">
          <span>{text('inspector.plotflowVersion')}</span>
          <output data-testid="graph-inspector-meta-plotflow">{plotFlowData?.meta.plotflow ?? '0.1'}</output>
        </div>
      </section>}

      {contentMode === 'node' && (node ? (
        <>
          <section className="graph-lab-section">
            <div className="graph-lab-section__title">
              <h3>{text('inspector.node')}</h3>
              <button type="button" className="icon-button" title={text('inspector.deleteNode')} aria-label={text('inspector.deleteNode')} onClick={handleDeleteNode}>
                <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
              </button>
            </div>
            <>
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
            </>
            {(node.options.length === 0 || node.nextTarget) && (
              <div className="graph-lab-next-target">
                <h4>{text('inspector.nextTarget')}</h4>
                <label className="graph-lab-field">
                  <span>{text('inspector.targetNode')}</span>
                  <select
                    data-testid="graph-inspector-next-target"
                    value={node.nextTarget?.targetFullId ?? ''}
                    onChange={(event) => {
                      if (graphEditService.updateNextTarget(node, { targetFullId: event.target.value || null })) {
                        setStatusMessage(text('inspector.updatedNextTarget'));
                      }
                    }}
                  >
                    <option value="">{text('inspector.noJump')}</option>
                    {allNodes
                      .filter((target) => target.fullId !== node.fullId)
                      .map((target) => (
                        <option key={target.fullId} value={target.fullId}>
                          {target.chapterId} / {target.title}
                        </option>
                      ))}
                  </select>
                </label>
                {node.nextTarget?.targetFullId && (
                  <div className="graph-lab-field-group">
                    <span>{text('inspector.nextEffects')}</span>
                    <EffectsEditor
                      variables={nodeVariables}
                      raw={node.nextTarget.effectsRaw}
                      index={-1}
                      draftIdentity={`${node.fullId}:next`}
                      storySessionId={storySessionId}
                      onCommit={(value) => {
                        const committed = graphEditService.updateNextTarget(node, { effectsRaw: value });
                        if (committed) setStatusMessage(text('inspector.updatedNextTarget'));
                        return committed;
                      }}
                    />
                  </div>
                )}
              </div>
            )}
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
                        value={option.targetFullId ?? ''}
                        onChange={(event) => {
                          const target = allNodes.find((candidate) => candidate.fullId === event.target.value);
                          commitOptionPatch(option, {
                            targetNodeId: target?.id ?? null,
                            targetChapterId: target?.chapterId ?? null,
                          });
                        }}
                      >
                        <option value="">{text('inspector.noJump')}</option>
                        {allNodes
                          .filter((target) => target.fullId !== node.fullId)
                          .map((target) => (
                            <option key={target.fullId} value={target.fullId}>
                              {target.chapterId} / {target.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="graph-lab-field-group">
                      <span>{text('inspector.condition')}</span>
                      <OptionConditionEditor
                        option={option}
                        variables={nodeVariables}
                        index={index}
                        onCommit={(value) => commitOptionPatch(option, { conditionRaw: value })}
                      />
                    </div>
                    <div className="graph-lab-field-group">
                      <span>{text('inspector.effects')}</span>
                      <EffectsEditor
                        variables={nodeVariables}
                        raw={option.effectsRaw ?? null}
                        index={index}
                        draftIdentity={`${node.fullId}:option:${option.lineNumber}:${index}`}
                        storySessionId={storySessionId}
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
      ))}

      {contentMode === 'variables' && <section className="graph-lab-section">
        <h3>{text('inspector.variables')}</h3>
        {variables.length > 0 ? (
          <div className="graph-lab-variable-list" data-testid="graph-inspector-variable-list">
            {variables.map((variable) => (
              <div className="graph-lab-variable-row" key={variable.name}>
                <div>
                  <strong>{variable.name}</strong>
                  <small>
                    {variable.type} = {formatVariableDefault(variable)} · {variable.scope ?? 'global'}
                    {variable.scope === 'chapter' && variable.chapterId ? ` / ${variable.chapterId}` : ''}
                  </small>
                </div>
                <div className="graph-lab-variable-row__actions">
                  <button
                    type="button"
                    className="icon-button"
                    title={text('inspector.editVariable')}
                    aria-label={text('inspector.editVariable')}
                    onClick={() => handleVariableEdit(variable)}
                  >
                    <Pencil aria-hidden="true" size={14} strokeWidth={2} />
                  </button>
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
          <select
            data-testid="graph-inspector-variable-type"
            value={variableType}
            onChange={(event) => {
              const type = event.target.value as VariableType;
              setVariableType(type);
              setVariableDefaultValue(defaultDraftForType(type, variableEnumValues, variableFields));
              if (type !== 'enum') setVariableEnumValues('');
              if (type !== 'object') setVariableFields([]);
            }}
          >
            {VARIABLE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        {variableType === 'enum' && (
          <label className="graph-lab-field">
            <span>{text('inspector.enumValues')}</span>
            <textarea
              data-testid="graph-inspector-variable-enum-values"
              rows={4}
              value={variableEnumValues}
              onChange={(event) => {
                const enumValues = event.target.value;
                const values = enumValuesFromDraft(enumValues);
                setVariableEnumValues(enumValues);
                if (!values.includes(variableDefaultValue)) setVariableDefaultValue(values[0] ?? '');
              }}
              placeholder={text('inspector.enumValuesPlaceholder')}
            />
          </label>
        )}
        {variableType === 'object' && (
          <div className="graph-lab-field-group">
            <span>{text('inspector.objectFields')}</span>
            <VariableFieldsEditor
              fields={variableFields}
              objectDepth={1}
              onChange={setVariableFields}
              text={text}
            />
          </div>
        )}
        <VariableDefaultControl
          type={variableType}
          enumValues={variableEnumValues}
          fields={variableFields}
          value={variableDefaultValue}
          testId="graph-inspector-variable-default"
          onChange={setVariableDefaultValue}
          text={text}
        />
        <label className="graph-lab-field">
          <span>{text('inspector.variableScope')}</span>
          <select
            data-testid="graph-inspector-variable-scope"
            value={variableScope}
            onChange={(event) => {
              const scope = event.target.value as VariableScope | '';
              setVariableScope(scope);
              if (scope === 'chapter') {
                setVariableChapterId((current) => (
                  chapterOptions.includes(current) ? current : chapterOptions[0] ?? ''
                ));
              } else {
                setVariableChapterId('');
              }
            }}
          >
            <option value="">{text('inspector.scopeInherited')}</option>
            <option value="global">global</option>
            <option value="chapter">chapter</option>
          </select>
        </label>
        {variableScope === 'chapter' && (
          <label className="graph-lab-field">
            <span>{text('inspector.variableChapter')}</span>
            <select
              data-testid="graph-inspector-variable-chapter"
              value={variableChapterId}
              onChange={(event) => setVariableChapterId(event.target.value)}
            >
              <option value="" disabled>{text('inspector.selectChapter')}</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter} value={chapter}>{chapter}</option>
              ))}
            </select>
          </label>
        )}
        <label className="graph-lab-field">
          <span>{text('inspector.variableDescription')}</span>
          <input
            data-testid="graph-inspector-variable-description"
            value={variableDescription}
            onChange={(event) => setVariableDescription(event.target.value)}
          />
        </label>
        {variableName.trim() && !canSaveVariable && (
          <p className="graph-lab-control-hint">{text('inspector.variableDraftInvalid')}</p>
        )}
        <div className="graph-lab-variable-form__actions">
          <button
            type="button"
            className="graph-lab-inline-button"
            data-testid="graph-inspector-save-variable"
            onClick={handleVariableSubmit}
            disabled={!canSaveVariable}
          >
            {editingVariableName ? text('inspector.updateVariable') : text('inspector.saveVariable')}
          </button>
          {editingVariableName && (
            <button type="button" className="graph-lab-inline-button" onClick={resetVariableDraft}>
              <X aria-hidden="true" size={14} strokeWidth={2} />
              <span>{text('inspector.cancelVariableEdit')}</span>
            </button>
          )}
        </div>
      </section>}
    </aside>
  );
}
