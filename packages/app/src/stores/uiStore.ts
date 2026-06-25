/**
 * useUIStore — UI 全局状态管理
 *
 * 职责：管理主题、语言、面板可见性、状态消息等 UI 层面的全局状态。
 *
 * 对应 TAD.md §2.2.2 ThemeState + UIState 接口定义。
 *
 * 约束（CLAUDE.md §6.1）：
 * - 主题切换必须通过 CSS 变量驱动，不得硬编码两套样式
 * - 所有组件颜色必须引用 Design Token CSS 变量
 *
 * @module stores/uiStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { changeLanguage, type Locale } from '@plotflow/core';
import {
  DEFAULT_OFFICIAL_THEME_ID,
  normalizeOfficialThemeId,
  type OfficialThemeId,
} from '../theme/officialThemeIds';

// ============================================================================
// 类型定义
// ============================================================================

/** 主题 */

/** 强调色方案 */

/** 语言 */
export type Language = Locale;

/** 右侧面板内容 */
export type RightPanel = 'graph' | 'none';

export type ExportFormat = 'json' | 'html' | 'txt';

export type WorkspaceMode = 'split' | 'graphLab';

export type ThemePackId = string;

/** UI 全局状态 */
export interface UIState {
  /** 当前主题（亮色 / 暗色） */

  /** 当前界面语言 */
  readonly language: Language;

  /** 强调色方案 */

  readonly workspaceMode: WorkspaceMode;
  readonly activeOfficialThemeId: OfficialThemeId;
  readonly activeThemePackId: ThemePackId;

  /** 右侧面板当前显示内容 */
  readonly activeRightPanel: RightPanel;

  /** 状态栏消息 */
  readonly statusMessage: string;

  /** 条件编辑器面板是否打开 */
  readonly isConditionEditorOpen: boolean;
  /** 条件编辑器当前编辑的节点 ID（null 表示无上下文） */
  readonly conditionEditorNodeId: string | null;
  /** 条件编辑器当前编辑的选项索引（null 表示无上下文） */
  readonly conditionEditorOptionIndex: number | null;
  readonly isOutlinePanelOpen: boolean;

  /** 问题面板是否打开（M3-16） */
  readonly isProblemPanelOpen: boolean;
  readonly isSourceDrawerOpen: boolean;

  /** 导出对话框是否打开（M4） */
  readonly isExportDialogOpen: boolean;
  readonly exportDialogFormat: ExportFormat;

  /** 语料管理器是否打开（M5-19） */
  readonly isCorpusManagerOpen: boolean;

  /** 新建文件模板对话框是否打开（M6-01） */
  readonly isNewFileDialogOpen: boolean;

  readonly isThemeCenterOpen: boolean;
  readonly isHomeSurfaceOpen: boolean;

  // --- Actions ---


  /** 设置强调色方案 */

  /** 设置界面语言 */
  setLanguage: (lang: Language) => void;

  setWorkspaceMode: (mode: WorkspaceMode) => void;

  toggleWorkspaceMode: () => void;

  setActiveThemePackId: (themePackId: ThemePackId) => void;
  setActiveOfficialThemeId: (themeId: OfficialThemeId) => void;

  /** 设置右侧面板显示内容 */
  setActiveRightPanel: (panel: RightPanel) => void;

  /** 设置状态栏消息 */
  setStatusMessage: (msg: string) => void;

  /** 切换条件编辑器面板的打开/关闭状态 */
  toggleOutlinePanel: () => void;
  toggleConditionEditor: () => void;
  /** 打开条件编辑器并指定编辑上下文 */
  openConditionEditor: (nodeId: string, optionIndex: number) => void;

  /** 切换问题面板的打开/关闭状态 */
  toggleProblemPanel: () => void;

  /** 显式设置问题面板打开/关闭 */
  setProblemPanelOpen: (open: boolean) => void;
  toggleSourceDrawer: () => void;
  setSourceDrawerOpen: (open: boolean) => void;

  /** 打开导出对话框 */
  openExportDialog: (format?: ExportFormat) => void;

  /** 关闭导出对话框 */
  closeExportDialog: () => void;

  /** 打开语料管理器 */
  openCorpusManager: () => void;

  /** 关闭语料管理器 */
  closeCorpusManager: () => void;

  /** 打开新建文件模板对话框 */
  openNewFileDialog: () => void;

  /** 关闭新建文件模板对话框 */
  closeNewFileDialog: () => void;

  openThemeCenter: () => void;
  closeThemeCenter: () => void;
  setHomeSurfaceOpen: (open: boolean) => void;
}

