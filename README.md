# Fablevia（维叙）

> **面向独立游戏开发者的叙事分支管理工具。**
>
> 默认在 Graph Lab 流程图工作区管理分支剧情，也可在 Split 中直接编辑 Markdown 方言（`.mdstory`），一键导出 JSON/HTML/TXT。
> 不锁死数据，不强制联网，$29 买断。

[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 这是什么？

维叙（Fablevia）是一款**本地优先的叙事分支编辑器**。Graph Lab 是主要且默认的创作工作区，用户在全屏流程图、节点面板、Inspector 和 Source Drawer 中完成 GUI 图形化创作；Split 在顶栏并列保留，作为辅助与高级的完整 Markdown 方言源码投影。`.mdstory` 始终是唯一磁盘真相源。

**目标用户**：独立游戏开发者（1-5 人团队）、游戏设计院校师生、视觉小说/互动小说制作者。

---

## 核心闭环

```
打开或创建 .mdstory → 默认在 Graph Lab 图形编辑 → 修复诊断 → 保存纯文本源文件 → 一键导出 → 引擎加载
```

---

## 功能亮点

| 模块 | 说明 |
|------|------|
| 📝 **Monaco 编辑器** | VS Code 内核，Fablevia 语法高亮 + 智能补全 |
| 🌳 **实时分支图** | React Flow 可拖拽节点图，文本 ↔ 图形双向同步 |
| 🧭 **Graph Lab** | 全屏流程图优先编辑，Palette 创建节点，Inspector 编辑内容/选项/条件/效果/变量，章节标签切换，Source Drawer 按章节切片编辑 |
| 🔧 **条件编辑器** | 双侧类型化操作数，支持 AND / OR / NOT、literal-left 与三层嵌套；Split 弹窗具备完整键盘焦点语义 |
| ➡️ **流程节点** | 无选项节点可用 `下一步` 默认出口连接后续节点，仍保持 `.mdstory` 纯文本可读 |
| 🚨 **三级错误检测** | 8 种错误 + 7 种警告 + 3 种建议，含 W007 闭环循环风险提示 |
| 👻 **幽灵补全** | N-gram 本地引擎，预测节点标题/选项句式/正文描述/变量名 |
| 📤 **多格式导出** | JSON Schema 0.2（canonical FullID、章节变量）+ HTML（可玩版）+ TXT（纯文本） |
| 🎮 **引擎合同** | Godot / Unity / Unreal 接受 0.1/0.2；Godot 与 Unity 具备章节作用域变量与双形状条件消费合同 |
| 🌓 **官方主题中心** | 内置 `叙事工作台` 与 `夜航蓝图` 两套官方主题，节点、线缆、面板、Monaco 配色和动效即时热切换 |
| 🌍 **中英双语** | 完整 UI 国际化覆盖 |

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Electron 42 |
| 前端 | React 18 + TypeScript 5 (strict) |
| 构建 | Vite 5 + pnpm workspace |
| 编辑器 | Monaco Editor |
| 分支图 | React Flow + Dagre |
| 解析器 | unified + remark + 自定义插件 |
| 状态管理 | Zustand |
| UI 组件 | 自研组件 + CSS Tokens；Radix/shadcn 原语按需引入 |
| 测试 | Vitest + Playwright |

---

## 快速开始

> ⚠️ V0.1 开发中，尚未发布。

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test
```

---

## 项目结构

```
PlotFlow/
├── packages/
│   ├── app/          # Electron + React 主应用
│   │   ├── src/
│   │   │   ├── components/  # React 组件
│   │   │   ├── stores/      # Zustand 状态
│   │   │   └── core/        # 核心业务逻辑
│   │   └── e2e/             # Playwright E2E
│   └── core/         # @plotflow/core 解析器、验证器、导出器、模板、i18n
├── spec/              # 规格文档
├── doc/               # 设计文档
├── memory/            # 项目记忆
└── tests/             # 测试
```

---

## 里程碑

| 里程碑 | 名称 | 预估 | 进度 |
|:---:|------|:---:|:---:|
| M0 | 项目脚手架 | 2-3 天 | ✅ 92.31%（1 项移除） |
| M1 | 核心解析与编辑 | 3-4 天 | ✅ 100% |
| M2 | 分支可视化 | 3 天 | ✅ 100% |
| M3 | 条件编辑与错误检测 | 2 天 | ✅ 100% |
| M4 | 导出系统 | 2 天 | ✅ 96.15%（1 项延后） |
| M5 | 补全引擎 | 2 天 | ✅ 94.74%（1 项延后） |
| M6 | 模板与主题 | 1 天 | ✅ 100% |
| M7 | Electron 打包发布 | 2 天 | 🔵 53.33%（7 项延后） |
| M8 | Graph Lab Core | 图优先正式入口 | ✅ 18/18（源码任务） |

详见 [`spec/milestones.md`](spec/milestones.md)

M0-M7 历史进度由 [spec/progress.md](spec/progress.md) 记录：132/142 完成、9 项延后、1 项移除；M8 的 18/18 仅表示源码任务完成，不等于发行通过。当前 Graph-first/P2 修订已通过 68 files / 1376 tests、app E2E 79/79、source blackbox 11 passed / 6 target skips、引擎 fixture 6/6，以及全新 Windows unpacked blackbox 16 passed / 1 installed-only skip。严格 unpacked 旅程已完成原生打开、Graph GUI 修复与编辑、撤销重做、保存重启 Continue、原生导出和磁盘 JSON Ajv 0.2 校验。installed blackbox、30 分钟人工巡检、真实引擎工具链 smoke、远程 CI run 和 Authenticode 仍未完成，因此不得宣称 release-candidate-passed 或公共正式发行。

Graph Lab P2 的 CI 配置已落地：PR 分别运行 Ubuntu 源码门禁与 Windows app/source-blackbox 门禁；nightly/manual 工作流负责 fresh package、unpacked、100/500/1000 节点性能和 SHA256。installed 黑盒只允许受保护 environment 上的 self-hosted Windows 手动运行。配置文件和本地通过不替代远程 workflow run 证据。

---

## 文档

| 文档 | 内容 |
|------|------|
| [PRD.md](PRD.md) | 产品需求规格（15 章） |
| [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) | 竞品分析（6 竞品 51 功能矩阵） |
| [doc/TAD.md](doc/TAD.md) | 技术架构设计 |
| [spec/syntax-formal.md](spec/syntax-formal.md) | 语法形式化规范（EBNF） |
| [spec/json-schema.md](spec/json-schema.md) | JSON 导出 Schema |
| [spec/design-brief-editor-ux.md](spec/design-brief-editor-ux.md) | UX 设计唯一真相源 |
| [doc/adr/ADR-014-graph-lab-p2-hardening.md](doc/adr/ADR-014-graph-lab-p2-hardening.md) | Graph Lab P2 可靠性、响应式与发行分层决策（本地实现完成，外部门禁待验收） |
| [spec/progress.md](spec/progress.md) | 实时进度跟踪 |

---

## 许可证

Copyright © 2026. Proprietary — 商业买断软件。

---

*维叙（Fablevia）：让文案写分支，让程序拿数据。*
