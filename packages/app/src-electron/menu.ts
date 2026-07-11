import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron';
import { IPC_CHANNELS } from '../src/shared/ipcChannels';
import type { MenuEventChannel } from '../src/shared/ipcChannels';

export type AppMenuLanguage = 'zh-CN' | 'en-US';

const IS_MAC = process.platform === 'darwin';

const labels: Record<AppMenuLanguage, {
  file: string;
  new: string;
  open: string;
  save: string;
  saveAs: string;
  quit: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  find: string;
  replace: string;
  view: string;
  outline: string;
  branchGraph: string;
  problems: string;
  themeCenter: string;
  export: string;
  exportJson: string;
  exportHtml: string;
  exportTxt: string;
  help: string;
  about: string;
  docs: string;
}> = {
  'zh-CN': {
    file: '文件',
    new: '新建',
    open: '打开...',
    save: '保存',
    saveAs: '另存为...',
    quit: '退出',
    edit: '编辑',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    find: '查找',
    replace: '替换',
    view: '视图',
    outline: '大纲',
    branchGraph: '分支图',
    problems: '问题面板',
    themeCenter: '主题中心...',
    export: '导出',
    exportJson: '导出 JSON',
    exportHtml: '导出 HTML',
    exportTxt: '导出 TXT',
    help: '帮助',
    about: '关于 PlotFlow',
    docs: '文档',
  },
  'en-US': {
    file: 'File',
    new: 'New',
    open: 'Open...',
    save: 'Save',
    saveAs: 'Save As...',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    find: 'Find',
    replace: 'Replace',
    view: 'View',
    outline: 'Outline',
    branchGraph: 'Branch Graph',
    problems: 'Problems Panel',
    themeCenter: 'Theme Center...',
    export: 'Export',
    exportJson: 'Export JSON',
    exportHtml: 'Export HTML',
    exportTxt: 'Export TXT',
    help: 'Help',
    about: 'About PlotFlow',
    docs: 'Documentation',
  },
};

function sendToRenderer(channel: MenuEventChannel, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (win?.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function buildMenu(language: AppMenuLanguage = 'zh-CN'): Menu {
  const text = labels[language] ?? labels['zh-CN'];

  const template: MenuItemConstructorOptions[] = [
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
    {
      label: text.file,
      submenu: [
        {
          label: text.new,
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.fileNew),
        },
        {
          label: text.open,
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.fileOpen),
        },
        { type: 'separator' },
        {
          label: text.save,
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.fileSave),
        },
        {
          label: text.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.fileSaveAs),
        },
        { type: 'separator' },
        ...(IS_MAC
          ? []
          : [
              {
                label: text.quit,
                accelerator: 'Alt+F4',
                click: () => app.quit(),
              },
            ]),
      ],
    },
    {
      label: text.edit,
      submenu: [
        {
          label: text.undo,
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.editUndo),
        },
        {
          label: text.redo,
          accelerator: IS_MAC ? 'Cmd+Shift+Z' : 'CmdOrCtrl+Y',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.editRedo),
        },
        { type: 'separator' },
        { label: text.cut, accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: text.copy, accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: text.paste, accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: text.selectAll, accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
        { type: 'separator' },
        {
          label: text.find,
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.editFind),
        },
        {
          label: text.replace,
          accelerator: 'CmdOrCtrl+H',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.editReplace),
        },
      ],
    },
    {
      label: text.view,
      submenu: [
        {
          label: text.outline,
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.viewToggleOutline),
        },
        {
          label: text.branchGraph,
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.viewToggleGraph),
        },
        {
          label: text.problems,
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.viewToggleProblems),
        },
        { type: 'separator' },
        {
          label: text.themeCenter,
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.viewThemeBrowser),
        },
      ],
    },
    {
      label: text.export,
      submenu: [
        {
          label: text.exportJson,
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.exportJson),
        },
        {
          label: text.exportHtml,
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.exportHtml),
        },
        {
          label: text.exportTxt,
          accelerator: 'CmdOrCtrl+Alt+E',
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.exportTxt),
        },
      ],
    },
    {
      label: text.help,
      submenu: [
        ...(IS_MAC
          ? []
          : [
              {
                label: text.about,
                click: () => sendToRenderer(IPC_CHANNELS.menu.events.helpAbout),
              },
              { type: 'separator' as const },
            ]),
        {
          label: text.docs,
          click: () => sendToRenderer(IPC_CHANNELS.menu.events.helpDocs),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
