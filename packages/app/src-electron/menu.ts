import {
  app,
  BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
} from 'electron';

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

function sendToRenderer(channel: string, ...args: unknown[]): void {
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
          click: () => sendToRenderer('menu:file:new'),
        },
        {
          label: text.open,
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu:file:open'),
        },
        { type: 'separator' },
        {
          label: text.save,
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu:file:save'),
        },
        {
          label: text.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu:file:saveAs'),
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
          click: () => sendToRenderer('menu:edit:undo'),
        },
        {
          label: text.redo,
          accelerator: IS_MAC ? 'Cmd+Shift+Z' : 'CmdOrCtrl+Y',
          click: () => sendToRenderer('menu:edit:redo'),
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
          click: () => sendToRenderer('menu:edit:find'),
        },
        {
          label: text.replace,
          accelerator: 'CmdOrCtrl+H',
          click: () => sendToRenderer('menu:edit:replace'),
        },
      ],
    },
    {
      label: text.view,
      submenu: [
        {
          label: text.outline,
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToRenderer('menu:view:toggleOutline'),
        },
        {
          label: text.branchGraph,
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendToRenderer('menu:view:toggleGraph'),
        },
        {
          label: text.problems,
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => sendToRenderer('menu:view:toggleProblems'),
        },
        { type: 'separator' },
        {
          label: text.themeCenter,
          click: () => sendToRenderer('menu:view:themeBrowser'),
        },
      ],
    },
    {
      label: text.export,
      submenu: [
        {
          label: text.exportJson,
          accelerator: 'CmdOrCtrl+E',
          click: () => sendToRenderer('menu:export:json'),
        },
        {
          label: text.exportHtml,
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendToRenderer('menu:export:html'),
        },
        {
          label: text.exportTxt,
          accelerator: 'CmdOrCtrl+Alt+E',
          click: () => sendToRenderer('menu:export:txt'),
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
                click: () => sendToRenderer('menu:help:about'),
              },
              { type: 'separator' as const },
            ]),
        {
          label: text.docs,
          click: () => sendToRenderer('menu:help:docs'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
