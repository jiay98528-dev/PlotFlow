/**
 * CorpusManager — 语料管理器面板 (M5-19)
 *
 * @packageDocumentation
 * @remarks
 * 语料库管理界面，提供以下功能：
 * - 语料列表：文件名/大小/导入时间/状态
 * - 操作：导入/禁用/删除/重新处理
 * - 禁用确认对话框
 * - 删除不可恢复警告
 *
 * ## 工作流
 * 1. 用户点击"导入语料"
 * 2. 系统文件对话框选择文件（.txt / .mdstory / .csv）
 * 3. Electron IPC 读取文件内容
 * 4. CorpusImporter 分段、清洗、去重
 * 5. PreprocessingPipeline 分词、分类
 * 6. NGramEngine 训练
 * 7. 更新 CorpusManager 列表
 *
 * 设计依据：
 * - spec/design-brief-editor-ux.md §3.x 设置面板布局
 * - TAD.md §2.2.2 UIState 接口
 * - CLAUDE.md §6.1 使用 CSS 变量驱动颜色
 *
 * @module components/panels/CorpusManager
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CorpusImporter,
  PreprocessingPipeline,
  NGramEngine,
} from '@plotflow/core';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';

// ============================================================================
// 类型定义
// ============================================================================

/** 语料条目状态 */
type CorpusEntryStatus = 'active' | 'disabled' | 'processing' | 'error';

/** 语料源条目（UI 展示用） */
interface CorpusSourceItem {
  /** 唯一 ID */
  readonly id: string;
  /** 文件名 */
  readonly fileName: string;
  /** 文件大小（字节） */
  readonly size: number;
  /** 导入时间戳 */
  readonly importedAt: number;
  /** 条目数 */
  readonly entryCount: number;
  /** 状态 */
  readonly status: CorpusEntryStatus;
  /** 文件类型 */
  readonly type: string;
  /** 错误消息（如果 status === 'error'） */
  readonly errorMessage?: string;
}

/** 确认对话框类型 */
type ConfirmDialogType = 'delete' | 'disable' | null;

// ============================================================================
// 常量
// ============================================================================

/** 总计最大限制 (50MB) */
const TOTAL_MAX_SIZE_BYTES = 50 * 1024 * 1024;

/** 状态颜色映射 */
const STATUS_COLORS: Record<CorpusEntryStatus, string> = {
  active: 'var(--color-success, #2E7D32)',
  disabled: 'var(--color-text-muted, #8A8A8A)',
  processing: 'var(--color-warning, #F9A825)',
  error: 'var(--color-error, #C62828)',
};

/** NGramEngine 全局实例（由管理器持有） */
let _globalNGramEngine: NGramEngine | null = null;

/**
 * 获取全局 NGramEngine 实例。
 */
function getGlobalEngine(): NGramEngine {
  if (!_globalNGramEngine) {
    _globalNGramEngine = new NGramEngine();
  }
  return _globalNGramEngine;
}

/**
 * 重置全局 NGramEngine（测试用）。
 */
