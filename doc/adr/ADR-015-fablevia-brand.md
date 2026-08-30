# ADR-015: Fablevia（维叙）品牌与 PlotFlow 兼容命名空间

> 日期：2026-07-17  
> 状态：已接受

## 背景

产品对外名称由 PlotFlow 变更为 Fablevia，中文名为“维叙”。已有 `.mdstory` 文件、Schema、引擎集成、主题包、IPC 和用户偏好已使用 `plotflow` 作为持久技术标识，全量改名会破坏旧故事、插件和已安装用户的升级路径。

## 决策

- 产品品牌为 **Fablevia（维叙）**。中文界面以“维叙”为主名、`Fablevia` 为小字辅助；英文界面只显示 `Fablevia`。
- 用户可见的桌面应用、安装器、官网、帮助、主题和引擎插件文案使用新品牌。
- `plotflow` 保留为兼容技术命名空间：包名、类型名、Schema URL、frontmatter 字段、IPC、环境变量、本地存储键、主题 ID/协议和引擎 API 不变。
- `com.plotflow.app`、NSIS GUID 和旧 `%APPDATA%/PlotFlow` 用户数据目录保持不变，用于原位升级与数据保留。
- 历史 ADR、CHANGELOG 历史段、Schema 0.1 快照、审计报告和不可变 evidence 不重写。

## 后果

新用户只在正常产品界面中看到 Fablevia/维叙，旧项目和插件则继续使用稳定的 `plotflow` 合同。每次发行的可见旧品牌扫描必须区分用户文案与兼容标识，不得以机械全局替换损坏合同。

## 替代方案

- **全量改名技术标识：** 会破坏 Schema、引擎 API、主题和用户偏好，否决。
- **作为新应用并排安装：** 会分裂用户数据和文件关联，否决。
- **继续对外显示 PlotFlow：** 与已确认品牌决策冲突，否决。
