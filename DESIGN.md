# Fablevia（维叙）Design Context

> 品牌锁定区：中文 UI 主显示“维叙”、小字辅助 `Fablevia`；英文 UI 只显示 `Fablevia`。不再使用 `PF` 文字标记，沿用现有软件图标。

## Source of Truth

`spec/design-brief-editor-ux.md` 是 Fablevia（维叙）编辑器 UI/UX 的唯一真相源。本文仅为设计上下文入口，不能与该简报、主题开发标准或现有 token 体系竞争或覆盖。

## Product Surface

Fablevia（维叙）是本地优先的桌面叙事编辑器。Graph Lab 是主要且默认的创作工作区；Split 在顶栏并列保留，作为辅助与高级的完整源码投影。产品由 Home、Toolbar、Graph Lab、Split、Source Drawer、Theme Center 和诊断面板组成，默认语言为中文，并需完整覆盖英文主路径。

## Visual System

颜色通过现有 Design Token 与 `--theme-*` / `--theme-ux-*` 变量表达，组件中不写裸 hex。主题使用系统无衬线字体、紧凑而稳定的控件尺寸、清晰的 1px 分隔层级与语义化状态色。Node、Route、Condition、Effect 与 Diagnostic 必须保持信息优先级和可读性。

## Theme Direction

Graph Lab 的目标是 Codex 与 macOS 原生工具感融合的次世代游戏叙事工作台。主题可以替换外壳、主要布局 Surface、节点与连线，但不能改变 `.mdstory` 语义、解析、保存、导出或 Graph Lab 命令层。新主题的具体视觉决策应先回写到 UX 简报。

## Components & States

每个交互控件覆盖 default、hover、focus-visible、active、disabled，以及业务已有的 loading、error、success 状态。主题只在具备空间层级意义的区域使用材质效果，不能把表单、路线行和每张节点都变成装饰性玻璃卡。

## Motion & Responsiveness

动效传达状态、反馈和层级变化，不动画布局属性，不妨碍编辑。所有主题自有动效须提供减弱动效分支。Graph Lab 在桌面、窄笔记本和窄屏视口保持局部滚动、可读节点和无裁切的工具路径。
