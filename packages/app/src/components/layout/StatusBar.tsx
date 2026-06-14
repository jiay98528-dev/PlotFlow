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
    : '未保存';

  /* 缩放比例（百分比显示） */
  const zoomPercent = `${Math.round(zoomLevel * 100)}%`;

  return (
    <div style={barStyle}>
      {/* -------- 左侧：保存状态 + 文件路径 -------- */}
      <span style={sectionStyle}>
        <span style={{ flexShrink: 0 }}>{saveIcon}</span>
        <span style={pathTruncateStyle} title={filePath ?? undefined}>
          {displayPath}
        </span>
      </span>

      {/* -------- 中间：节点 / 选项 / 诊断计数 -------- */}
      <span style={centerSectionStyle}>
        <span>节点 {nodeCount}</span>
        <span style={separatorStyle}>/</span>
        <span>选项 {optionCount}</span>
        <span style={separatorStyle}>|</span>
        {errors > 0 && <span style={errorStyle}>🔴{errors}</span>}
        {warnings > 0 && <span style={warnStyle}>🟡{warnings}</span>}
        {infos > 0 && <span style={infoStyle}>🔵{infos}</span>}
        {errors === 0 && warnings === 0 && infos === 0 && (
          <span style={{ color: 'var(--color-success, #2E7D32)' }}>✅0</span>
        )}
      </span>

      {/* -------- 右侧：光标位置 + 缩放比例 -------- */}
      <span style={sectionStyle}>
        <span>
          行 {cursorPosition.line}:{cursorPosition.column}
        </span>
        <span style={separatorStyle}>{'  '}</span>
        <span>{zoomPercent}</span>
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
  color: 'var(--color-text-muted, #8A8A8A)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
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
  color: 'var(--color-border-default, #E0E0E0)',
};

const errorStyle: React.CSSProperties = { color: 'var(--color-diagnostic-error, #D32F2F)' };
const warnStyle: React.CSSProperties = { color: 'var(--color-diagnostic-warning, #F9A825)' };
const infoStyle: React.CSSProperties = { color: 'var(--color-diagnostic-info, #1976D2)' };
