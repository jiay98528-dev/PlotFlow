export type Locale = 'zh-CN' | 'en-US';
export type TranslationKey = string;

type TranslationValue = string | { readonly [key: string]: TranslationValue };
type TranslationTree = Readonly<Record<string, TranslationValue>>;

const resources: Readonly<Record<Locale, TranslationTree>> = {
  'zh-CN': {
    menu: {
      file: '文件',
      edit: '编辑',
      view: '视图',
      export: '导出',
      help: '帮助',
    },
    toolbar: {
      newFile: '新建',
      save: '保存',
      export: '导出',
      graph: '分支图',
      graphMinimap: '缩略图',
      graphSplit: '并列',
      themeLight: '亮色',
      themeDark: '暗色',
      language: '语言',
      preferences: '偏好设置',
      corpus: '语料',
    },
    statusBar: {
      saved: '已保存',
      saving: '保存中...',
      unsaved: '未保存',
      nodes: '节点',
      zoom: '缩放',
      phase: 'M6 模板与主题',
    },
    panels: {
      outline: '大纲',
      problems: '问题',
      conditions: '条件编辑器',
    },
    dialogs: {
      newFile: '新建文件',
      export: '导出',
      settings: '设置',
      close: '关闭',
      cancel: '取消',
      create: '创建',
      title: '标题',
      author: '作者',
      preview: '预览',
      template: '模板',
      templateMeta: '模板信息',
      blankFile: '空白文件',
    },
    templates: {
      rpg: 'RPG 对话',
      visualNovel: '视觉小说',
      puzzle: '解谜逃脱',
      godot: 'Godot 示例',
    },
    errors: {
      E001: '目标节点未定义',
      E002: '变量未声明',
      E003: '枚举值非法',
      E004: '类型不匹配',
      E005: '语法解析失败',
      E006: '嵌套深度超限',
      E007: '节点ID重名',
      E008: '变量重复声明',
      E009: '故事结构不可导出',
    },
    warnings: {
      W001: '孤立节点',
      W002: '死胡同节点',
      W003: '未使用变量',
      W004: '重复选项描述',
      W005: '空描述节点',
      W006: '格式不规范',
    },
    suggestions: {
      I001: '可能卡关',
      I002: '描述过短',
      I003: '无章节归属',
    },
  },
  'en-US': {
    menu: {
      file: 'File',
      edit: 'Edit',
      view: 'View',
      export: 'Export',
      help: 'Help',
    },
    toolbar: {
      newFile: 'New',
      save: 'Save',
      export: 'Export',
      graph: 'Graph',
      graphMinimap: 'Thumbnail',
      graphSplit: 'Side by side',
      themeLight: 'Light',
      themeDark: 'Dark',
      language: 'Language',
      preferences: 'Preferences',
      corpus: 'Corpus',
    },
    statusBar: {
      saved: 'Saved',
      saving: 'Saving...',
      unsaved: 'Unsaved',
      nodes: 'Nodes',
      zoom: 'Zoom',
      phase: 'M6 Templates & Theme',
    },
    panels: {
      outline: 'Outline',
      problems: 'Problems',
      conditions: 'Condition Editor',
    },
    dialogs: {
      newFile: 'New File',
      export: 'Export',
      settings: 'Settings',
      close: 'Close',
      cancel: 'Cancel',
      create: 'Create',
      title: 'Title',
      author: 'Author',
      preview: 'Preview',
      template: 'Template',
      templateMeta: 'Template Info',
      blankFile: 'Blank File',
    },
    templates: {
      rpg: 'RPG Dialogue',
      visualNovel: 'Visual Novel',
      puzzle: 'Puzzle Escape',
      godot: 'Godot Example',
    },
    errors: {
      E001: 'Target node is undefined',
      E002: 'Variable is not declared',
      E003: 'Invalid enum value',
      E004: 'Type mismatch',
      E005: 'Syntax parse failed',
      E006: 'Nested depth exceeded',
      E007: 'Duplicate node ID',
      E008: 'Duplicate variable declaration',
      E009: 'Story structure cannot be exported',
    },
    warnings: {
      W001: 'Orphan node',
      W002: 'Dead-end node',
      W003: 'Unused variable',
      W004: 'Duplicate option description',
      W005: 'Empty node body',
      W006: 'Irregular formatting',
    },
    suggestions: {
      I001: 'Possible softlock',
      I002: 'Description too short',
      I003: 'Missing chapter',
    },
  },
};

let currentLocale: Locale = 'zh-CN';
const subscribers = new Set<(locale: Locale) => void>();

function resolveValue(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let cursor: TranslationValue | undefined = tree;

  for (const part of parts) {
    if (!cursor || typeof cursor === 'string') return undefined;
    cursor = cursor[part];
  }

  return typeof cursor === 'string' ? cursor : undefined;
}

export function getLanguage(): Locale {
  return currentLocale;
}

export function changeLanguage(locale: Locale): void {
  currentLocale = locale;
  for (const subscriber of subscribers) {
    try {
      subscriber(locale);
    } catch {
      // 单个订阅者失败不影响其他订阅者
    }
  }
}

export function subscribeLanguage(
  listener: (locale: Locale) => void,
): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function t(key: string, locale: Locale = currentLocale): string {
  return (
    resolveValue(resources[locale], key) ??
    resolveValue(resources['en-US'], key) ??
    key
  );
}

export function getTranslations(locale: Locale): TranslationTree {
  return resources[locale];
}
