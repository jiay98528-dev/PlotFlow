/**
 * ExportDialog — 导出对话框组件 (M4)
 *
 * @remarks
 * 提供图形化导出界面，支持三种格式：
 * - JSON（标准格式，符合 json-schema.md）
 * - HTML（自包含可玩版，浏览器直接打开）
 * - TXT（纯文本，剥离 Markdown 标记）
 *
 * 工作流：
 * 1. 用户在对话框中选择导出格式
 * 2. 点击"导出"弹出系统保存对话框，选择保存路径
 * 3. 调用 @plotflow/core 导出器生成内容
 * 4. 通过 Electron IPC 写入文件
 * 5. 显示导出成功/失败状态
 *
 * 快捷键：Ctrl+E 打开
 *
 * 设计依据：
 * - spec/design-brief-editor-ux.md §3.7 导出对话框布局
 * - TAD.md §2.2.2 EditorState / StoryState 接口
 * - CLAUDE.md §6.1 使用 CSS 变量驱动颜色
 *
 * @module components/panels/ExportDialog
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlotFlowData } from '@plotflow/core';
import { exportJSON, exportHTML, exportTXT } from '@plotflow/core';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore, type ExportFormat } from '../../stores/uiStore';

// ============================================================================
// 类型定义
// ============================================================================

/** 导出状态 */
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

// ============================================================================
// 常量
// ============================================================================

/** 格式选项配置 */
interface FormatOption {
  readonly key: ExportFormat;
  /** 显示标签 */
  readonly label: string;
  /** 文件扩展名 */
  readonly extension: string;
  /** 简短描述 */
  readonly description: string;
}

function mimeType(format: ExportFormat): string {
  switch (format) {
    case 'json': return 'application/json';
    case 'html': return 'text/html';
    case 'txt': return 'text/plain';
  }
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  {
    key: 'json',
    label: 'JSON',
    extension: 'json',
    description: '标准结构化数据，适合程序读取',
  },
  {
    key: 'html',
    label: 'HTML',
    extension: 'html',
    description: '自包含可玩版，浏览器直接运行',
  },
  {
    key: 'txt',
    label: 'TXT',
    extension: 'txt',
    description: '纯文本，剥离 Markdown 标记',
  },
] as const;

/** 导出状态映射 */
const STATUS_LABEL: Readonly<Record<ExportStatus, string>> = {
  idle: '导出',
  exporting: '导出中...',
  success: '导出成功',
  error: '导出失败',
};

// ============================================================================
// Component
// ============================================================================

