import React, { useCallback, useMemo } from 'react';
import { Activity, FileText, GitBranch, PanelBottomClose, PanelBottomOpen } from 'lucide-react';
import { GraphCanvas } from '../branch-graph/GraphCanvas';
import { MonacoEditor } from '../editor/MonacoEditor';
import { GraphLabPalette } from './GraphLabPalette';
import { GraphInspector } from './GraphInspector';
import { SourceDrawer } from './SourceDrawer';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';

function getFileName(path: string | null): string {
  if (!path) return '未保存故事';
  return path.split(/[/\\]/).pop() || path;
}

export function GraphLabWorkspace(): React.ReactElement {
  const isSourceDrawerOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const toggleSourceDrawer = useUIStore((state) => state.toggleSourceDrawer);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);

  const stats = useMemo(() => {
    const chapters = plotFlowData?.chapters.length ?? 0;
    const nodes = plotFlowData?.chapters.reduce((sum, chapter) => sum + chapter.nodes.length, 0) ?? 0;
    const options =
      plotFlowData?.chapters.reduce(
        (sum, chapter) => sum + chapter.nodes.reduce((nodeSum, node) => nodeSum + node.options.length, 0),
        0,
      ) ?? 0;
    return { chapters, nodes, options };
  }, [plotFlowData]);

  const handleNodeNavigate = useCallback((nodeId: string, lineNumber: number) => {
    useGraphStore.getState().selectNode(nodeId);
    const editor = useEditorStore.getState();
    editor.setActiveNodeId(nodeId);
    editor.setCursorPosition(lineNumber, 1);
    const monaco = editor.editorInstance;
    if (monaco) {
      monaco.revealLineInCenter(lineNumber);
      monaco.setPosition({ lineNumber, column: 1 });
      monaco.focus();
    }
  }, []);

  const selectedLabel = selectedNodeId ? selectedNodeId.split('-').slice(1).join('-') || selectedNodeId : '未选择节点';

  return (
    <main className={`graph-lab${isSourceDrawerOpen ? ' graph-lab--source-open' : ''}`} data-testid="graph-lab-workspace">
      <header className="graph-lab__commandbar">
        <div className="graph-lab__commandbar-main">
          <span className="graph-lab__mark" aria-hidden="true">
            <GitBranch size={16} strokeWidth={2.2} />
          </span>
          <div>
            <p className="graph-lab__mode">Graph Lab · 叙事工作台</p>
            <h2>{getFileName(filePath)}</h2>
          </div>
        </div>

        <div className="graph-lab__commandbar-stats" aria-label="当前故事统计">
          <span>{stats.chapters} 章</span>
          <span>{stats.nodes} 节点</span>
          <span>{stats.options} 选项</span>
          <span className={diagnostics.length > 0 ? 'is-warning' : ''}>{diagnostics.length} 诊断</span>
        </div>

        <div className="graph-lab__commandbar-actions">
          <span className="graph-lab__selection" title={selectedLabel}>
            <Activity aria-hidden="true" size={14} strokeWidth={2} />
            {selectedLabel}
          </span>
          <button
            type="button"
            className="graph-lab-dock-toggle"
            data-testid="graph-lab-source-toggle"
            onClick={toggleSourceDrawer}
            aria-expanded={isSourceDrawerOpen}
          >
            <FileText aria-hidden="true" size={15} strokeWidth={2} />
            <span>源文本</span>
            {isSourceDrawerOpen ? (
              <PanelBottomClose aria-hidden="true" size={15} strokeWidth={2} />
            ) : (
              <PanelBottomOpen aria-hidden="true" size={15} strokeWidth={2} />
            )}
          </button>
        </div>
      </header>

      <GraphLabPalette onNodeNavigate={handleNodeNavigate} />
      <section className="graph-lab__canvas" aria-label="Graph Lab canvas">
        <GraphCanvas viewMode="graphLab" />
      </section>
      <GraphInspector />
      <SourceDrawer>
        <div className={isSourceDrawerOpen ? 'source-drawer__editor' : 'source-drawer__editor source-drawer--editor-hidden'}>
          <MonacoEditor />
        </div>
      </SourceDrawer>
    </main>
  );
}
