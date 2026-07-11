import { createOfficialGraphNodeCard } from './OfficialGraphNodeCard';

const STATUS_KEY = {
  normal: 'themeNode.status.normal',
  orphan: 'themeNode.status.orphan',
  deadend: 'themeNode.status.deadend',
  error: 'themeNode.status.error',
  root: 'themeNode.status.root',
} as const;

/** 棱镜铸造台的高可读性节点投影，交互由官方共享 Slot 提供。 */
export const PrismFoundryNodeCard = createOfficialGraphNodeCard({
  themeId: 'plotflow-prism-foundry',
  variant: 'prism-foundry',
  statusLabel: (status, text) => text(STATUS_KEY[status]),
  bodyPreviewLength: 72,
  untitledTitle: (text) => text('themeNode.untitled'),
  renameFallbackTitle: (nodeTitle, text) => nodeTitle || text('themeNode.untitled'),
  emptyBody: (text) => text('themeNode.noBody'),
  headerClassName: 'prism-foundry-node__header',
  renderNodeMeta: ({ status, conditionCount, text }) => (
    <div
      className="official-graph-node__telemetry prism-foundry-node__signal"
      aria-label={text(`themeNode.status.${status}`)}
    >
      <span>{text(`themeNode.status.${status}`)}</span>
      <span>
        {conditionCount > 0
          ? text('themeNode.gatedCount', { count: conditionCount })
          : text('themeNode.clearRoute')}
      </span>
    </div>
  ),
  rewriteHeading: (lineContent, oldTitle, newTitle) => {
    if (oldTitle && lineContent.includes(oldTitle)) {
      return lineContent.replace(oldTitle, newTitle);
    }

    const replaced = lineContent.replace(/^(#{1,6}\s*[^:：]*[:：]\s*).*$/, `$1${newTitle}`);
    return replaced === lineContent ? `## 节点：${newTitle}` : replaced;
  },
  testId: 'prism-foundry-story-node',
});
