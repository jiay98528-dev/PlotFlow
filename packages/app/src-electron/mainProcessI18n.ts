import type { AppMenuLanguage } from './menu';

export interface MainProcessMessages {
  readonly openStoryTitle: string;
  readonly allFiles: string;
  readonly saveStoryTitle: string;
  readonly exportTitle: string;
  readonly chooseWorkspaceTitle: string;
  readonly okButton: string;
  readonly rendererCrashMessage: string;
  readonly rendererCrashDetail: string;
  readonly rendererCrashButtons: readonly [string, string];
  readonly unsavedMessage: string;
  readonly unsavedButtons: readonly [string, string, string];
  readonly unsavedDetail: (filePath: string | null) => string;
  readonly systemOpenFailedMessage: string;
  readonly systemOpenFailedDetail: (filePath: string, code: string) => string;
}

const messages: Record<AppMenuLanguage, MainProcessMessages> = {
  'zh-CN': {
    openStoryTitle: '打开 PlotFlow 故事文件',
    allFiles: '所有文件',
    saveStoryTitle: '保存 PlotFlow 故事文件',
    exportTitle: '导出 PlotFlow 文件',
    chooseWorkspaceTitle: '选择 PlotFlow 工作区',
    okButton: '确定',
    rendererCrashMessage: '编辑器渲染进程意外退出',
    rendererCrashDetail: '可以尝试重新加载编辑器。尚未写入磁盘的内容可能无法恢复。',
    rendererCrashButtons: ['重新加载', '关闭'],
    unsavedMessage: '有未保存的更改',
    unsavedButtons: ['保存', '不保存', '取消'],
    unsavedDetail: (filePath) => filePath
      ? `“${filePath}”有未保存的更改。退出前是否保存？`
      : '未命名文件有未保存的更改。退出前是否保存？',
    systemOpenFailedMessage: '无法打开故事文件',
    systemOpenFailedDetail: (filePath, code) => `文件：${filePath}\n错误代码：${code}`,
  },
  'en-US': {
    openStoryTitle: 'Open PlotFlow Story',
    allFiles: 'All Files',
    saveStoryTitle: 'Save PlotFlow Story',
    exportTitle: 'Export PlotFlow File',
    chooseWorkspaceTitle: 'Choose PlotFlow Workspace',
    okButton: 'OK',
    rendererCrashMessage: 'The editor process exited unexpectedly',
    rendererCrashDetail: 'Try reloading the editor. Changes not yet written to disk may be lost.',
    rendererCrashButtons: ['Reload', 'Close'],
    unsavedMessage: 'You have unsaved changes',
    unsavedButtons: ['Save', "Don't Save", 'Cancel'],
    unsavedDetail: (filePath) => filePath
      ? `“${filePath}” has unsaved changes. Save before quitting?`
      : 'The untitled story has unsaved changes. Save before quitting?',
    systemOpenFailedMessage: 'Could not open story file',
    systemOpenFailedDetail: (filePath, code) => `File: ${filePath}\nError code: ${code}`,
  },
};

export function getMainProcessMessages(language: AppMenuLanguage): MainProcessMessages {
  return messages[language] ?? messages['zh-CN'];
}
