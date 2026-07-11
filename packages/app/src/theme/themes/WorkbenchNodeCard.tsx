import { createOfficialGraphNodeCard } from './OfficialGraphNodeCard';

const STATUS_LABEL: Record<string, string> = {
  normal: '节点',
  orphan: '孤立',
  deadend: '死胡同',
  error: '错误',
  root: '起点',
};

export const WorkbenchNodeCard = createOfficialGraphNodeCard({
  themeId: 'plotflow-narrative-workbench',
  variant: 'workbench',
  statusLabel: (status) => STATUS_LABEL[status],
  bodyPreviewLength: 68,
  untitledTitle: () => '未命名节点',
  renameFallbackTitle: (nodeTitle) => nodeTitle || '未命名节点',
  emptyBody: () => '还没有正文，选中后在 Inspector 中补写。',
  rewriteHeading: (lineContent, oldTitle, newTitle) =>
    lineContent.includes(oldTitle)
      ? lineContent.replace(oldTitle, newTitle)
      : lineContent.replace(/## 节点：.*/, `## 节点：${newTitle}`),
});
