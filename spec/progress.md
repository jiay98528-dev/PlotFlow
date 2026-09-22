# Fablevia 当前开发状态

> 文档导航：[状态、验证与部署索引](../doc/indexes/delivery.md) · [总索引](../doc/INDEX.md)

> 更新：2026-09-22。软件版本：0.1.1 Preview。当前阶段：Windows 开发基线。

## 当前范围

| 模块 | 当前状态 |
|---|---|
| 图形创作 | Graph Lab 默认入口；章节、节点、连线、条件、效果、变量、Inspector 与 Source Drawer 已实现 |
| 源码与数据 | Split 完整源码投影；.mdstory 是唯一磁盘真相源，保存与草稿事务共用会话身份 |
| 解析与导出 | 诊断、JSON Schema 0.2、HTML 试玩版、TXT；引擎读取兼容 0.1/0.2 |
| 引擎接入 | Godot 插件与运行时、Unity 读取参考、Unreal 数据接口；真实引擎运行在下一阶段继续核对 |
| 补全 | 本地 N-gram、语料导入和学习；中文约 45KB、英文约 30KB，扩容尚未实现 |
| 主题 | 棱镜铸造台（默认）、叙事工作台、引擎遥测台；远程代码主题已停用 |
| 反馈 | Help 菜单反馈窗口与独立 HTTPS 服务已实现；本轮不变更线上部署 |
| 官网 | 现有页面与当前状态同步；新落地页视觉方向已定义，尚未实现新设计与公开获取入口 |

## 最近源码与产物验证（2026-09-22）

| 命令 | 结果 | 范围 |
|---|---|---|
| `pnpm.cmd test` | PASS | 103 个测试文件 / 1548 条单元测试 |
| `pnpm.cmd build` | PASS | Electron 主进程、preload、renderer 生产构建 |
| `pnpm.cmd typecheck` | PASS | TypeScript strict 检查 |
| `pnpm.cmd --filter @plotflow/app test:e2e:background` | PASS | Windows 独立隐藏桌面完整运行 92/92 通过（3.5 分钟），测试窗口未进入用户 Default 桌面 |
| `pnpm.cmd package:win` | PASS | 使用本地 Electron 42.10.1 分发目录生成 0.1.1 Windows 安装器与解包应用 |
| `pnpm.cmd --filter @plotflow/app test:e2e:unpacked` | PASS | 当前 EXE 的 17 项黑盒全部通过，包含原生打开/保存/导出、重开、HTML 试玩与 100/500/1000 节点路径 |
| `pnpm.cmd lint` | PASS | 0 error，9 个既有 no-console warning |
| `pnpm.cmd --dir packages/feedback-service test` | PASS | 5 个文件 / 32 条反馈服务测试 |
| `pnpm.cmd test:engine-contract` | PASS | 6 项引擎数据合同测试，不等同于真实引擎运行 |
| `node.exe --test scripts/run-app-e2e.test.mjs` | PASS | 4 项测试，含真实 Playwright 命令入口回归 |
| `pnpm.cmd --dir website test` | PASS | 7 项网站测试 |
| `pnpm.cmd --dir website build` | PASS | 网站类型检查与生产构建；静态降级构建也通过 |

## 本轮修复与清理

- 修复打包黑盒入口漏传 Playwright test 子命令，避免 unpacked/installed 检查尚未启动就退出。
- Graph Lab 测试每例使用独立应用和 profile；主题测试不再申请未使用的 Chromium 页面。
- E2E 命令直接执行 Node 预检查，消除嵌套 pnpm 的 PATH 依赖。
- 新增 windows-e2e-background.ps1：应用集成测试运行于独立隐藏桌面，启动前验证桌面身份；原生对话框黑盒仍在隔离机器或 CI 执行，避免全局输入抢占用户操作。
- 官网状态直接读取本文件与 package.json；移除硬编码历史 PASS、旧完成百分比和历史审计看板，构建时自动同步。
- 精简并校正产品、架构、主题与开发规则；旧候选、审计报告、交接文档及临时输出退出开发目录。

## 当前开发交付

- 当前交付目录为 release/baseline；源码快照对应提交见其中的 baseline.json。
- 目录只保留当前安装包、解包应用、同轮源码快照与简短交付说明，历史候选退出开发目录。
- Git 保留旧审计、阶段交接与实验历史，当前目录不维护重复的过程报告或历史看板。
- 不用旧的 142 项统计推断当前产品完成比例。
- 当前为本地开发基线。安装态系统集成、真实引擎运行及公共发行签名按后续目标分别执行。

## 文档维护

[总索引](../doc/INDEX.md) → 五个分类索引 → 28 份正文。当前索引已覆盖全部自有 Markdown 文档，本地链接、分类归属和正文返回导航已校验。历史过程与草稿退出源码树，机器合同和在用测试资产保留。后续增删文档同步对应分类；索引不复制运行数字。

## 下一阶段

1. 完成官网真实产品演示与 Windows 预览版获取入口。
2. 完善最小 Godot 项目，核对真实故事加载、条件和变量效果。
3. 制作首次启动引导。

macOS/Linux、自动更新、Unity 示例场景和语料扩充独立排期。可执行远程主题不恢复；若将来需要远程主题，按 ADR-016 重新设计声明式格式。