export function ExportDialog(): React.ReactElement | null {
  const isOpen = useUIStore((s) => s.isExportDialogOpen);
  const requestedFormat = useUIStore((s) => s.exportDialogFormat);
  const closeExportDialog = useUIStore((s) => s.closeExportDialog);
  const storyData = useStoryStore((s) => s.plotFlowData);

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // P0-5: 导出成功自动关闭 timer ref（组件卸载时可清理）
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ========================================================================
  // 键盘快捷键：Ctrl+E 打开/关闭导出对话框
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        const store = useUIStore.getState();
        if (store.isExportDialogOpen) {
          store.closeExportDialog();
        } else {
          store.openExportDialog();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ========================================================================
  // 重置状态（格式变化或对话框重新打开时）
  // ========================================================================

  useEffect(() => {
    if (isOpen) {
      setSelectedFormat(requestedFormat);
      setExportStatus('idle');
      setStatusMessage('');
      // P0-5: 对话框重新打开时清除残留的自动关闭 timer
      if (autoCloseTimerRef.current !== undefined) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = undefined;
      }
    }
  }, [isOpen, requestedFormat]);

  // P0-5: 组件卸载时清除自动关闭 timer
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== undefined) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // ========================================================================
  // 计算默认文件名
  // ========================================================================

  const defaultFileName = useMemo(() => {
    const title = storyData?.meta?.title?.trim() || 'story';
    // 清理文件名中的非法字符
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_');
    const ext = FORMAT_OPTIONS.find((f) => f.key === selectedFormat)?.extension ?? 'json';
    return `${safeTitle}.${ext}`;
  }, [storyData, selectedFormat]);

  // ========================================================================
  // 导出处理
  // ========================================================================

  const handleExport = useCallback(async () => {
    if (!storyData) {
      setExportStatus('error');
      setStatusMessage('没有可导出的故事数据。请先打开或创建故事文件。');
      return;
    }

    setExportStatus('exporting');
    setStatusMessage('');

    try {
      // ── 根据格式调用对应的导出器 ──
      const result = exportContent(storyData, selectedFormat);
      if (!result.ok) {
        const errMsg = result.errors[0]?.message ?? '导出失败';
        setExportStatus('error');
        setStatusMessage(errMsg);
        return;
      }

      const content: string = result.data;
      const ext = FORMAT_OPTIONS.find((f) => f.key === selectedFormat)?.extension ?? 'json';
      const filterName = FORMAT_OPTIONS.find((f) => f.key === selectedFormat)?.label ?? 'JSON';

      // ── 调用 Electron 保存对话框（浏览器模式降级为 download）──
      const plotflow = window.plotflow;
      if (!plotflow?.file?.saveExport) {
        // 浏览器预览模式：降级为 Blob 下载
        const blob = new Blob([content], { type: mimeType(selectedFormat) });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = defaultFileName; a.click();
        URL.revokeObjectURL(url);
        setExportStatus('idle');
        closeExportDialog();
        return;
      }
      const saveResult = await plotflow.file.saveExport({
        content,
        defaultPath: defaultFileName,
        filters: [{ name: filterName, extensions: [ext] }],
        format: selectedFormat,
      });

      // 用户取消保存
      if (!saveResult) {
        setExportStatus('idle');
        setStatusMessage('');
        return;
      }

      // ── 导出成功 ──
      const filePath = saveResult.filePath?.replace(/\\/g, '/');
      setExportStatus('success');
      setStatusMessage(`已导出: ${filePath}`);

      // P0-5: 1.5 秒后自动关闭（timer 存入 ref 供清理）
      if (autoCloseTimerRef.current !== undefined) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        autoCloseTimerRef.current = undefined;
        closeExportDialog();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportStatus('error');
      setStatusMessage(`导出异常: ${message}`);
    }
  }, [storyData, selectedFormat, defaultFileName, closeExportDialog]);

  // ========================================================================
  // 点击遮罩层关闭
  // ========================================================================

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeExportDialog();
      }
    },
    [closeExportDialog],
  );

  // ========================================================================
  // 键盘事件：Enter 触发导出，Escape 关闭
  // ========================================================================

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeExportDialog();
      }
    },
    [closeExportDialog],
  );

  // ========================================================================
  // 对话框不打开时返回 null
  // ========================================================================

  if (!isOpen) return null;

  return (
    <div
      className="export-dialog__overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label="导出故事"
    >
      <div className="export-dialog__panel" style={panelStyle}>
        {/* ── 标题栏 ── */}
        <div style={headerStyle}>
          <span style={headerTitleStyle}>导出故事</span>
          <span style={shortcutHintStyle}>Ctrl+E</span>
          <button
            type="button"
            onClick={closeExportDialog}
            title="关闭导出对话框"
            style={closeButtonStyle}
          >
            ✕
          </button>
        </div>

        {/* ── 格式选择 ── */}
        <div style={bodyStyle}>
          <div style={sectionLabelStyle}>导出格式</div>
          <div style={formatGroupStyle}>
            {FORMAT_OPTIONS.map((opt) => {
              const isChecked = selectedFormat === opt.key;
              return (
                <label
                  key={opt.key}
                  className={
                    'export-dialog__format-option' +
                    (isChecked ? ' export-dialog__format-option--active' : '')
                  }
                  style={{
                    ...formatOptionStyle,
                    ...(isChecked ? formatOptionActiveStyle : {}),
                  }}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={opt.key}
                    checked={isChecked}
                    onChange={() => {
                      setSelectedFormat(opt.key);
                      setExportStatus('idle');
                      setStatusMessage('');
                    }}
                    style={radioInputStyle}
                  />
                  <span style={formatLabelStyle}>{opt.label}</span>
                  <span style={formatDescStyle}>{opt.description}</span>
                </label>
              );
            })}
          </div>

          {/* ── 目标文件名 ── */}
          <div style={fileInfoStyle}>
            <span style={fileLabelStyle}>文件名:</span>
            <span style={fileNameStyle}>{defaultFileName}</span>
          </div>

          {/* ── 状态消息 ── */}
          {statusMessage && (
            <div
              style={{
                ...statusStyle,
                color:
                  exportStatus === 'success'
                    ? 'var(--color-success, #2E7D32)'
                    : exportStatus === 'error'
                      ? 'var(--color-error, #C62828)'
                      : 'var(--color-text-muted, #8A8A8A)',
              }}
            >
              {exportStatus === 'error' && <span style={statusIconStyle}>&#x26A0;</span>}
              {exportStatus === 'success' && <span style={statusIconStyle}>&#x2705;</span>}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* ── 故事数据缺失提示 ── */}
          {!storyData && exportStatus === 'idle' && (
            <div style={warningStyle}>
              <span style={statusIconStyle}>&#x26A0;</span>
              <span>暂无故事数据，请先创建或打开一个 .mdstory 文件。</span>
            </div>
          )}
        </div>

        {/* ── 按钮栏 ── */}
        <div style={footerStyle}>
          <button
            type="button"
            onClick={closeExportDialog}
            style={cancelButtonStyle}
            disabled={exportStatus === 'exporting'}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleExport}
            data-testid="export-dialog-submit"
            data-export-status={exportStatus}
            style={{
              ...exportButtonStyle,
              ...(exportStatus === 'exporting' ? exportButtonDisabledStyle : {}),
              ...(exportStatus === 'success' ? exportButtonSuccessStyle : {}),
            }}
            disabled={exportStatus === 'exporting' || !storyData}
          >
            {STATUS_LABEL[exportStatus]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 导出器分发
// ============================================================================

/**
 * 根据格式调用对应的导出器。
 *
 * @param data - PlotFlowData AST
 * @param format - 目标导出格式
 * @returns ParseResult 字符串
 */
function exportContent(
  data: PlotFlowData,
  format: ExportFormat,
): { ok: true; data: string } | { ok: false; errors: ReadonlyArray<{ message: string }> } {
  switch (format) {
    case 'json': {
      const result = exportJSON(data);
      if (result.ok) {
        return { ok: true, data: result.data };
      }
      return { ok: false, errors: result.errors };
    }
    case 'html': {
      const result = exportHTML(data);
      if (result.ok) {
        return { ok: true, data: result.data };
      }
      return { ok: false, errors: result.errors };
    }
    case 'txt': {
      const result = exportTXT(data);
      if (result.ok) {
        return { ok: true, data: result.data };
      }
      return { ok: false, errors: result.errors };
    }
    default:
      return { ok: false, errors: [{ message: `不支持的导出格式: ${format}` }] };
  }
}

// ============================================================================
// Styles
// ============================================================================

// -------- 遮罩层 --------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-overlay-modal, rgba(0,0,0,0.4))',
  zIndex: 1000,
  backdropFilter: 'blur(2px)',
};

// -------- 面板 --------

const panelStyle: React.CSSProperties = {
  width: 480,
  maxWidth: '90vw',
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeIn 0.15s ease',
};

// -------- 标题栏 --------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
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

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--color-text-muted, #8A8A8A)',
  padding: '2px 6px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// -------- 主体内容 --------

const bodyStyle: React.CSSProperties = {
  padding: '16px 16px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-muted, #8A8A8A)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  userSelect: 'none',
};

// -------- 格式选项 --------

const formatGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const formatOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'border-color 0.12s ease, background 0.12s ease',
  userSelect: 'none',
};

const formatOptionActiveStyle: React.CSSProperties = {
  borderColor: 'var(--color-accent, #A0703A)',
  background: 'var(--color-accent-subtle, rgba(160,112,58,0.06))',
};

const radioInputStyle: React.CSSProperties = {
  accentColor: 'var(--color-accent, #A0703A)',
  flexShrink: 0,
};

const formatLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
  minWidth: 48,
};

const formatDescStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
};

// -------- 文件名 --------

const fileInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'var(--color-bg-tertiary, #F0F0F1)',
  borderRadius: 6,
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
};

const fileLabelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #8A8A8A)',
  flexShrink: 0,
};

const fileNameStyle: React.CSSProperties = {
  color: 'var(--color-text-primary, #333333)',
  fontWeight: 500,
  wordBreak: 'break-all',
};

// -------- 状态/警告消息 --------

const statusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: '12px',
  lineHeight: 1.5,
  background: 'var(--color-bg-tertiary, #F0F0F1)',
};

const warningStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'var(--color-warning, #F9A825)',
  background: 'var(--color-bg-tertiary, #F0F0F1)',
};

const statusIconStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '14px',
  lineHeight: '18px',
};

// -------- 底部按钮栏 --------

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
};

const cancelButtonStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-primary, #333333)',
  padding: '6px 16px',
  borderRadius: 6,
  lineHeight: '20px',
  transition: 'background 0.1s ease',
};

const exportButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-accent, #A0703A)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-on-accent, #FFFFFF)',
  padding: '6px 20px',
  borderRadius: 6,
  lineHeight: '20px',
  minWidth: 80,
  transition: 'background 0.12s ease, opacity 0.12s ease',
};

const exportButtonDisabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
};

const exportButtonSuccessStyle: React.CSSProperties = {
  background: 'var(--color-success, #2E7D32)',
};
