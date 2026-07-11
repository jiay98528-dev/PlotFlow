/**
 * PlotFlow Theme Platform — CSS 自定义属性目录
 *
 * 本文档按类别列出所有 --theme-* CSS 自定义属性及含义。
 * 每个新增主题的 ThemeTokens.shared / light / dark 都必须提供这些变量。
 *
 * 生命周期：
 * - engine.ts `applyThemeToRoot()` 清除所有现有 --theme-* 变量
 * - 合并 ThemeTokens.shared + ThemeTokens[mode] 后写入 document.documentElement
 * - 布局维度变量 (--theme-graph-lab-*) 由 layoutRecipe.graphLab 计算
 *
 * @module theme-platform/tokens
 */

// ============================================================================
// 蓝图网格
// ============================================================================

/**
 * 蓝图画布网格图案。
 * 通常为 CSS gradient 组合：linear-gradient 横线 + linear-gradient 竖线。
 *
 * @example
 * 'linear-gradient(90deg, oklch(...) 1px, transparent 1px),
 *  linear-gradient(0deg, oklch(...) 1px, transparent 1px)'
 */
export const TOKEN_BLUEPRINT_CANVAS = '--theme-blueprint-canvas' as const;

/** 蓝图网格单元尺寸 (px)。 */
export const TOKEN_GRID_SIZE = '--theme-grid-size' as const;

// ============================================================================
// 背景 / 表面
// ============================================================================

/** Graph Lab 画布纸色（背景底色）。 */
export const TOKEN_GRAPH_LAB_PAPER = '--theme-graph-lab-paper' as const;

/** Graph Lab 面板/表面色（比 paper 略亮或略暗的色调）。 */
export const TOKEN_GRAPH_LAB_SURFACE = '--theme-graph-lab-surface' as const;

/** 面板/侧栏背景色（含透明度以实现毛玻璃效果）。 */
export const TOKEN_PANEL_SURFACE = '--theme-panel-surface' as const;

// ============================================================================
// 节点卡片
// ============================================================================

/** 节点卡片背景色。 */
export const TOKEN_NODE_SURFACE = '--theme-node-surface' as const;

/** 节点卡片边框色。 */
export const TOKEN_NODE_BORDER = '--theme-node-border' as const;

/** 节点卡片主文字色（标题、高亮信息）。 */
export const TOKEN_NODE_INK = '--theme-node-ink' as const;

/** 节点卡片次要文字色（章节标签、正文预览、元数据）。 */
export const TOKEN_NODE_MUTED = '--theme-node-muted' as const;

/** 节点卡片圆角半径。 */
export const TOKEN_CARD_RADIUS = '--theme-card-radius' as const;

// ============================================================================
// 连线 / 线缆
// ============================================================================

/** 默认连线（无条件 jump）的颜色。 */
export const TOKEN_GRAPH_CABLE_DEFAULT = '--theme-graph-cable-default' as const;

/** 条件连线（有 [条件：...] 的 jump）的颜色。 */
export const TOKEN_GRAPH_CABLE_CONDITIONAL = '--theme-graph-cable-conditional' as const;

// ============================================================================
// 端口 / Handle
// ============================================================================

/** Handle 端口填充色。 */
export const TOKEN_PORT_FILL = '--theme-port-fill' as const;

// ============================================================================
// 阴影
// ============================================================================

/**
 * 节点卡片/面板的投影。
 * 亮色主题通常为暖色浅阴影，暗色主题为深色强阴影。
 */
export const TOKEN_WORKBENCH_SHADOW = '--theme-workbench-shadow' as const;

// ============================================================================
// 布局维度（由 engine.ts 从 layoutRecipe.graphLab 计算写入）
// ============================================================================

/** Graph Lab 左侧 Palette 宽度 (px)。 */
export const TOKEN_GRAPH_LAB_PALETTE_WIDTH = '--theme-graph-lab-palette-width' as const;

/** Graph Lab 左侧大纲 Rail 宽度 (px)。 */
export const TOKEN_GRAPH_LAB_RAIL_WIDTH = '--theme-graph-lab-rail-width' as const;

/** Graph Lab 右侧 Inspector 宽度 (px)。 */
export const TOKEN_GRAPH_LAB_INSPECTOR_WIDTH = '--theme-graph-lab-inspector-width' as const;

/** Graph Lab 底部 Source Drawer 高度 (px)。 */
export const TOKEN_GRAPH_LAB_SOURCE_DOCK_HEIGHT = '--theme-graph-lab-source-dock-height' as const;

// ============================================================================
// 分类索引
// ============================================================================

/** 所有 --theme-* CSS 自定义属性键名。 */
export const ALL_THEME_TOKEN_KEYS = [
  // 蓝图网格
  TOKEN_BLUEPRINT_CANVAS,
  TOKEN_GRID_SIZE,
  // 背景
  TOKEN_GRAPH_LAB_PAPER,
  TOKEN_GRAPH_LAB_SURFACE,
  TOKEN_PANEL_SURFACE,
  // 节点
  TOKEN_NODE_SURFACE,
  TOKEN_NODE_BORDER,
  TOKEN_NODE_INK,
  TOKEN_NODE_MUTED,
  TOKEN_CARD_RADIUS,
  // 连线
  TOKEN_GRAPH_CABLE_DEFAULT,
  TOKEN_GRAPH_CABLE_CONDITIONAL,
  // 端口
  TOKEN_PORT_FILL,
  // 阴影
  TOKEN_WORKBENCH_SHADOW,
  // 布局
  TOKEN_GRAPH_LAB_PALETTE_WIDTH,
  TOKEN_GRAPH_LAB_RAIL_WIDTH,
  TOKEN_GRAPH_LAB_INSPECTOR_WIDTH,
  TOKEN_GRAPH_LAB_SOURCE_DOCK_HEIGHT,
] as const;

/**
 * 按类别组织的 token 索引。
 * 用于文档查阅和新增主题时的校验参考。
 */
export const THEME_TOKEN_CATALOG = {
  grid: [TOKEN_BLUEPRINT_CANVAS, TOKEN_GRID_SIZE],
  background: [TOKEN_GRAPH_LAB_PAPER, TOKEN_GRAPH_LAB_SURFACE, TOKEN_PANEL_SURFACE],
  node: [TOKEN_NODE_SURFACE, TOKEN_NODE_BORDER, TOKEN_NODE_INK, TOKEN_NODE_MUTED, TOKEN_CARD_RADIUS],
  cable: [TOKEN_GRAPH_CABLE_DEFAULT, TOKEN_GRAPH_CABLE_CONDITIONAL],
  port: [TOKEN_PORT_FILL],
  shadow: [TOKEN_WORKBENCH_SHADOW],
  layout: [TOKEN_GRAPH_LAB_PALETTE_WIDTH, TOKEN_GRAPH_LAB_RAIL_WIDTH, TOKEN_GRAPH_LAB_INSPECTOR_WIDTH, TOKEN_GRAPH_LAB_SOURCE_DOCK_HEIGHT],
} as const;
