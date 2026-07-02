/**
 * ProblemPanel — 问题面板组件 (M3-16)
 *
 * @remarks
 * 展示所有诊断信息（错误/警告/建议），支持按严重级别过滤，
 * 可点击跳转到编辑器对应位置。
 *
 * 快捷键：Ctrl+Shift+M 打开/关闭面板
 *
 * 设计依据：
 * - spec/design-brief-editor-ux.md §3.5 问题面板布局
 * - TAD.md §2.2.2 EditorState / Diagnostic 接口
 * - CLAUDE.md §6.1 使用 CSS 变量驱动颜色
 *
 * @module components/panels/ProblemPanel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Diagnostic, DiagnosticSeverity } from '@plotflow/core';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';

// ============================================================================
// 类型定义
// ============================================================================

/** 严重级别过滤选项 */
type SeverityFilter = 'all' | DiagnosticSeverity;

const EN_DIAGNOSTIC_MESSAGES: Readonly<Record<string, string>> = {
  E001: 'Target node is undefined',
  E002: 'Variable is not declared in Frontmatter',
  E003: 'Value is not in the allowed enum list',
  E004: 'Value type does not match the variable declaration',
  E005: 'Syntax parsing failed',
  E006: 'Object nesting exceeds the maximum depth of 3',
  E007: 'Duplicate node ID',
  E008: 'Duplicate variable declaration',
  W001: 'Node has no incoming option target (orphan node)',
  W002: 'Node has no outgoing options (dead end)',
  W003: 'Variable is not used in the story',
  W004: 'Option text duplicates another option at the same level',
  W005: 'Node body is empty',
  W006: 'Formatting is not standard',
  I001: 'All options have conditions and may block progress',
  I002: 'Node body is too short',
  I003: 'Node is not assigned to any chapter',
};

// ============================================================================
// 常量
// ============================================================================

/** 严重级别 → 图标映射 */
const SEVERITY_ICON: Readonly<Record<DiagnosticSeverity, string>> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
};

/** 诊断严重级别 → 图标颜色（单行 var() 确保 CI 颜色扫描兼容）*/
const SEVERITY_ICON_COLOR: Readonly<Record<DiagnosticSeverity, string>> = {
  error: 'var(--color-diagnostic-error, #D32F2F)',
  warning: 'var(--color-diagnostic-warning, #F9A825)',
  info: 'var(--color-diagnostic-info, #1976D2)',
};

/** 面板最小高度 (px) */
const PANEL_MIN_HEIGHT = 100;

/** 面板默认高度 (px) */
const PANEL_DEFAULT_HEIGHT = 200;

// ============================================================================
// Component
// ============================================================================

