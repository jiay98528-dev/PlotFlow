import type { ProjectStatus } from '../types';

export const fallbackProjectStatus: ProjectStatus = {
  generatedAt: 'not-generated',
  summary: {
    version: '—',
    channel: '—',
    lastUpdated: '—',
  },
  releaseGates: [
    {
      name: 'project-status-load',
      zhName: '项目状态数据',
      status: 'neutral',
      result: 'Not loaded',
      zhResult: '未加载',
      detail: 'Project status data failed to load. Run sync:data or check the deployment path.',
      zhDetail: '项目状态数据加载失败，请重新运行 sync:data 或检查部署路径。',
    },
  ],
  stableFeatures: [],
  experimentalFeatures: [],
  roadmap: [],
  sourceRefs: ['spec/progress.md'],
};
