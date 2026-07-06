import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2Off, ListPlus, Trash2 } from 'lucide-react';
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

  return (
    <label className="graph-lab-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          data-testid={testId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          rows={5}
        />
      ) : (
        <input
          data-testid={testId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
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

function EffectBuilder({
  variables,
  onApply,
}: {
  readonly variables: readonly VariableDeclaration[];
  readonly onApply: (raw: string) => void;
}): React.ReactElement {
  const firstVariable = variables[0]?.name ?? '';
  const [variableName, setVariableName] = useState(firstVariable);
  const [operation, setOperation] = useState<'set' | 'add' | 'subtract'>('set');
  const [value, setValue] = useState('');
  const variable = variables.find((item) => item.name === variableName);
  const numeric = variable?.type === 'int' || variable?.type === 'float';

  React.useEffect(() => {
    if (!variableName && firstVariable) setVariableName(firstVariable);
  }, [firstVariable, variableName]);

  const apply = useCallback(() => {
    if (!variableName.trim()) return;
    const rhs = quoteEffectValue(variable, value);
    const raw = operation === 'add'
      ? `${variableName}+${rhs}`
      : operation === 'subtract'
        ? `${variableName}-${rhs}`
        : `${variableName}=${rhs}`;
    onApply(raw);
    setValue('');
  }, [onApply, operation, value, variable, variableName]);

  return (
    <div className="graph-lab-effect-builder" data-testid="graph-inspector-effect-builder">
      <select
        value={variableName}
        onChange={(event) => setVariableName(event.target.value)}
        disabled={variables.length === 0}
        aria-label="Effect variable"
      >
        {variables.length === 0 ? (
          <option value="">No variables</option>
        ) : variables.map((item) => (
          <option key={item.name} value={item.name}>{item.name}</option>
        ))}
      </select>
      <select
        value={operation}
        onChange={(event) => setOperation(event.target.value as 'set' | 'add' | 'subtract')}
        aria-label="Effect operation"
      >
        <option value="set">=</option>
        {numeric && <option value="add">+</option>}
        {numeric && <option value="subtract">-</option>}
      </select>
      {variable?.type === 'bool' ? (
        <select value={value || 'true'} onChange={(event) => setValue(event.target.value)} aria-label="Effect value">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : variable?.type === 'enum' && variable.enumValues?.length ? (
        <select value={value || variable.enumValues[0]} onChange={(event) => setValue(event.target.value)} aria-label="Effect value">
          {variable.enumValues.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      ) : (
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={variable?.type === 'string' ? 'value' : '0'}
          aria-label="Effect value"
        />
      )}
      <button type="button" className="graph-lab-inline-button" onClick={apply} disabled={!variableName}>
        Apply
      </button>
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
              <button type="button" className="icon-button" title={text('inspector.deleteNode')} onClick={handleDeleteNode}>
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
                    <EditableField
                      label={text('inspector.condition')}
                      testId={`graph-inspector-option-condition-${index}`}
                      value={option.conditionRaw ?? ''}
                      onCommit={(value) => commitOptionPatch(option, { conditionRaw: value || null })}
                    />
                    <EditableField
                      label={text('inspector.effects')}
                      testId={`graph-inspector-option-effects-${index}`}
                      value={option.effectsRaw ?? ''}
                      onCommit={(value) => commitOptionPatch(option, { effectsRaw: value || null })}
                    />
                    <EffectBuilder
                      variables={variables}
                      onApply={(raw) => {
                        const nextRaw = option.effectsRaw?.trim()
                          ? `${option.effectsRaw.trim()}, ${raw}`
                          : raw;
                        commitOptionPatch(option, { effectsRaw: nextRaw });
                      }}
                    />
                    <div className="graph-lab-option__actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.moveUp')}
                        disabled={index === 0}
                        onClick={() => graphEditService.reorderOption(node, index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.moveDown')}
                        disabled={index === node.options.length - 1}
                        onClick={() => graphEditService.reorderOption(node, index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={text('inspector.clearJump')}
                        onClick={() => graphEditService.connectOption(option, null)}
                      >
                        <Link2Off aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        title={text('inspector.deleteOption')}
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
                  title="Delete variable"
                  onClick={() => handleVariableDelete(variable.name)}
                >
                  <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="graph-lab-empty">No variables declared</p>
        )}
        <label className="graph-lab-field">
          <span>{text('inspector.variableName')}</span>
          <input data-testid="graph-inspector-variable-name" value={variableName} onChange={(event) => setVariableName(event.target.value)} placeholder={text('inspector.variablePlaceholder')} />
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
        <button type="button" className="graph-lab-inline-button" data-testid="graph-inspector-save-variable" onClick={handleVariableSubmit}>{text('inspector.saveVariable')}</button>
      </section>
    </aside>
  );
}
