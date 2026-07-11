/**
 * 大纲视图面板组件 (M1-14)
 *
 * @remarks
 * 树形展示 章节 → 节点 的层级结构。
 * 面板宽度 200px 默认，可拖拽右边缘调整。
 * 支持折叠展开，当前节点高亮，点击跳转编辑器行。
 *
 * 设计依据：
 * - spec/design-brief-editor-ux.md §2.1 左侧边栏布局
 * - TAD.md §2.2.2 StoryState / EditorState 接口
 * - CLAUDE.md §6.1 使用 CSS 变量驱动颜色
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStoryStore } from '../../stores/storyStore';
import { useEditorStore } from '../../stores/editorStore';
import { useAppText } from '../../i18n/appI18n';

// ============================================================================
// 常量
// ============================================================================

/** 面板最小宽度 (px) */
const PANEL_MIN_WIDTH = 150;

/** 面板最大宽度 (px) */
const PANEL_MAX_WIDTH = 450;

/** 面板默认宽度 (px) */
const PANEL_DEFAULT_WIDTH = 200;

/** 折叠后宽度 (px) */
const PANEL_COLLAPSED_WIDTH = 32;

/** 标题截断长度 */
const TITLE_MAX_LENGTH = 30;

// ============================================================================
// Props
// ============================================================================

export interface OutlinePanelProps {
  /** 点击节点时的回调：跳转到编辑器对应行 */
  readonly onNodeClick: (nodeId: string, lineNumber: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function OutlinePanel({ onNodeClick }: OutlinePanelProps): React.ReactElement {
  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const activeNodeId = useEditorStore((s) => s.activeNodeId);
  const text = useAppText();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const isResizing = useRef(false);

  // ---------- 节点点击 ----------

  const handleNodeClick = useCallback(
    (nodeId: string, lineNumber: number) => {
      onNodeClick(nodeId, lineNumber);
    },
    [onNodeClick],
  );

  // ---------- 折叠/展开 ----------

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // ---------- 拖拽调整宽度 ----------

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = Math.max(
          PANEL_MIN_WIDTH,
          Math.min(PANEL_MAX_WIDTH, moveEvent.clientX),
        );
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [],
  );

  // 卸载时清理 resize 事件（安全兜底）
  useEffect(() => {
    return () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  // ========================================================================
  // 折叠态：仅显示一个窄条 + 展开按钮
  // ========================================================================

  if (isCollapsed) {
    return (
      <div
        className="outline-panel outline-panel--collapsed"
        style={collapsedPanelStyle}
      >
        <span style={collapsedTitleStyle}>{text('outline.title')}</span>
        <button
          type="button"
          onClick={handleToggleCollapse}
          title={text('outline.expand')}
          style={collapseButtonStyle}
        >
          ▶
        </button>
      </div>
    );
  }

  // ========================================================================
  // 展开态
  // ========================================================================

  const hasData =
    plotFlowData !== null &&
    plotFlowData.chapters.length > 0 &&
    plotFlowData.chapters.some((ch) => ch.nodes.length > 0);

  return (
    <div
      className="outline-panel"
      style={{ ...panelStyle, width: panelWidth }}
    >
      {/* ---- 标题栏 ---- */}
      <div style={headerStyle}>
        <span style={headerTitleStyle}>{text('outline.title')}</span>
        <button
          type="button"
          onClick={handleToggleCollapse}
          title={text('outline.collapse')}
          style={collapseButtonStyle}
        >
          ◀
        </button>
      </div>

      {/* ---- 树形列表 ---- */}
      <div style={treeStyle}>
        {hasData ? (
          plotFlowData!.chapters.map((chapter) => {
            // 过滤掉无节点的章节
            if (chapter.nodes.length === 0) return null;

            return (
              <div key={chapter.id} style={chapterGroupStyle}>
                {/* 非匿名章节才显示章节标题 */}
                {!chapter.isAnonymous && (
                  <div style={chapterStyle} title={chapter.title}>
                    {chapter.title}
                  </div>
                )}
                {/* 节点列表 */}
                {chapter.nodes.map((node) => {
                  const truncatedTitle =
                    node.title.length > TITLE_MAX_LENGTH
                      ? node.title.slice(0, TITLE_MAX_LENGTH) + '...'
                      : node.title;

                  const isActive = activeNodeId === node.fullId;

                  return (
                    <div
                      key={node.fullId}
                      className={
                        'outline-node' +
                        (isActive ? ' outline-node--active' : '')
                      }
                      onClick={() => handleNodeClick(node.fullId, node.lineNumber)}
                      title={text('outline.nodeLocation', { title: node.title, line: node.lineNumber })}
                      style={{
                        ...nodeStyle,
                        ...(isActive ? activeNodeStyle : {}),
                      }}
                    >
                      <span style={nodeTitleStyle}>{truncatedTitle}</span>
                      {node.options.length > 0 && (
                        <span
                          style={badgeStyle}
                          title={text('outline.optionCount', { count: node.options.length })}
                        >
                          {node.options.length}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          /* ---- 空状态 ---- */
          <div style={emptyStyle}>
            <span style={emptyIconStyle}>📄</span>
            <span>{text('outline.empty')}</span>
          </div>
        )}
      </div>

      {/* ---- 拖拽调整宽度的把手 ---- */}
      <div
        className="outline-panel__resize-handle"
        onMouseDown={handleResizeStart}
        style={resizeHandleStyle}
      />
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

// -------- 面板容器 --------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  position: 'relative',
  background: 'var(--color-bg-secondary)',
  borderRight: '1px solid var(--color-border-default)',
  minWidth: PANEL_MIN_WIDTH,
  overflow: 'hidden',
};

const collapsedPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  width: PANEL_COLLAPSED_WIDTH,
  minWidth: PANEL_COLLAPSED_WIDTH,
  height: '100%',
  padding: '8px 0',
  background: 'var(--color-bg-secondary)',
  borderRight: '1px solid var(--color-border-default)',
};

const collapsedTitleStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  letterSpacing: 2,
  userSelect: 'none',
};

// -------- 标题栏 --------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border-default)',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  userSelect: 'none',
};

const collapseButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  padding: '2px 4px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// -------- 树形列表 --------

const treeStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '4px 0',
};

const chapterGroupStyle: React.CSSProperties = {
  marginBottom: 2,
};

const chapterStyle: React.CSSProperties = {
  padding: '6px 12px 2px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const nodeStyle: React.CSSProperties = {
  padding: '4px 12px 4px 20px',
  fontSize: '13px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: 'var(--color-text-primary)',
  borderRadius: 0,
  transition: 'background 0.1s ease',
};

const activeNodeStyle: React.CSSProperties = {
  background: 'var(--color-accent-subtle)',
  borderLeft: '2px solid var(--color-accent)',
  paddingLeft: 18, // 20 - 2 (borderLeft 占位)
};

const nodeTitleStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
};

const badgeStyle: React.CSSProperties = {
  fontSize: '10px',
  lineHeight: '16px',
  padding: '0 6px',
  borderRadius: 8,
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
  marginLeft: 8,
  fontWeight: 500,
  minWidth: 16,
  textAlign: 'center',
};

// -------- 拖拽把手 --------

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 5,
  height: '100%',
  cursor: 'col-resize',
  zIndex: 'var(--z-panel)',
};

// -------- 空状态 --------

const emptyStyle: React.CSSProperties = {
  padding: '24px 16px',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  lineHeight: 1.5,
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: '24px',
  opacity: 0.5,
};
