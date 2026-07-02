/**
 * useMenuEvents — 菜单事件分发 Hook (M1-17)
 *
 * @remarks
 * 在 App 根组件挂载时注册所有菜单事件的监听器。
 * 主进程菜单点击通过 IPC → 渲染进程 → 本 hook 分发到对应的 store action / service。
 *
 * 菜单事件双向同步流：
 *   主进程 Menu.click → webContents.send('menu:xxx')
 *     → useMenuEvents 接收
 *       → 调用 store action 或 service 方法
 *         → Zustand state 更新 → React 组件重渲染
 *
 * 标准编辑操作（撤销/重做/剪切/复制/粘贴/全选）由 Electron 内置 role 自动处理，
 * 不经过本 hook。
 *
 * @module hooks/useMenuEvents
 */

import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import { useStoryStore } from '../stores/storyStore';
import { clearPendingSave, saveAsCurrentFile, saveOrSaveAs } from '../services/autoSaveService';
import { FileService } from '../services/fileService';
import { appT } from '../i18n/appI18n';

// ============================================================================
// 模块级实例
// ============================================================================

const fileService = new FileService();

function menuText(key: string, params?: Readonly<Record<string, string | number>>): string {
  return appT(key, params, useUIStore.getState().language);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 在 App 根组件挂载时注册所有菜单事件监听器。
 *
 * 组件卸载时自动清理所有监听器，防止内存泄漏。
 *
 * 由于本 hook 只注册一次且不依赖外部变化，空依赖数组 [] 是安全的。
 *
 * @example
 *   // 在 App.tsx 中：
 *   export function App() {
 *     useMenuEvents();
 *     return <AppShell />;
 *   }
 */
export function useMenuEvents(): void {
  useEffect(() => {
    if (!window.plotflow?.menu) {
      useUIStore.getState().setStatusMessage(menuText('menu.browserPreview'));
      return undefined;
    }

    const menu = window.plotflow.menu;

    // ── 统一错误处理 ──
    function handleError(contextKey: string, error: unknown): void {
      const message = error instanceof Error ? error.message : String(error);
      useUIStore.getState().setStatusMessage(`${menuText(contextKey)}: ${message}`);
    }

    // ====================================================================
    // 文件菜单
    // ====================================================================

    menu.onEvent('menu:file:new', () => {
      // 清除防抖定时器，避免残留异步保存
      clearPendingSave();
      useUIStore.getState().openNewFileDialog();
    });

    menu.onEvent('menu:file:open', async () => {
      try {
        // P0-5: 打开新文件前检查是否有未保存的更改
        const editor = useEditorStore.getState();
        if (editor.isDirty) {
          const choice = await window.plotflow.dialog.confirm({
            type: 'warning',
            message: menuText('file.unsavedTitle'),
            detail: editor.filePath
              ? menuText('file.openDirtyNamed', { path: editor.filePath })
              : menuText('file.openDirtyUnnamed'),
            buttons: [menuText('home.saveAndOpen'), menuText('home.discardAndOpen'), menuText('common.cancel')],
          });

          if (choice === 0) {
            const saved = await saveOrSaveAs();
            if (!saved) return;
          } else if (choice === 2) {
            return; // 取消打开
          }
          // choice === 1: 不保存，继续打开
        }

        const result = await fileService.openFile();
        if (!result) return; // 用户取消了文件打开对话框

        // 清除防抖定时器
        clearPendingSave();
        // 重新获取最新的 editor 引用（saveOrSaveAs 可能已更新路径）
        const freshEditor = useEditorStore.getState();
        freshEditor.setDiagnostics([]);
        freshEditor.setActiveNodeId(null);
        freshEditor.setCursorPosition(1, 1);
        freshEditor.setContent(result.content);
        freshEditor.setFilePath(result.path);
        freshEditor.markSaved();
        // 清除旧 AST 数据（新内容将在解析后自动更新）
        useStoryStore.getState().clearParseData();
        // 状态栏反馈
        useUIStore.getState().setStatusMessage(menuText('status.opened', { path: result.path }));
      } catch (error) {
        // 用户取消操作属正常行为，不显示为"失败"
        handleError('menu.openError', error);
      }
    });

    menu.onEvent('menu:file:save', async () => {
      try {
        // P0-3: 使用 saveOrSaveAs 替代 forceSave，新文件自动弹出另存为对话框
        await saveOrSaveAs();
      } catch (error) {
        handleError('menu.saveError', error);
      }
    });

    menu.onEvent('menu:file:saveAs', async () => {
      try {
        await saveAsCurrentFile();
      } catch (error) {
        handleError('menu.saveAsError', error);
      }
    });

    // ====================================================================
    // 编辑菜单
    // ====================================================================

    // 查找/替换：M0 阶段 Monaco 未完全集成，先作为占位。
    // M1 集成完成后，通过 monaco.editor.trigger('actions.find') 实现。
    menu.onEvent('menu:edit:find', () => {
      const editor = useEditorStore.getState().editorInstance;
      editor?.getAction('actions.find')?.run();
    });

    menu.onEvent('menu:edit:replace', () => {
      const editor = useEditorStore.getState().editorInstance;
      editor?.getAction('editor.action.startFindReplaceAction')?.run();
    });

    menu.onEvent('menu:edit:undo', () => {
      const editor = useEditorStore.getState().editorInstance;
      editor?.trigger('keyboard', 'undo', null);
    });

    menu.onEvent('menu:edit:redo', () => {
      const editor = useEditorStore.getState().editorInstance;
      editor?.trigger('keyboard', 'redo', null);
    });

    // ====================================================================
    // 视图菜单
    // ====================================================================

    menu.onEvent('menu:view:toggleOutline', () => {
      useUIStore.getState().toggleOutlinePanel();
    });

    menu.onEvent('menu:view:toggleGraph', () => {
      const ui = useUIStore.getState();
      // 切换分支图面板的显示/隐藏
      const nextPanel = ui.activeRightPanel === 'graph' ? 'none' : 'graph';
      ui.setActiveRightPanel(nextPanel);
      useUIStore.getState().setStatusMessage(
        nextPanel === 'graph' ? menuText('menu.graphShown') : menuText('menu.graphHidden'),
      );
    });

    menu.onEvent('menu:view:toggleProblems', () => {
      useUIStore.getState().toggleProblemPanel();
    });

    menu.onEvent('menu:view:themeBrowser', () => {
      useUIStore.getState().openThemeCenter();
    });

    // ====================================================================
    // 导出菜单
    // ====================================================================

    menu.onEvent('menu:export:json', () => {
      useUIStore.getState().openExportDialog('json');
    });

    menu.onEvent('menu:export:html', () => {
      useUIStore.getState().openExportDialog('html');
    });

    menu.onEvent('menu:export:txt', () => {
      useUIStore.getState().openExportDialog('txt');
    });

    // ====================================================================
    // 帮助菜单
    // ====================================================================

    menu.onEvent('menu:help:about', () => {
      // M7 启用：使用 dialog.showMessageBox 显示完整关于信息
      useUIStore.getState().setStatusMessage(menuText('menu.about'));
    });

    menu.onEvent('menu:help:docs', () => {
      // M7 启用：使用 shell.openExternal 或 shell.openPath 打开文档
      useUIStore.getState().setStatusMessage(menuText('menu.docs'));
    });

    // ── 组件卸载时清理所有监听器 ──
    return () => {
      menu.removeAllEventListeners();
    };
  }, []); // 空依赖数组：只注册一次，生命周期同 App 组件
}
