/**
 * 状态栏组件 (M1-16)
 *
 * @remarks
 * 底部状态栏，三个区域（左中右）：
 * - 左侧：保存状态图标 + 文件路径（截断）
 * - 中间：节点数 / 选项数 / 错误计数
 * - 右侧：光标位置 (行:列) + 缩放比例
 *
 * 从多个 store 读取状态，纯展示无交互。
 */

import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';

function formatStatusMessage(message: string): string {
  if (message.startsWith('save:')) return message.slice('save:'.length);
  if (message.startsWith('parse:')) return message.slice('parse:'.length);
  return message;
}

export function StatusBar(): React.ReactElement {
  // --- editorStore ---
  const isDirty = useEditorStore((s) => s.isDirty);
  const filePath = useEditorStore((s) => s.filePath);
  const cursorPosition = useEditorStore((s) => s.cursorPosition);
  const diagnostics = useEditorStore((s) => s.diagnostics);

  // --- storyStore ---
  const plotFlowData = useStoryStore((s) => s.plotFlowData);

  // --- graphStore ---
  const zoomLevel = useGraphStore((s) => s.zoomLevel);

  // --- uiStore ---
  const statusMessage = useUIStore((s) => s.statusMessage);
  const text = useAppText();

  // ==========================================================================
  // Derived state
  // ==========================================================================

  /* 节点总数 */
  const nodeCount = plotFlowData?.chapters.reduce(
    (sum, ch) => sum + ch.nodes.length,
    0,
  ) ?? 0;

  /* 选项总数 */
  const optionCount = plotFlowData?.chapters.reduce(
    (sum, ch) => sum + ch.nodes.reduce((s, n) => s + n.options.length, 0),
    0,
  ) ?? 0;

  /* 三级诊断计数 */
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const infos = diagnostics.filter((d) => d.severity === 'info').length;

  /* 保存状态图标 */
  const saveIcon = isDirty ? '⏳' : '✅';

  /* 文件路径（截取末两段） */
  const displayPath = filePath
    ? filePath.split(/[/\\]/).slice(-2).join('/')
    : text('statusBar.unsaved');

  /* 缩放比例（百分比显示） */
  const zoomPercent = `${Math.round(zoomLevel * 100)}%`;
  const visibleStatusMessage = statusMessage ? formatStatusMessage(statusMessage) : '';

  return (
    <div className="status-bar" style={barStyle}>
      {/* -------- 左侧：保存状态 + 文件路径 -------- */}
      <span style={sectionStyle}>
        <span style={{ flexShrink: 0 }}>{saveIcon}</span>
        <span style={pathTruncateStyle} title={filePath ?? undefined}>
          {displayPath}
        </span>
      </span>

      {/* -------- 中间：节点 / 选项 / 诊断计数 -------- */}
      <span style={centerSectionStyle}>
        <span>{text('statusBar.nodes', { count: nodeCount })}</span>
        <span style={separatorStyle}>/</span>
        <span>{text('statusBar.options', { count: optionCount })}</span>
        <span style={separatorStyle}>|</span>
        {errors > 0 && <span style={errorStyle}>🔴{errors}</span>}
        {warnings > 0 && <span style={warnStyle}>🟡{warnings}</span>}
        {infos > 0 && <span style={infoStyle}>🔵{infos}</span>}
        {errors === 0 && warnings === 0 && infos === 0 && (
          <span style={{ color: 'var(--color-success)' }}>✅0</span>
        )}
      </span>

      {/* -------- 右侧：光标位置 + 缩放比例 -------- */}
      <span style={sectionStyle}>
        <span>
          {text('statusBar.lineColumn', { line: cursorPosition.line, column: cursorPosition.column })}
        </span>
        <span style={separatorStyle}>{'  '}</span>
        <span>{zoomPercent}</span>
        {visibleStatusMessage && (
          <>
            <span style={{ flex: 1, minWidth: 8 }} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 300,
            }}>
              {visibleStatusMessage}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  height: 24,
  fontSize: 12,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-muted)',
  background: 'var(--color-bg-secondary)',
  borderTop: '1px solid var(--color-border-default)',
  userSelect: 'none',
  minWidth: 0,
};

/** 普通区域：左/右侧 */
const sectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
};

/** 中间区域：居中布局 */
const centerSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
};

/** 文件路径截断 */
const pathTruncateStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 240,
  direction: 'rtl',
  textAlign: 'left',
};

/** 分隔符 */
const separatorStyle: React.CSSProperties = {
  color: 'var(--color-border-default)',
};

const errorStyle: React.CSSProperties = { color: 'var(--color-diagnostic-error)' };
const warnStyle: React.CSSProperties = { color: 'var(--color-diagnostic-warning)' };
const infoStyle: React.CSSProperties = { color: 'var(--color-diagnostic-info)' };
