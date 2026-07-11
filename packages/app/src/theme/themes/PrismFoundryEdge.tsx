import { createOfficialGraphEdge } from './OfficialGraphEdge';

/** 棱镜铸造台的青色信号路线，保持官方共用的条件边和命中区合同。 */
export const PrismFoundryEdge = createOfficialGraphEdge({
  themeId: 'plotflow-prism-foundry',
  variant: 'prism-foundry',
  hitAreaWidth: 42,
  testId: 'prism-foundry-story-edge',
});