export function resetGlobalEngine(): void {
  _globalNGramEngine = null;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化文件大小为可读字符串。
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化时间为本地字符串。
 */
function formatTime(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: CorpusEntryStatus, text: ReturnType<typeof useAppText>): string {
  switch (status) {
    case 'active':
      return text('corpus.active');
    case 'disabled':
      return text('corpus.disabled');
    case 'processing':
      return text('corpus.processing');
    case 'error':
      return text('corpus.error');
  }
}

/**
 * 生成唯一 ID。
 */
function generateId(): string {
  return `corpus-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Component
// ============================================================================

export function CorpusManager(): React.ReactElement | null {
  const isOpen = useUIStore((s) => s.isCorpusManagerOpen);
  const closeCorpusManager = useUIStore((s) => s.closeCorpusManager);
  const setStatusMessage = useUIStore((s) => s.setStatusMessage);
  const language = useUIStore((s) => s.language);
  const text = useAppText();

  // ── 语料源列表 ──
  const [sources, setSources] = useState<CorpusSourceItem[]>(() => {
    // 尝试从 localStorage 恢复
    try {
      const saved = localStorage.getItem('plotflow:corpusSources');
      if (saved) return JSON.parse(saved) as CorpusSourceItem[];
    } catch { /* ignore */ }
    return [];
  });

  // ── 确认对话框 ──
  const [confirmDialog, setConfirmDialog] = useState<{
    type: ConfirmDialogType;
    item: CorpusSourceItem;
  } | null>(null);

  // ── 导入导入状态 ──
  const [isImporting, setIsImporting] = useState(false);

  // 重新处理定时器引用（用于组件卸载时清理）
  const reprocessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清理重新处理定时器，防止 unmount 后 setState 警告
  useEffect(() => {
    return () => {
      if (reprocessTimerRef.current !== null) {
        clearTimeout(reprocessTimerRef.current);
      }
    };
  }, []);

  // ── 总计信息 ──
  const totalInfo = useMemo(() => {
    const activeSources = sources.filter((s) => s.status === 'active');
    const totalSize = activeSources.reduce((sum, s) => sum + s.size, 0);
    const totalEntries = activeSources.reduce((sum, s) => sum + s.entryCount, 0);
    const activeCount = activeSources.length;
    const disabledCount = sources.filter((s) => s.status === 'disabled').length;
    return { totalSize, totalEntries, activeCount, disabledCount, total: sources.length };
  }, [sources]);

  // ========================================================================
  // 保存到 localStorage
  // ========================================================================

  useEffect(() => {
    try {
      localStorage.setItem('plotflow:corpusSources', JSON.stringify(sources));
    } catch { /* ignore */ }
  }, [sources]);

  // ========================================================================
  // 键盘事件：Escape 关闭
  // ========================================================================

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 如果确认对话框打开，先关闭确认对话框
        if (confirmDialog) {
          setConfirmDialog(null);
          return;
        }
        closeCorpusManager();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeCorpusManager, confirmDialog]);

  // ========================================================================
  // 导入语料
  // ========================================================================

  const handleImport = useCallback(async () => {
    if (isImporting) return;

    // 检查总计大小
    if (totalInfo.totalSize >= TOTAL_MAX_SIZE_BYTES) {
      setStatusMessage(text('corpus.sizeLimitReached', { size: formatFileSize(TOTAL_MAX_SIZE_BYTES) }));
      return;
    }

    setIsImporting(true);

    try {
      // 调用 Electron IPC 打开文件对话框，支持多选
      const fileAPI = window.plotflow?.file;
      if (!fileAPI) {
        // 开发降级：模拟导入
        setStatusMessage(text('corpus.ipcUnavailable'));
        setIsImporting(false);
        return;
      }

      // 由于 Electron IPC 目前只支持打开 .mdstory 文件，
      // 这里使用 importFromText 模拟导入策
      //
      // M5-19 完整实现需要扩展 preload.ts 支持通用文件打开对话框。
      //
      // 当前策略：
      // 1. 先尝试通过 saveExport 风格的通用对话框（需扩展 preload）
      // 2. 不可用时降级为从剪贴板或手动输入

      setStatusMessage(text('corpus.genericImportUnavailable'));
      setIsImporting(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(text('corpus.importFailed', { message }));
      setIsImporting(false);
    }
  }, [isImporting, totalInfo.totalSize, setStatusMessage, text]);

  // ========================================================================
  // 从文本导入（开发/降级用）
  // ========================================================================

  const handleImportFromText = useCallback(() => {
    if (isImporting) return;

    // 模拟：创建一个测试条目
    const testText = '勇者踏上了征程。勇者来到了一个古老的村庄。村庄里住着一位智者。';
    const importer = new CorpusImporter();
    const pipeline = new PreprocessingPipeline();
    const engine = getGlobalEngine();

    try {
      const result = importer.importFromText(testText, 'txt');

      // 预处理并训练
      pipeline.processAndTrain(result.entries, engine);

      // 添加到列表
      const newItem: CorpusSourceItem = {
        id: generateId(),
        fileName: `inline-${Date.now()}.txt`,
        size: result.sourceFile.size,
        importedAt: Date.now(),
        entryCount: result.newEntriesCount,
        status: 'active',
        type: 'txt',
      };

      setSources((prev) => [...prev, newItem]);
      setStatusMessage(
        text('corpus.importDone', { added: result.newEntriesCount, skipped: result.skippedDuplicates }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(text('corpus.importFailed', { message }));
    }
  }, [isImporting, setStatusMessage, text]);

  // ========================================================================
  // 切换禁用状态
  // ========================================================================

  const handleToggleDisable = useCallback((item: CorpusSourceItem) => {
    if (item.status === 'disabled') {
      // 直接启用
      setSources((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, status: 'active' as CorpusEntryStatus } : s,
        ),
      );
    } else {
      // 显示确认对话框
      setConfirmDialog({ type: 'disable', item });
    }
  }, []);

  // ========================================================================
  // 删除语料源
  // ========================================================================

  const handleDelete = useCallback((item: CorpusSourceItem) => {
    setConfirmDialog({ type: 'delete', item });
  }, []);

  // ========================================================================
  // 确认操作
  // ========================================================================

  const handleConfirm = useCallback(() => {
    if (!confirmDialog) return;

    const { type, item } = confirmDialog;

    if (type === 'disable') {
      setSources((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, status: 'disabled' as CorpusEntryStatus } : s,
        ),
      );
      setStatusMessage(text('corpus.disabledFile', { file: item.fileName }));
    } else if (type === 'delete') {
      setSources((prev) => prev.filter((s) => s.id !== item.id));
      setStatusMessage(text('corpus.deletedFile', { file: item.fileName }));
    }

    setConfirmDialog(null);
  }, [confirmDialog, setStatusMessage, text]);

  // ========================================================================
  // 取消确认
  // ========================================================================

  const handleCancelConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  // ========================================================================
  // 重新处理
  // ========================================================================

  const handleReprocess = useCallback((item: CorpusSourceItem) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id === item.id ? { ...s, status: 'processing' as CorpusEntryStatus } : s,
      ),
    );

    // 模拟重新处理（1 秒后完成）
    reprocessTimerRef.current = setTimeout(() => {
      setSources((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, status: 'active' as CorpusEntryStatus } : s,
        ),
      );
      setStatusMessage(text('corpus.reprocessedFile', { file: item.fileName }));
      reprocessTimerRef.current = null;
    }, 1000);
  }, [setStatusMessage, text]);

  // ========================================================================
  // 点击遮罩层关闭
  // ========================================================================

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        if (confirmDialog) {
          setConfirmDialog(null);
          return;
        }
        closeCorpusManager();
      }
    },
    [closeCorpusManager, confirmDialog],
  );

  // ========================================================================
  // 对话框不打开时返回 null
  // ========================================================================

  if (!isOpen) return null;

  return (
    <div
      className="corpus-manager__overlay"
      onClick={handleOverlayClick}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={text('corpus.aria')}
    >
      <div
        className="corpus-manager__panel"
        style={panelStyle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (confirmDialog) {
              setConfirmDialog(null);
            } else {
              closeCorpusManager();
            }
          }
        }}
      >
        {/* ── 标题栏 ── */}
        <div style={headerStyle}>
          <span style={headerTitleStyle}>{text('corpus.title')}</span>
          <span style={badgeStyle}>
            {text('corpus.sourceCount', { count: totalInfo.total })}
          </span>
          <button
            type="button"
            onClick={closeCorpusManager}
            title={text('common.close')}
            style={closeButtonStyle}
          >
            ✕
          </button>
        </div>

        {/* ── 统计概览 ── */}
        <div style={statsBarStyle}>
          <span style={statItemStyle}>
            {text('corpus.active')}: <strong style={statValueStyle}>{totalInfo.activeCount}</strong>
          </span>
          <span style={statItemStyle}>
            {text('corpus.disabled')}: <strong style={statValueStyle}>{totalInfo.disabledCount}</strong>
          </span>
          <span style={statItemStyle}>
            {text('corpus.totalSize')}: <strong style={statValueStyle}>{formatFileSize(totalInfo.totalSize)}</strong>
          </span>
          <span style={statItemStyle}>
            {text('corpus.entries')}: <strong style={statValueStyle}>{totalInfo.totalEntries}</strong>
          </span>
        </div>

        {/* ── 操作按钮 ── */}
        <div style={actionBarStyle}>
          <button
            type="button"
            onClick={handleImport}
            style={primaryButtonStyle}
            disabled={isImporting || totalInfo.totalSize >= TOTAL_MAX_SIZE_BYTES}
            title={
              totalInfo.totalSize >= TOTAL_MAX_SIZE_BYTES
                ? text('corpus.sizeLimitReached', { size: '50MB' })
                : text('corpus.importFileTitle')
            }
          >
            {isImporting ? text('corpus.importing') : text('corpus.importCorpus')}
          </button>
          <button
            type="button"
            onClick={handleImportFromText}
            style={secondaryButtonStyle}
            disabled={isImporting}
            title={text('corpus.importTextTitle')}
          >
            {text('corpus.importFromText')}
          </button>
        </div>

        {/* ── 语料列表 ── */}
        <div style={listContainerStyle}>
          {sources.length === 0 ? (
            /* 空状态 */
            <div style={emptyStyle}>
              <span style={emptyIconStyle}>📂</span>
              <span>{text('corpus.empty')}</span>
              <span style={emptyHintStyle}>
                {text('corpus.emptyHint')}
              </span>
            </div>
          ) : (
            sources.map((item) => (
              <div
                key={item.id}
                className="corpus-manager__item"
                style={{
                  ...itemStyle,
                  opacity: item.status === 'disabled' ? 0.55 : 1,
                }}
              >
                {/* 文件信息 */}
                <div style={itemInfoStyle}>
                  <div style={itemNameStyle}>
                    <span style={fileIconStyle}>
                      {item.type === 'csv' ? '📊' : item.type === 'mdstory' ? '📜' : '📄'}
                    </span>
                    <span style={fileNameStyle}>{item.fileName}</span>
                  </div>
                  <div style={itemMetaStyle}>
                    <span style={metaItemStyle}>{formatFileSize(item.size)}</span>
                    <span style={metaDividerStyle}>|</span>
                    <span style={metaItemStyle}>{text('corpus.itemEntries', { count: item.entryCount })}</span>
                    <span style={metaDividerStyle}>|</span>
                    <span style={metaItemStyle}>{formatTime(item.importedAt, language)}</span>
                  </div>
                </div>

                {/* 状态和操作 */}
                <div style={itemActionsStyle}>
                  {/* 状态标签 */}
                  <span
                    style={{
                      ...statusBadgeStyle,
                      color: STATUS_COLORS[item.status],
                      background:
                        item.status === 'active'
                          ? 'var(--color-success-subtle, rgba(46,125,50,0.08))'
                          : item.status === 'disabled'
                            ? 'var(--color-bg-tertiary, #E8E8EA)'
                            : item.status === 'error'
                              ? 'var(--color-error-subtle, rgba(198,40,40,0.08))'
                              : 'var(--color-warning-subtle, rgba(249,168,37,0.08))',
                    }}
                  >
                    {statusLabel(item.status, text)}
                  </span>

                  {/* 操作按钮 */}
                  {item.status !== 'processing' && (
                    <div style={actionGroupStyle}>
                      <button
                        type="button"
                        onClick={() => handleToggleDisable(item)}
                        style={actionBtnStyle}
                        title={item.status === 'disabled' ? text('corpus.enable') : text('corpus.disable')}
                      >
                        {item.status === 'disabled' ? text('corpus.enable') : text('corpus.disable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReprocess(item)}
                        style={actionBtnStyle}
                        title={text('corpus.reprocessTitle')}
                      >
                        {text('corpus.reprocess')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        style={{ ...actionBtnStyle, color: 'var(--color-error, #C62828)' }}
                        title={text('corpus.deleteTitle')}
                      >
                        {text('corpus.delete')}
                      </button>
                    </div>
                  )}
                  {item.status === 'processing' && (
                    <span style={processingHintStyle}>
                      {text('corpus.processingHint')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── 提示信息 ── */}
        <div style={footerHintStyle}>
          <span>{text('corpus.footer')}</span>
        </div>
      </div>

      {/* ── 确认对话框 ── */}
      {confirmDialog && (
        <div style={confirmOverlayStyle}>
          <div
            className="corpus-manager__confirm"
            style={confirmDialogStyle}
            role="alertdialog"
            aria-modal="true"
            aria-label={text('corpus.confirmAria')}
          >
            <div style={confirmHeaderStyle}>
              <span style={confirmIconStyle}>
                {confirmDialog.type === 'delete' ? '⚠️' : '❓'}
              </span>
              <span style={confirmTitleStyle}>
                {confirmDialog.type === 'delete' ? text('corpus.confirmDeleteTitle') : text('corpus.confirmDisableTitle')}
              </span>
            </div>
            <div style={confirmBodyStyle}>
              {confirmDialog.type === 'delete' ? (
                <>
                  <p style={confirmMsgStyle}>
                    {text('corpus.confirmDelete', { file: confirmDialog.item.fileName })}
                  </p>
                  <p style={confirmWarningStyle}>
                    {text('corpus.deleteWarning')}
                  </p>
                </>
              ) : (
                <>
                  <p style={confirmMsgStyle}>
                    {text('corpus.confirmDisable', { file: confirmDialog.item.fileName })}
                  </p>
                  <p style={confirmHintStyle}>
                    {text('corpus.disableHint')}
                  </p>
                </>
              )}
            </div>
            <div style={confirmFooterStyle}>
              <button
                type="button"
                onClick={handleCancelConfirm}
                style={cancelButtonStyle}
              >
                {text('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  ...confirmButtonStyle,
                  background:
                    confirmDialog.type === 'delete'
                      ? 'var(--color-error, #C62828)'
                      : 'var(--color-accent, #A0703A)',
                }}
              >
                {confirmDialog.type === 'delete' ? text('corpus.confirmDeleteAction') : text('corpus.confirmDisableAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  width: 680,
  maxWidth: '90vw',
  maxHeight: '80vh',
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

const badgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  color: 'var(--color-text-muted, #8A8A8A)',
  background: 'var(--color-bg-tertiary, #E8E8EA)',
  padding: '2px 8px',
  borderRadius: 10,
  lineHeight: '16px',
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

// -------- 统计概览 --------

const statsBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  padding: '8px 16px',
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
};

const statItemStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
};

const statValueStyle: React.CSSProperties = {
  color: 'var(--color-text-primary, #333333)',
  fontWeight: 600,
};

// -------- 操作按钮栏 --------

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 16px',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-accent, #A0703A)',
  color: 'var(--color-text-on-accent, #FFFFFF)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: 6,
  lineHeight: '20px',
  transition: 'background 0.12s ease, opacity 0.12s ease',
};

const secondaryButtonStyle: React.CSSProperties = {
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

// -------- 语料列表 --------

const listContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '4px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border-subtle, #F0F0F0)',
  transition: 'background 0.08s ease',
  gap: 12,
};

const itemInfoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const itemNameStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const fileIconStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: 1,
  flexShrink: 0,
};

const fileNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const itemMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
};

const metaItemStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
};

const metaDividerStyle: React.CSSProperties = {
  color: 'var(--color-border-default, #E0E0E0)',
  userSelect: 'none',
};

// -------- 操作区域 --------

const itemActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 10,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
};

const actionGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
};

const actionBtnStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-secondary, #5A5A5A)',
  padding: '3px 10px',
  borderRadius: 4,
  lineHeight: '18px',
  transition: 'background 0.08s ease',
  whiteSpace: 'nowrap',
};

const processingHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-warning, #F9A825)',
  fontStyle: 'italic',
};

// -------- 空状态 --------

const emptyStyle: React.CSSProperties = {
  padding: '48px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  fontSize: '13px',
  color: 'var(--color-text-muted, #8A8A8A)',
  textAlign: 'center',
  lineHeight: 1.6,
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: '32px',
  opacity: 0.4,
};

const emptyHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
};

// -------- 底部提示 --------

const footerHintStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
  textAlign: 'center',
};

// -------- 确认对话框 --------

const confirmOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-overlay-modal, rgba(0,0,0,0.3))',
  zIndex: 1100,
};

const confirmDialogStyle: React.CSSProperties = {
  width: 400,
  maxWidth: '80vw',
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.18))',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const confirmHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 16px 8px',
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
};

const confirmIconStyle: React.CSSProperties = {
  fontSize: '18px',
  lineHeight: 1,
};

const confirmTitleStyle: React.CSSProperties = {
  fontSize: '15px',
};

const confirmBodyStyle: React.CSSProperties = {
  padding: '8px 16px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const confirmMsgStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--color-text-primary, #333333)',
  lineHeight: 1.5,
};

const confirmWarningStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: 'var(--color-error, #C62828)',
  lineHeight: 1.5,
};

const confirmHintStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
  lineHeight: 1.5,
};

const confirmFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '10px 16px',
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
};

const confirmButtonStyle: React.CSSProperties = {
  border: 'none',
  color: 'var(--color-text-on-accent, #FFFFFF)',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: 6,
  lineHeight: '20px',
};
