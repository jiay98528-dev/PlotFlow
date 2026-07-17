import type { AppMenuLanguage } from './menu';

export interface MainProcessMessages {
  readonly productName: string;
  readonly storyFileType: string;
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
  readonly closeFailureMessage: string;
  readonly closeFailureDetail: (stage: 'query' | 'save' | 'discard', reason: string) => string;
  readonly closeFailureButtons: readonly [string, string, string];
}

const messages: Record<AppMenuLanguage, MainProcessMessages> = {
  'zh-CN': {
    productName: '维叙（Fablevia）',
    storyFileType: '维叙故事文件',
    openStoryTitle: '打开维叙（Fablevia）故事文件',
    allFiles: '所有文件',
    saveStoryTitle: '保存维叙（Fablevia）故事文件',
    exportTitle: '导出维叙（Fablevia）文件',
    chooseWorkspaceTitle: '选择维叙（Fablevia）工作区',
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
    closeFailureMessage: '无法安全关闭维叙（Fablevia）',
    closeFailureDetail: (stage, reason) => `${stage === 'query' ? '读取未保存状态' : stage === 'save' ? '保存故事' : '恢复外部文件后放弃更改'}失败。窗口将保持打开。\n\n${reason}`,
    closeFailureButtons: ['重试', '强制退出', '取消'],
  },
  'en-US': {
    productName: 'Fablevia',
    storyFileType: 'Fablevia Story',
    openStoryTitle: 'Open Fablevia Story',
    allFiles: 'All Files',
    saveStoryTitle: 'Save Fablevia Story',
    exportTitle: 'Export Fablevia File',
    chooseWorkspaceTitle: 'Choose Fablevia Workspace',
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
    closeFailureMessage: 'Fablevia cannot close safely',
    closeFailureDetail: (stage, reason) => `${stage === 'query' ? 'Reading the unsaved state' : stage === 'save' ? 'Saving the story' : 'Restoring the external file before discarding changes'} failed. The window will remain open.\n\n${reason}`,
    closeFailureButtons: ['Retry', 'Force Quit', 'Cancel'],
  },
};

export function getMainProcessMessages(language: AppMenuLanguage): MainProcessMessages {
  return messages[language] ?? messages['zh-CN'];
}
