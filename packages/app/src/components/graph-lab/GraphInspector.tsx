import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2Off, ListPlus, Trash2 } from 'lucide-react';
import type { Option, StoryNode } from '@plotflow/core';
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