export function ProblemPanel(): React.ReactElement {
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const isProblemPanelOpen = useUIStore((s) => s.isProblemPanelOpen);
  const toggleProblemPanel = useUIStore((s) => s.toggleProblemPanel);
  const language = useUIStore((s) => s.language);
  const text = useAppText();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [panelHeight, setPanelHeight] = useState(PANEL_DEFAULT_HEIGHT);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // 计算过滤后的诊断列表 & 各类型计数
  // ========================================================================

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const d of diagnostics) {
      if (d.severity === 'error') errors++;
      else if (d.severity === 'warning') warnings++;
      else infos++;
    }
    return { errors, warnings, infos, total: diagnostics.length };
  }, [diagnostics]);

  const filteredDiagnostics = useMemo(() => {
    if (severityFilter === 'all') return diagnostics;
    return diagnostics.filter((d) => d.severity === severityFilter);
  }, [diagnostics, severityFilter]);

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: text('problemPanel.all') },
      { key: 'error' as const, label: text('problemPanel.errors') },
      { key: 'warning' as const, label: text('problemPanel.warnings') },
      { key: 'info' as const, label: text('problemPanel.infos') },
    ],
    [text],
  );

  // ========================================================================
  // 跳转到编辑器对应行
  // ========================================================================

  const handleJumpToLine = useCallback(
    (diagnostic: Diagnostic) => {
      if (!editorInstance) return;

      const { startLine, startColumn } = diagnostic.range;
      editorInstance.revealPositionInCenter({ lineNumber: startLine, column: startColumn });
      editorInstance.setPosition({ lineNumber: startLine, column: startColumn });
      editorInstance.focus();
    },
    [editorInstance],
  );

  // ========================================================================
  // 切换过滤条件
  // ========================================================================

  const handleFilterChange = useCallback((filter: SeverityFilter) => {
    setSeverityFilter(filter);
  }, []);

  // ========================================================================
  // 键盘快捷键：Ctrl+Shift+M 打开/关闭面板
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        e.stopPropagation();
        toggleProblemPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleProblemPanel]);

  // ========================================================================
  // 拖拽调整面板高度
  // ========================================================================

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const startY = e.clientY;
      const startHeight = panelHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(PANEL_MIN_HEIGHT, startHeight + delta);
        setPanelHeight(newHeight);
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
    [panelHeight],
  );

  // 卸载时清理 resize 相关监听（安全兜底）
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
  // 面板关闭时不渲染内容（保持键盘监听生效）
  // ========================================================================

  return (
    <div
      ref={panelRef}
      className="problem-panel"
      style={{
        ...panelContainerStyle,
        height: isProblemPanelOpen ? panelHeight : 0,
        borderTopWidth: isProblemPanelOpen ? 1 : 0,
        overflow: isProblemPanelOpen ? 'hidden' : 'hidden',
      }}
    >
      {isProblemPanelOpen && (
        <>
          {/* ================================================================
          拖拽调整高度的把手
          ================================================================ */}
          <div
            className="problem-panel__resize-handle"
            onMouseDown={handleResizeStart}
            style={resizeHandleStyle}
          />

          {/* ================================================================
          标题栏
          ================================================================ */}
          <div style={headerStyle}>
            <span style={headerTitleStyle}>{text('problemPanel.title')}</span>
            <span style={shortcutHintStyle}>{text('problemPanel.shortcut')}</span>
            <div style={headerActionsStyle}>
              <button
                type="button"
                onClick={toggleProblemPanel}
                title={text('problemPanel.close')}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ================================================================
          过滤栏
          ================================================================ */}
          <div style={filterBarStyle}>
            {filterOptions.map((opt) => {
              const count =
                opt.key === 'all'
                  ? counts.total
                  : opt.key === 'error'
                    ? counts.errors
                    : opt.key === 'warning'
                      ? counts.warnings
                      : counts.infos;

              const isActive = severityFilter === opt.key;

              return (
                <button
                  key={opt.key}
                  type="button"
                  className={
                    'problem-panel__filter-btn' +
                    (isActive ? ' problem-panel__filter-btn--active' : '')
                  }
                  onClick={() => handleFilterChange(opt.key)}
                  style={{
                    ...filterBtnStyle,
                    ...(isActive ? activeFilterBtnStyle : {}),
                  }}
                >
                  {opt.label}&nbsp;{count}
                </button>
              );
            })}
          </div>

          {/* ================================================================
          诊断列表
          ================================================================ */}
          <div style={listContainerStyle}>
            {filteredDiagnostics.length === 0 ? (
              /* ---- 空状态 ---- */
              <div style={emptyStyle}>
                <span style={emptyIconStyle}>&#x2705;</span>
                <span>{text('problemPanel.empty')}</span>
              </div>
            ) : (
              /* ---- 诊断条目 ---- */
              filteredDiagnostics.map((diagnostic) => {
                const icon = SEVERITY_ICON[diagnostic.severity];
                const message =
                  language === 'en-US'
                    ? EN_DIAGNOSTIC_MESSAGES[diagnostic.code] ?? diagnostic.message
                    : diagnostic.message;
                const location = text('problemPanel.location', {
                  line: diagnostic.range.startLine,
                  column: diagnostic.range.startColumn,
                });

                return (
                  <div
                    key={diagnostic.id}
                    className="problem-panel__item"
                    onClick={() => handleJumpToLine(diagnostic)}
                    title={
                      text('problemPanel.jump', { line: diagnostic.range.startLine }) +
                      (diagnostic.detail ? `\n${diagnostic.detail}` : '')
                    }
                    style={itemStyle}
                  >
                    {/* 严重级别图标 */}
                    <span
                      style={{
                        ...severityIconStyle,
                        color: SEVERITY_ICON_COLOR[diagnostic.severity],
                      }}
                    >
                      {icon}
                    </span>

                    {/* 诊断代码 */}
                    <span style={codeBadgeStyle}>{diagnostic.code}</span>

                    {/* 消息文本 */}
                    <span style={messageStyle} title={message}>
                      {message}
                    </span>

                    {/* 文件位置 */}
                    <span style={locationStyle}>{location}</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

// -------- 面板容器 --------

const panelContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minHeight: 0,
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
  position: 'relative',
  transition: 'height 0.15s ease',
  flexShrink: 0,
};

// -------- 拖拽把手 --------

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  left: 0,
  right: 0,
  height: 8,
  cursor: 'row-resize',
  zIndex: 10,
};

// -------- 标题栏 --------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
  flexShrink: 0,
  userSelect: 'none',
};

const headerTitleStyle: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const shortcutHintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted, #8A8A8A)',
  marginRight: 'auto',
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
  padding: '2px 6px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// -------- 过滤栏 --------

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '6px 12px',
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
  flexShrink: 0,
};

const filterBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-bg-tertiary, #E8E8EA)',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-secondary, #5A5A5A)',
  padding: '2px 10px',
  borderRadius: 4,
  lineHeight: '22px',
  transition: 'background 0.1s ease, color 0.1s ease',
};

const activeFilterBtnStyle: React.CSSProperties = {
  background: 'var(--color-accent-subtle, rgba(160,112,58,0.10))',
  color: 'var(--color-accent, #A0703A)',
  fontWeight: 600,
};

// -------- 诊断列表 --------

const listContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '2px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 12px',
  fontSize: '12px',
  lineHeight: 1.5,
  cursor: 'pointer',
  color: 'var(--color-text-primary, #333333)',
  transition: 'background 0.08s ease',
  userSelect: 'none',
};

const severityIconStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '12px',
  lineHeight: 1,
  width: 16,
  textAlign: 'center',
};

const codeBadgeStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '10px',
  lineHeight: '16px',
  fontWeight: 600,
  padding: '0 5px',
  borderRadius: 3,
  background: 'var(--color-bg-tertiary, #E8E8EA)',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  minWidth: 34,
  textAlign: 'center',
};

const messageStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--color-text-primary, #333333)',
};

const locationStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  whiteSpace: 'nowrap',
  marginLeft: 'auto',
};

// -------- 空状态 --------

const emptyStyle: React.CSSProperties = {
  padding: '24px 16px',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  lineHeight: 1.5,
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: '16px',
};
