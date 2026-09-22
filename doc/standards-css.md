# CSS、Token 与层级规范

> 文档导航：[交互、主题与视觉索引](indexes/design.md) · [总索引](INDEX.md)

## 真实入口

| 文件 | 职责 |
|---|---|
| [tokens-light.css](../packages/app/src/styles/tokens-light.css) / [tokens-dark.css](../packages/app/src/styles/tokens-dark.css) | 基础亮暗色 token |
| [global.css](../packages/app/src/styles/global.css) | 全局基础样式 |
| [official-themes.css](../packages/app/src/styles/official-themes.css) | 官方主题共享样式 |
| [theme-platform](../packages/app/src/theme-platform/types.ts) | ThemeDescriptor、Surface、Slot 和 token 合同 |
| [stylelint.config.js](../stylelint.config.js) | 实际 CSS 检查配置 |

## 使用规则

- 组件使用已有 CSS 变量，不写裸 hex 色值，不复制硬编码的亮暗两套组件样式。
- 主题参数使用 --theme-* / --theme-ux-*；基础颜色、间距、字体、圆角、阴影、动效和层级使用各自语义 token。
- 同一语义复用同一 token，不为单个元素随意新增重复变量。
- 类名使用 kebab-case 或现有 BEM 形式；不使用 ID 选择器覆盖组件样式。
- 不随意增加 !important。配置中 branch-graph.css 的例外服务于已有图形库样式，不能推广到其他组件。
- 十六进制颜色只在实际配置允许的 token 文件中定义；不要把例外扩展到 TSX 或普通组件 CSS。

## 主题与叠层

主题通过 CSS 变量和 Theme Platform 切换。新增 Surface、Slot 或主题能力遵循 [主题开发标准](standards-theme-development.md)，不能改变保存与故事语义。

菜单、画布浮层、Panel、Modal 使用现有语义层级 token；焦点与点击命中应跟随真实布局。避免手写超大 z-index 把错误的挂载层级掩盖起来。

## 响应式与可访问性

以 [UX 简报](../spec/design-brief-editor-ux.md) 的断点与画布优先规则为准。窄屏切换抽屉而不是把全部面板纵向堆叠。减少动效模式必须生效，状态不能只靠颜色，文本与控件对比度遵循主题标准。

## 定向验证

样式检查使用根 lint:css；颜色、层级与包体检查分别使用 lint:tokens、lint:layers、lint:bundle。只运行本次变化需要的检查。GUI 几何和键盘变化用后台隔离 E2E 或隔离 CI，不启动抢占桌面的测试。
