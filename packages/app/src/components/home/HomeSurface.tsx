import React, { useCallback } from 'react';
import { ExternalLink, FilePlus2, FolderOpen, GitBranch, Palette, Play } from 'lucide-react';
import { useOfficialTheme } from '../../theme/OfficialThemeProvider';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { clearPendingSave, saveOrSaveAs } from '../../services/autoSaveService';
import { parsePipelineNow } from '../../services/parsePipeline';

export function HomeSurface(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isHomeSurfaceOpen);
  const openNewFileDialog = useUIStore((state) => state.openNewFileDialog);
  const openThemeCenter = useUIStore((state) => state.openThemeCenter);
  const setHomeSurfaceOpen = useUIStore((state) => state.setHomeSurfaceOpen);
  const setWorkspaceMode = useUIStore((state) => state.setWorkspaceMode);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const filePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const { activeThemeId, themes } = useOfficialTheme();

  const openFile = useCallback(async () => {
    const editor = useEditorStore.getState();
    if (editor.isDirty) {
      const choice = await window.plotflow.dialog.confirm({
        type: 'warning',
        message: '当前文件有未保存修改',
        detail: '打开其他 .mdstory 文件前是否保存当前修改？',
        buttons: ['保存并打开', '不保存并打开', '取消'],
      });
      if (choice === 0) {
        await saveOrSaveAs();
      } else if (choice === 2) {
        return;
      }
    }

    const { FileService } = await import('../../services/fileService');
    const result = await new FileService().openFile();
    clearPendingSave();
    const freshEditor = useEditorStore.getState();
    freshEditor.setDiagnostics([]);
    freshEditor.setActiveNodeId(null);
    freshEditor.setCursorPosition(1, 1);
    freshEditor.setContent(result.content);
    freshEditor.setFilePath(result.path);
    freshEditor.markSaved();
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
    parsePipelineNow(result.content);
    setHomeSurfaceOpen(false);
    setStatusMessage(`已打开: ${result.path}`);
  }, [setHomeSurfaceOpen, setStatusMessage]);

  if (!isOpen) return null;

  const activeTheme = themes.find((theme) => theme.id === activeThemeId) ?? themes[0]!;
  const ActivePreview = activeTheme.slots.HomePreview;

  return (
    <main className="home-surface" data-testid="home-surface">
      <section className="home-surface__hero">
        <div className="home-surface__copy">
          <p className="home-surface__eyebrow">PlotFlow Official Workbench</p>
          <h2>用流程图和文本双投影编排互动叙事</h2>
          <p>
            从 `.mdstory` 文件进入 Split 或 Graph Lab。故事内容仍是纯文本，官方主题决定工作台的节点、
            线缆、面板和动效表现。
          </p>
          <div className="home-surface__actions">
            <button type="button" className="button button--primary" onClick={() => setHomeSurfaceOpen(false)}>
              <Play aria-hidden="true" size={16} strokeWidth={2} />
              <span>继续编辑</span>
            </button>
            <button type="button" className="button button--secondary" onClick={() => {
              openNewFileDialog();
              setHomeSurfaceOpen(false);
            }}>
              <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
              <span>新建故事</span>
            </button>
            <button type="button" className="button button--secondary" onClick={openFile}>
              <FolderOpen aria-hidden="true" size={16} strokeWidth={2} />
              <span>打开文件</span>
            </button>
          </div>
        </div>
        <div className="home-surface__preview" data-active-official-theme={activeTheme.id}>
          <ActivePreview active />
          <div className="home-surface__current">
            <span>当前官方主题</span>
            <strong>{activeTheme.name['zh-CN']}</strong>
          </div>
        </div>
      </section>

      <section className="home-surface__grid">
        <button
          type="button"
          className="home-action-card"
          data-testid="home-open-graph-lab"
          onClick={() => {
            setWorkspaceMode('graphLab');
            setHomeSurfaceOpen(false);
          }}
        >
          <GitBranch aria-hidden="true" size={20} strokeWidth={2} />
          <span>进入 Graph Lab</span>
          <small>使用节点、线缆和 Inspector 完成图形化编辑。</small>
        </button>
        <button
          type="button"
          className="home-action-card"
          data-testid="home-open-theme-center"
          onClick={openThemeCenter}
        >
          <Palette aria-hidden="true" size={20} strokeWidth={2} />
          <span>主题中心</span>
          <small>切换叙事工作台或夜航蓝图，无需重启。</small>
        </button>
        <button
          type="button"
          className="home-action-card"
          data-testid="home-open-theme-store"
          onClick={() => window.plotflow?.theme?.openOfficialThemeStore?.()}
        >
          <ExternalLink aria-hidden="true" size={20} strokeWidth={2} />
          <span>购买更多官方主题</span>
          <small>首版跳转官网商店，不在应用内处理支付。</small>
        </button>
      </section>

      <section className="home-surface__status">
        <span>{filePath ? `当前文件：${filePath}` : '当前文件：未保存故事'}</span>
        <span>{isDirty ? '存在未保存修改' : '内容已同步'}</span>
      </section>
    </main>
  );
}
