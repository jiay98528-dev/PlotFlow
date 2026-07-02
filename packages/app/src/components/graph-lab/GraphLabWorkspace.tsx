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
import { useThemePlatform } from '../ThemePlatformProvider';
import { useAppText } from '../../i18n/appI18n';

function getFileName(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return path.split(/[/\\]/).pop() || path;
}

export function GraphLabWorkspace(): React.ReactElement {
  const isSourceDrawerOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const toggleSourceDrawer = useUIStore((state) => state.toggleSourceDrawer);
  const setProblemPanelOpen = useUIStore((state) => state.setProblemPanelOpen);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const { activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.GraphLabShell;
  const text = useAppText();

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

  const selectedLabel = selectedNodeId ? selectedNodeId.split('-').slice(1).join('-') || selectedNodeId : text('graphLab.noSelection');

  return (
    <Surface
      isSourceDrawerOpen={isSourceDrawerOpen}
      commandbar={(
        <header className="graph-lab__commandbar">
          <div className="graph-lab__commandbar-main">
            <span className="graph-lab__mark" aria-hidden="true">
              <GitBranch size={16} strokeWidth={2.2} />
            </span>
            <div>
              <p className="graph-lab__mode">{text('graphLab.mode')}</p>
              <h2>{getFileName(filePath, text('graphLab.unsavedStory'))}</h2>
            </div>
          </div>

          <div className="graph-lab__commandbar-stats" aria-label={text('graphLab.statsLabel')}>
            <span>{text('graphLab.chapters', { count: stats.chapters })}</span>
            <span>{text('graphLab.nodes', { count: stats.nodes })}</span>
            <span>{text('graphLab.options', { count: stats.options })}</span>
            <button
              type="button"
              className={diagnostics.length > 0 ? 'is-warning' : ''}
              data-testid="graph-lab-diagnostics-button"
              onClick={() => setProblemPanelOpen(true)}
              aria-label={text('graphLab.openProblems', { count: diagnostics.length })}
            >
              {text('graphLab.diagnostics', { count: diagnostics.length })}
            </button>
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
              <span>{text('graphLab.sourceText')}</span>
              {isSourceDrawerOpen ? (
                <PanelBottomClose aria-hidden="true" size={15} strokeWidth={2} />
              ) : (
                <PanelBottomOpen aria-hidden="true" size={15} strokeWidth={2} />
              )}
            </button>
          </div>
        </header>
      )}
      palette={<GraphLabPalette onNodeNavigate={handleNodeNavigate} />}
      canvas={(
        <section className="graph-lab__canvas" aria-label={text('graphLab.canvasLabel')}>
          <GraphCanvas viewMode="graphLab" />
        </section>
      )}
      inspector={<GraphInspector />}
      sourceDrawer={(
        <SourceDrawer>
          <div className={isSourceDrawerOpen ? 'source-drawer__editor' : 'source-drawer__editor source-drawer--editor-hidden'}>
            <MonacoEditor />
          </div>
        </SourceDrawer>
      )}
    />
  );
}
