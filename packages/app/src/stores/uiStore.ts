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

// ============================================================================
// 类型定义
// ============================================================================

/** 主题 */
export type Theme = 'light' | 'dark';

/** 强调色方案 */
export type Accent = 'ocean' | 'gold';

/** 语言 */
export type Language = Locale;

/** 右侧面板内容 */
export type RightPanel = 'graph' | 'none';

/** UI 全局状态 */
export interface UIState {
  /** 当前主题（亮色 / 暗色） */
  readonly theme: Theme;

  /** 当前界面语言 */
  readonly language: Language;

  /** 强调色方案 */
  readonly accent: Accent;

  /** 右侧面板当前显示内容 */
  readonly activeRightPanel: RightPanel;

  /** 状态栏消息 */
  readonly statusMessage: string;

  /** 条件编辑器面板是否打开 */
  readonly isConditionEditorOpen: boolean;
  readonly isOutlinePanelOpen: boolean;

  /** 问题面板是否打开（M3-16） */
  readonly isProblemPanelOpen: boolean;

  /** 导出对话框是否打开（M4） */
  readonly isExportDialogOpen: boolean;

  /** 语料管理器是否打开（M5-19） */
  readonly isCorpusManagerOpen: boolean;

  /** 新建文件模板对话框是否打开（M6-01） */
  readonly isNewFileDialogOpen: boolean;

  // --- Actions ---

  /** 切换主题（light <-> dark） */
  toggleTheme: () => void;

  /** 设置强调色方案 */
  setAccent: (accent: Accent) => void;

  /** 设置界面语言 */
  setLanguage: (lang: Language) => void;

  /** 设置右侧面板显示内容 */
  setActiveRightPanel: (panel: RightPanel) => void;

  /** 设置状态栏消息 */
  setStatusMessage: (msg: string) => void;

  /** 切换条件编辑器面板的打开/关闭状态 */
  toggleOutlinePanel: () => void;
  toggleConditionEditor: () => void;

  /** 切换问题面板的打开/关闭状态 */
  toggleProblemPanel: () => void;

  /** 显式设置问题面板打开/关闭 */
  setProblemPanelOpen: (open: boolean) => void;

  /** 打开导出对话框 */
  openExportDialog: () => void;

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
}

// ============================================================================
// 初始状态
// ============================================================================

const THEME_STORAGE_KEY = 'plotflow:theme';
const LANGUAGE_STORAGE_KEY = 'plotflow:language';
const ACCENT_STORAGE_KEY = 'plotflow:accent';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'zh-CN';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en-US' ? 'en-US' : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

function readStoredAccent(): Accent {
  if (typeof window === 'undefined') return 'ocean';
  try {
    const saved = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return saved === 'gold' ? 'gold' : 'ocean';
  } catch {
    return 'ocean';
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
changeLanguage(initialLanguage);

const initialState = {
  theme: readStoredTheme(),
  accent: readStoredAccent(),
  language: initialLanguage,
  activeRightPanel: 'graph' as RightPanel,
  isOutlinePanelOpen: true,
  statusMessage: '',
  isConditionEditorOpen: false,
  isProblemPanelOpen: false,
  isExportDialogOpen: false,
  isCorpusManagerOpen: false,
  isNewFileDialogOpen: false,
} as const satisfies Omit<UIState, 'toggleTheme' | 'setAccent' | 'setLanguage' | 'setActiveRightPanel' | 'setStatusMessage' | 'toggleConditionEditor' | 'toggleOutlinePanel' | 'toggleProblemPanel' | 'setProblemPanelOpen' | 'openExportDialog' | 'closeExportDialog' | 'openCorpusManager' | 'closeCorpusManager' | 'openNewFileDialog' | 'closeNewFileDialog'>;

// ============================================================================
// Store
// ============================================================================

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // --- 初始状态 ---
      ...initialState,

      // --- Actions ---

      toggleTheme: () =>
        set(
          (state) => {
            const theme = state.theme === 'light' ? 'dark' : 'light';
            persistPreference(THEME_STORAGE_KEY, theme);
            return { theme };
          },
          false,
          'ui/toggleTheme',
        ),

      setLanguage: (lang: Language) => {
        changeLanguage(lang);
        persistPreference(LANGUAGE_STORAGE_KEY, lang);
        set(
          { language: lang },
          false,
          'ui/setLanguage',
        );
      },

      setAccent: (accent: Accent) => {
        persistPreference(ACCENT_STORAGE_KEY, accent);
        set(
          { accent },
          false,
          'ui/setAccent',
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
          }),
          false,
          'ui/toggleConditionEditor',
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

      openExportDialog: () =>
        set(
          { isExportDialogOpen: true },
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
    }),
    { name: 'UIStore' },
  ),
);
