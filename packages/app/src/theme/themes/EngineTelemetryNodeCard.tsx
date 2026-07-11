import { createOfficialGraphNodeCard } from './OfficialGraphNodeCard';

const STATUS_LABEL: Record<string, string> = {
  normal: 'SYNC',
  orphan: 'OPEN',
  deadend: 'END',
  error: 'ERR',
  root: 'ROOT',
};

export const EngineTelemetryNodeCard = createOfficialGraphNodeCard({
  themeId: 'plotflow-engine-telemetry',
  variant: 'engine-telemetry',
  statusLabel: (status) => STATUS_LABEL[status] ?? 'SYNC',
  bodyPreviewLength: 76,
  untitledTitle: (text) => text('themeNode.untitled'),
  renameFallbackTitle: (nodeTitle, text) => nodeTitle || text('themeNode.untitled'),
  emptyBody: (text) => text('themeNode.noBody'),
  headerClassName: 'official-graph-node__telemetry-header',
  renderNodeMeta: ({ status, conditionCount, text }) => (
    <div className="official-graph-node__telemetry" aria-label={text(`themeNode.status.${status}`)}>
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
});
