# Fablevia（维叙）

本地优先的叙事分支工作台。用图形界面编排故事，把可读的故事文件和干净的 JSON 交给游戏引擎。

## 创作工作流

打开或创建 .mdstory，默认进入 Graph Lab。在画布中创建章节、节点与连线，通过 Inspector 编辑正文、选项、条件、效果及变量。Source Drawer 提供章节源码，Split 提供完整源码编辑；两个工作区始终编辑同一个故事文件。

- 本地文件保存与撤销重做，故事无需云端服务。
- 诊断与节点定位，及时发现断链、变量与条件问题。
- JSON / HTML / TXT 导出；HTML 可独立试玩。
- Godot 编辑器插件与运行时；Unity 读取参考和 Unreal 数据接口。
- 本地 N-gram 补全、语料导入与学习。
- 中文与英文界面，棱镜铸造台、叙事工作台、引擎遥测台三套内置主题。

## 开发

需要 Node.js 22.13+、pnpm 11.5.1 和 Windows 桌面环境进行 Electron GUI 验证。

~~~powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd --filter @plotflow/app test:e2e:background
pnpm.cmd package:win
~~~

版本来自 package.json；当前为 0.1.1 Preview。开发状态、验证结果和后续范围统一见 [spec/progress.md](spec/progress.md)。本地整理后的安装包和源码快照位于 release/baseline。

Windows 本地 E2E 使用独立隐藏桌面，不切换用户正在使用的桌面。此入口运行应用集成测试；需要全局系统输入的原生对话框黑盒继续在隔离机器或 CI 中运行。日志写入 .tmp/background-e2e。

## 目录与文档

| 路径 | 用途 |
|---|---|
| packages/app | Electron 主进程、React 编辑器与 GUI 测试 |
| packages/core | 解析、诊断、导出、模板与离线补全 |
| packages/feedback-service | 独立反馈服务及部署配置 |
| addons/plotflow、plugins、templates | 引擎接入与示例 |
| website | 独立官网源码与设计基线 |
| [PRD.md](PRD.md) | 当前产品需求与范围 |
| [doc/TAD.md](doc/TAD.md) | 当前技术架构与入口 |
| [spec/design-brief-editor-ux.md](spec/design-brief-editor-ux.md) | 桌面 UX 合同 |
| [doc/standards-theme-development.md](doc/standards-theme-development.md) | 内置主题开发标准 |
| [spec/syntax-formal.md](spec/syntax-formal.md) | 故事文本语法 |
| [spec/json-schema.md](spec/json-schema.md) | JSON 数据合同 |

## 使用与授权

项目采用专有许可。商业定价策略为 $29 买断；交易、授权与公开下载入口的建设范围在 PRD 中单独管理。
