import React, { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2Off, ListPlus, Trash2 } from 'lucide-react';
import type { Option, StoryNode } from '@plotflow/core';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { graphEditService } from '../../services/graphEditService';

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
    setStatusMessage('Graph Lab 已更新节点');
  }, [setStatusMessage]);

  const commitOptionPatch = useCallback((option: Option, patch: Parameters<typeof graphEditService.updateOption>[1]) => {
    graphEditService.updateOption(option, patch);
    setStatusMessage('Graph Lab 已更新选项');
  }, [setStatusMessage]);

  const handleAddOption = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    graphEditService.addOption(selected, { description: '新选项' });
    setStatusMessage('Graph Lab 已添加选项');
  }, [setStatusMessage]);

  const handleDeleteNode = useCallback(() => {
    const selected = getSelectedStoryNode();
    if (!selected) return;
    graphEditService.deleteNode(selected);
    useGraphStore.getState().selectNode(null);
    setStatusMessage('Graph Lab 已删除节点');
  }, [setStatusMessage]);

  const handleVariableSubmit = useCallback(() => {
    if (!variableName.trim()) return;
    graphEditService.upsertVariable({
      name: variableName.trim(),
      type: variableType,
    });
    setVariableName('');
    setVariableType('int');
    setStatusMessage('Graph Lab 已更新变量');
  }, [setStatusMessage, variableName, variableType]);

  return (
    <aside className="graph-lab-inspector" aria-label="Graph Lab Inspector" data-testid="graph-lab-inspector">
      <div className="graph-lab-panel__header">
        <span className="graph-lab-panel__eyebrow">Inspector</span>
        <h2>{node ? node.title : '未选择节点'}</h2>
      </div>

      <section className="graph-lab-section">
        <h3>故事信息</h3>
        <EditableField
          label="标题"
          testId="graph-inspector-meta-title"
          value={plotFlowData?.meta.title ?? ''}
          onCommit={(value) => {
            graphEditService.updateMeta('title', value);
            setStatusMessage('Graph Lab 已更新故事标题');
          }}
        />
        <EditableField
          label="作者"
          testId="graph-inspector-meta-author"
          value={plotFlowData?.meta.author ?? ''}
          onCommit={(value) => {
            graphEditService.updateMeta('author', value);
            setStatusMessage('Graph Lab 已更新作者');
          }}
        />
      </section>

      {node ? (
        <>
          <section className="graph-lab-section">
            <div className="graph-lab-section__title">
              <h3>节点</h3>
              <button type="button" className="icon-button" title="删除节点" onClick={handleDeleteNode}>
                <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
              </button>
            </div>
            <EditableField
              label="标题"
              testId="graph-inspector-node-title"
              value={node.title}
              onCommit={(value) => commitNodePatch({ title: value })}
            />
            <label className="graph-lab-field">
              <span>章节</span>
              <select
                data-testid="graph-inspector-node-chapter"
                value={node.chapterId}
                onChange={(event) => commitNodePatch({ chapterTitle: event.target.value })}
              >
                {chapterOptions.length === 0 && <option value={node.chapterId}>{node.chapterId || '默认章节'}</option>}
                {chapterOptions.map((chapter) => (
                  <option key={chapter} value={chapter}>{chapter}</option>
                ))}
              </select>
            </label>
            <EditableField
              label="正文"
              testId="graph-inspector-node-body"
              value={node.body}
              multiline
              onCommit={(value) => commitNodePatch({ body: value })}
            />
          </section>

          <section className="graph-lab-section">
            <div className="graph-lab-section__title">
              <h3>选项</h3>
              <button type="button" className="graph-lab-inline-button" data-testid="graph-inspector-add-option" onClick={handleAddOption}>
                <ListPlus aria-hidden="true" size={15} strokeWidth={2} />
                <span>添加</span>
              </button>
            </div>
            {node.options.length === 0 ? (
              <p className="graph-lab-empty">当前节点没有选项，可作为结局节点，也可以添加分支选项。</p>
            ) : (
              <div className="graph-lab-options">
                {node.options.map((option, index) => (
                  <div className="graph-lab-option" key={`${option.lineNumber}-${index}`}>
                    <EditableField
                      label={`选项 ${index + 1}`}
                      testId={`graph-inspector-option-description-${index}`}
                      value={option.description}
                      onCommit={(value) => commitOptionPatch(option, { description: value })}
                    />
                    <label className="graph-lab-field">
                      <span>目标节点</span>
                      <select
                        data-testid={`graph-inspector-option-target-${index}`}
                        value={option.targetNodeId ?? ''}
                        onChange={(event) => commitOptionPatch(option, { targetNodeId: event.target.value || null })}
                      >
                        <option value="">无跳转</option>
                        {allNodes
                          .filter((target) => target.fullId !== node.fullId)
                          .map((target) => (
                            <option key={target.fullId} value={target.id}>{target.title}</option>
                          ))}
                      </select>
                    </label>
                    <EditableField
                      label="条件"
                      testId={`graph-inspector-option-condition-${index}`}
                      value={option.conditionRaw ?? ''}
                      onCommit={(value) => commitOptionPatch(option, { conditionRaw: value || null })}
                    />
                    <EditableField
                      label="效果"
                      testId={`graph-inspector-option-effects-${index}`}
                      value={option.effectsRaw ?? ''}
                      onCommit={(value) => commitOptionPatch(option, { effectsRaw: value || null })}
                    />
                    <div className="graph-lab-option__actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="上移"
                        disabled={index === 0}
                        onClick={() => graphEditService.reorderOption(node, index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title="下移"
                        disabled={index === node.options.length - 1}
                        onClick={() => graphEditService.reorderOption(node, index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title="清除跳转"
                        onClick={() => graphEditService.connectOption(option, null)}
                      >
                        <Link2Off aria-hidden="true" size={14} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        title="删除选项"
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
        <p className="graph-lab-empty">在画布中选择一个节点，或从左侧创建新节点。</p>
      )}

      <section className="graph-lab-section">
        <h3>变量</h3>
        <label className="graph-lab-field">
          <span>变量名</span>
          <input data-testid="graph-inspector-variable-name" value={variableName} onChange={(event) => setVariableName(event.target.value)} placeholder="金币" />
        </label>
        <label className="graph-lab-field">
          <span>变量类型</span>
          <select data-testid="graph-inspector-variable-type" value={variableType} onChange={(event) => setVariableType(event.target.value)}>
            <option value="int">int</option>
            <option value="float">float</option>
            <option value="bool">bool</option>
            <option value="string">string</option>
          </select>
        </label>
        <button type="button" className="graph-lab-inline-button" data-testid="graph-inspector-save-variable" onClick={handleVariableSubmit}>保存变量</button>
      </section>
    </aside>
  );
}