// ============================================================================
// 初始状态
// ============================================================================

const THEME_STORAGE_KEY = 'plotflow:theme';
const LANGUAGE_STORAGE_KEY = 'plotflow:language';
const WORKSPACE_MODE_STORAGE_KEY = 'plotflow:workspaceMode';
const THEME_PACK_STORAGE_KEY = 'plotflow:themePack';
const OFFICIAL_THEME_STORAGE_KEY = 'plotflow:officialTheme';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'zh-CN';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en-US' ? 'en-US' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

function readStoredWorkspaceMode(): WorkspaceMode {
  if (typeof window === 'undefined') return 'split';
  try {
    const saved = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    return saved === 'graphLab' ? 'graphLab' : 'split';
  } catch {
    return 'split';
  }
}

function readStoredOfficialThemeId(): OfficialThemeId {
  if (typeof window === 'undefined') return DEFAULT_OFFICIAL_THEME_ID;
  try {
    const savedOfficial = window.localStorage.getItem(OFFICIAL_THEME_STORAGE_KEY);
    if (savedOfficial) {
      const normalized = normalizeOfficialThemeId(savedOfficial);
      window.localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, normalized);
      window.localStorage.setItem(THEME_PACK_STORAGE_KEY, normalized);
      return normalized;
    }

    const savedLegacy = window.localStorage.getItem(THEME_PACK_STORAGE_KEY);
    if (!savedLegacy) {
      const legacyMode = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (legacyMode === 'dark') {
        window.localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, 'plotflow-blueprint-nightwatch');
        window.localStorage.setItem(THEME_PACK_STORAGE_KEY, 'plotflow-blueprint-nightwatch');
        return 'plotflow-blueprint-nightwatch';
      }
    }
    const normalized = normalizeOfficialThemeId(savedLegacy);
    window.localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, normalized);
    window.localStorage.setItem(THEME_PACK_STORAGE_KEY, normalized);
    return normalized;
  } catch {
    return DEFAULT_OFFICIAL_THEME_ID;
  }
}

function persistPreference(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference persistence is best-effort; the UI state still updates.
  }
}

const initialLanguage = readStoredLanguage();
const initialOfficialThemeId = readStoredOfficialThemeId();
changeLanguage(initialLanguage);

const initialState = {
  workspaceMode: readStoredWorkspaceMode(),
  activeOfficialThemeId: initialOfficialThemeId,
  activeThemePackId: initialOfficialThemeId,
  language: initialLanguage,
  activeRightPanel: 'graph' as RightPanel,
  isOutlinePanelOpen: true,
  statusMessage: '',
  isConditionEditorOpen: false,
  conditionEditorNodeId: null,
  conditionEditorOptionIndex: null,
  isProblemPanelOpen: false,
  isSourceDrawerOpen: false,
  isExportDialogOpen: false,
  exportDialogFormat: 'json' as ExportFormat,
  isCorpusManagerOpen: false,
  isNewFileDialogOpen: false,
  isThemeCenterOpen: false,
  isHomeSurfaceOpen: true,
} as const satisfies Omit<UIState, 'setLanguage' | 'setWorkspaceMode' | 'toggleWorkspaceMode' | 'setActiveThemePackId' | 'setActiveOfficialThemeId' | 'setActiveRightPanel' | 'setStatusMessage' | 'toggleConditionEditor' | 'openConditionEditor' | 'toggleOutlinePanel' | 'toggleProblemPanel' | 'setProblemPanelOpen' | 'toggleSourceDrawer' | 'setSourceDrawerOpen' | 'openExportDialog' | 'closeExportDialog' | 'openCorpusManager' | 'closeCorpusManager' | 'openNewFileDialog' | 'closeNewFileDialog' | 'openThemeCenter' | 'closeThemeCenter' | 'setHomeSurfaceOpen'>;

