/**
 * Monaco Editor 0.45 类型补丁
 *
 * Monaco 0.45 的捆绑类型定义滞后于实际运行时 API。
 * 本文件补充缺失的类型声明，M6 升级到 Monaco 0.50+ 后移除此文件。
 *
 * @see memory/bug_log.md BUG-001
 */

import 'monaco-editor';

declare module 'monaco-editor' {
  namespace languages {
    // ITextModel is available at runtime but not exported from the languages namespace in 0.45
    import type { ITextModel as _ITextModel } from 'monaco-editor/esm/vs/editor/common/model';
    export type ITextModel = _ITextModel;
  }
}

// Extend IMonarchLanguageRule to accept fontStyle (supported at runtime, missing from 0.45 types)
declare module 'monaco-editor/esm/vs/editor/editor.api' {
  namespace languages {
    interface IShortMonarchLanguageRule1 {
      // Allow fontStyle in short-form rules (e.g., ['heading', { token: 'heading', fontStyle: 'bold' }])
    }
    interface IExpandedMonarchLanguageAction {
      fontStyle?: string;
    }
  }
}

// Vite ?worker imports
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  class EditorWorker extends Worker {
    constructor();
  }
  export default EditorWorker;
}
