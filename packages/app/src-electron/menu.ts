/**
 * 应用菜单栏 (M1-17)
 *
 * @remarks
 * Electron Menu API 构建五菜单：文件/编辑/视图/导出/帮助。
 * 快捷键通过菜单项的 accelerator 属性实现。
 * 所有菜单点击通过 IPC (webContents.send) 发送事件到渲染进程，
 * 由 useMenuEvents hook 接收并分发到对应的 store / service 操作。
 *
 * 注意：
 * - Electron Menu 不支持 VSCode 风格的多键和弦（如 Ctrl+E J），
 *   导出菜单改用单组合键：Ctrl+E / Ctrl+Shift+E / Ctrl+Alt+E。
 * - 标准编辑操作（撤销/重做/剪切/复制/粘贴/全选）使用内置 role，
 *   由 Electron 自动处理，不发送 IPC。
 *
 * @see doc/TAD.md §4.3 — 应用菜单
 * @see src/hooks/useMenuEvents.ts — 菜单事件接收与分发
 */

import {
  Menu,
  type MenuItemConstructorOptions,
  app,
  BrowserWindow,
} from 'electron';

// ============================================================================
// 常量
// ============================================================================

const IS_MAC = process.platform === 'darwin';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 发送 IPC 事件到当前聚焦窗口的渲染进程。
 * 如果无聚焦窗口，静默忽略。
 */
function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win?.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

// ============================================================================
// 菜单模板构建
// ============================================================================

/**
 * 构建 PlotFlow 完整应用菜单栏。
 *
 * 五菜单结构：
 * 1. 文件 — 新建/打开/保存/另存为/退出
 * 2. 编辑 — 撤销/重做/剪切/复制/粘贴/全选/查找/替换
 * 3. 视图 — 大纲/分支图/问题面板/切换主题
 * 4. 导出 — JSON/HTML/TXT
 * 5. 帮助 — 关于/文档
 */
export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    // ── macOS 应用菜单 ──────────────────────────────────────────────
    //
    // macOS 在"文件"前有应用名称菜单（含关于/退出等）。
    // Windows/Linux 没有此菜单，"关于"放在"帮助"菜单，"退出"放在"文件"菜单。
    ...(IS_MAC
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // ── 文件 ────────────────────────────────────────────────────────
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu:file:new'),
        },
        {
          label: '打开...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu:file:open'),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu:file:save'),
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu:file:saveAs'),
        },
        { type: 'separator' },
        // Windows/Linux 退出放在文件菜单末尾
        ...(IS_MAC ? [] : [{ role: 'quit' as const }]),
      ],
    },

    // ── 编辑 ────────────────────────────────────────────────────────
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('menu:edit:undo'),
        },
        {
          label: '重做',
          accelerator: IS_MAC ? 'Cmd+Shift+Z' : 'CmdOrCtrl+Y',
          click: () => sendToRenderer('menu:edit:redo'),
        },
        { type: 'separator' },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut',
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy',
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste',
        },
        {
          label: '全选',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll',
        },
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer('menu:edit:find'),
        },
        {
          label: '替换',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendToRenderer('menu:edit:replace'),
        },
      ],
    },

    // ── 视图 ────────────────────────────────────────────────────────
    {
      label: '视图',
      submenu: [
        {
          label: '大纲',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToRenderer('menu:view:toggleOutline'),
        },
        {
          label: '分支图',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendToRenderer('menu:view:toggleGraph'),
        },
        {
          label: '问题面板',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => sendToRenderer('menu:view:toggleProblems'),
        },
        { type: 'separator' },
        {
          label: '主题与美学拓展...',
          click: () => sendToRenderer('menu:view:themeBrowser'),
        },
      ],
    },

    // ── 导出 ────────────────────────────────────────────────────────
    //
    // 注：Electron 不支持 VSCode 风格的多键和弦 (Ctrl+E J)，
    // 此处使用单组合键替代：
    //   Ctrl+E          → JSON
    //   Ctrl+Shift+E    → HTML
    //   Ctrl+Alt+E      → TXT
    {
      label: '导出',
      submenu: [
        {
          label: '导出 JSON',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToRenderer('menu:export:json'),
        },
        {
          label: '导出 HTML',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendToRenderer('menu:export:html'),
        },
        {
          label: '导出 TXT',
          accelerator: 'CmdOrCtrl+Alt+E',
          click: () => sendToRenderer('menu:export:txt'),
        },
      ],
    },

    // ── 帮助 ────────────────────────────────────────────────────────
    //
    // macOS 的"关于"已放在应用名菜单，此处不再重复；
    // Windows/Linux 将"关于"放在帮助菜单顶部。
    {
      label: '帮助',
      submenu: [
        ...(IS_MAC
          ? []
          : [
              {
                label: '关于 PlotFlow',
                click: () => sendToRenderer('menu:help:about'),
              },
              { type: 'separator' as const },
            ]),
        {
          label: '文档',
          click: () => sendToRenderer('menu:help:docs'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