// ============================================================================
// Store
// ============================================================================

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // --- 初始状态 ---
      ...initialState,

      // --- Actions ---

      setLanguage: (lang: Language) => {
        changeLanguage(lang);
        persistPreference(LANGUAGE_STORAGE_KEY, lang);
        set(
          { language: lang },
          false,
          'ui/setLanguage',
        );
      },

      setWorkspaceMode: (mode: WorkspaceMode) => {
        persistPreference(WORKSPACE_MODE_STORAGE_KEY, mode);
        set(
          { workspaceMode: mode },
          false,
          'ui/setWorkspaceMode',
        );
      },

      toggleWorkspaceMode: () =>
        set(
          (state) => {
            const workspaceMode = state.workspaceMode === 'split' ? 'graphLab' : 'split';
            persistPreference(WORKSPACE_MODE_STORAGE_KEY, workspaceMode);
            return { workspaceMode };
          },
          false,
          'ui/toggleWorkspaceMode',
        ),

      setActiveOfficialThemeId: (themeId: OfficialThemeId) => {
        persistPreference(OFFICIAL_THEME_STORAGE_KEY, themeId);
        persistPreference(THEME_PACK_STORAGE_KEY, themeId);
        set(
          {
            activeOfficialThemeId: themeId,
            activeThemePackId: themeId,
          },
          false,
          'ui/setActiveOfficialThemeId',
        );
      },

      setActiveThemePackId: (themePackId: ThemePackId) => {
        const themeId = normalizeOfficialThemeId(themePackId);
        persistPreference(OFFICIAL_THEME_STORAGE_KEY, themeId);
        persistPreference(THEME_PACK_STORAGE_KEY, themeId);
        set(
          {
            activeOfficialThemeId: themeId,
            activeThemePackId: themeId,
          },
          false,
          'ui/setActiveThemePackId',
        );
      },

      setActiveRightPanel: (panel: RightPanel) =>
        set(
          { activeRightPanel: panel },
          false,
          'ui/setActiveRightPanel',
        ),

      setStatusMessage: (msg: string) =>
        set(
          { statusMessage: msg },
          false,
          'ui/setStatusMessage',
        ),

      toggleOutlinePanel: () =>
        set(
          (state) => ({
            isOutlinePanelOpen: !state.isOutlinePanelOpen,
          }),
          false,
          'ui/toggleOutlinePanel',
        ),

      toggleConditionEditor: () =>
        set(
          (state) => ({
            isConditionEditorOpen: !state.isConditionEditorOpen,
            // 关闭时清除上下文
            ...(state.isConditionEditorOpen ? { conditionEditorNodeId: null, conditionEditorOptionIndex: null } : {}),
          }),
          false,
          'ui/toggleConditionEditor',
        ),

      openConditionEditor: (nodeId: string, optionIndex: number) =>
        set(
          {
            isConditionEditorOpen: true,
            conditionEditorNodeId: nodeId,
            conditionEditorOptionIndex: optionIndex,
          },
          false,
          'ui/openConditionEditor',
        ),

      toggleProblemPanel: () =>
        set(
          (state) => ({
            isProblemPanelOpen: !state.isProblemPanelOpen,
          }),
          false,
          'ui/toggleProblemPanel',
        ),

      setProblemPanelOpen: (open: boolean) =>
        set(
          { isProblemPanelOpen: open },
          false,
          'ui/setProblemPanelOpen',
        ),

      toggleSourceDrawer: () =>
        set(
          (state) => ({
            isSourceDrawerOpen: !state.isSourceDrawerOpen,
          }),
          false,
          'ui/toggleSourceDrawer',
        ),

      setSourceDrawerOpen: (open: boolean) =>
        set(
          { isSourceDrawerOpen: open },
          false,
          'ui/setSourceDrawerOpen',
        ),

      openExportDialog: (format?: ExportFormat) =>
        set(
          (state) => ({
            isExportDialogOpen: true,
            exportDialogFormat: format ?? state.exportDialogFormat,
          }),
          false,
          'ui/openExportDialog',
        ),

      closeExportDialog: () =>
        set(
          { isExportDialogOpen: false },
          false,
          'ui/closeExportDialog',
        ),

      openCorpusManager: () =>
        set(
          { isCorpusManagerOpen: true },
          false,
          'ui/openCorpusManager',
        ),

      closeCorpusManager: () =>
        set(
          { isCorpusManagerOpen: false },
          false,
          'ui/closeCorpusManager',
        ),

      openNewFileDialog: () =>
        set(
          { isNewFileDialogOpen: true },
          false,
          'ui/openNewFileDialog',
        ),

      closeNewFileDialog: () =>
        set(
          { isNewFileDialogOpen: false },
          false,
          'ui/closeNewFileDialog',
        ),

      openThemeCenter: () =>
        set(
          { isThemeCenterOpen: true },
          false,
          'ui/openThemeCenter',
        ),

      closeThemeCenter: () =>
        set(
          { isThemeCenterOpen: false },
          false,
          'ui/closeThemeCenter',
        ),

      setHomeSurfaceOpen: (open: boolean) =>
        set(
          { isHomeSurfaceOpen: open },
          false,
          'ui/setHomeSurfaceOpen',
        ),
    }),
    { name: 'UIStore' },
  ),
);
