/** IPC channels shared by Electron main, preload and renderer contracts. */
export const IPC_CHANNELS = {
  file: {
    open: 'file:open',
    save: 'file:save',
    saveAs: 'file:saveAs',
    export: 'file:export',
    getPendingOpenFile: 'file:getPendingOpenFile',
    systemOpenNotify: 'file:system-open-notify',
    externalChange: 'file:external-change',
    readByPath: 'file:readByPath',
    chooseWorkspaceFolder: 'file:chooseWorkspaceFolder',
    listWorkspaceStories: 'file:listWorkspaceStories',
    readWorkspaceStory: 'file:readWorkspaceStory',
  },
  dialog: { confirm: 'dialog:confirm' },
  theme: {
    listOfficialInstalled: 'theme:listOfficialInstalled',
    listOfficialRemote: 'theme:listOfficialRemote',
    downloadOfficialTheme: 'theme:downloadOfficialTheme',
    openThemeMarket: 'theme:openThemeMarket',
    openOfficialThemeStore: 'theme:openOfficialThemeStore',
  },
  menu: {
    setLanguage: 'menu:setLanguage',
    events: {
      fileNew: 'menu:file:new',
      fileOpen: 'menu:file:open',
      fileSave: 'menu:file:save',
      fileSaveAs: 'menu:file:saveAs',
      editUndo: 'menu:edit:undo',
      editRedo: 'menu:edit:redo',
      editFind: 'menu:edit:find',
      editReplace: 'menu:edit:replace',
      viewToggleOutline: 'menu:view:toggleOutline',
      viewToggleGraph: 'menu:view:toggleGraph',
      viewToggleProblems: 'menu:view:toggleProblems',
      viewThemeBrowser: 'menu:view:themeBrowser',
      exportJson: 'menu:export:json',
      exportHtml: 'menu:export:html',
      exportTxt: 'menu:export:txt',
      helpAbout: 'menu:help:about',
      helpDocs: 'menu:help:docs',
    },
  },
} as const;

type DeepStringValue<T> = T extends string
  ? T
  : T extends Readonly<Record<string, unknown>>
    ? DeepStringValue<T[keyof T]>
    : never;

export type IpcChannel = DeepStringValue<typeof IPC_CHANNELS>;
export type MenuEventChannel = DeepStringValue<typeof IPC_CHANNELS.menu.events>;

