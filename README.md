# PlotFlow

> **面向独立游戏开发者的叙事分支管理工具。**
>
> 用 Markdown 方言（`.mdstory`）写分支剧情，实时可视化分支图，一键导出 JSON/HTML/TXT。
> 不锁死数据，不强制联网，$29 买断。

[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 这是什么？

PlotFlow 是一款**本地优先的叙事分支编辑器**。你在左侧写 Markdown 方言文本，右侧实时渲染可拖拽的分支流程图。写完后一键导出为 JSON（给程序员接引擎）、HTML（可玩的网页版）、或 TXT（纯文本阅读版）。

**目标用户**：独立游戏开发者（1-5 人团队）、游戏设计院校师生、视觉小说/互动小说制作者。

---

## 核心闭环

```
写 .mdstory 文本 → 看实时分支图 → 检查语法错误 → 一键导出 → 引擎加载
```

---

## 功能亮点

| 模块 | 说明 |
|------|------|
| 📝 **Monaco 编辑器** | VS Code 内核，PlotFlow 语法高亮 + 智能补全 |
| 🌳 **实时分支图** | React Flow 可拖拽节点图，文本 ↔ 图形双向同步 |
| 🔧 **条件编辑器** | Airtable 风格零代码条件构建器 |
| 🚨 **三级错误检测** | 8 种错误 + 6 种警告 + 3 种建议，波浪线标记 |
| 👻 **幽灵补全** | N-gram 本地引擎，预测节点标题/选项句式/正文描述/变量名 |
| 📤 **多格式导出** | JSON（标准格式）+ HTML（可玩版）+ TXT（纯文本） |
| 🎮 **Godot 插件** | 编辑器 Dock 面板 + 运行时库（条件评估、变量管理） |
| 🌓 **双主题** | 暗色/亮色即时切换，CSS 变量驱动 |
| 🌍 **中英双语** | 完整 UI 国际化覆盖 |

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Electron 28 |
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
| M0 | 项目脚手架 | 2-3 天 | ✅ 100% |
| M1 | 核心解析与编辑 | 3-4 天 | ✅ 100% |
| M2 | 分支可视化 | 3 天 | ✅ 100% |
| M3 | 条件编辑与错误检测 | 2 天 | ✅ 100% |
| M4 | 导出系统 | 2 天 | 🔵 92% |
| M5 | 补全引擎 | 2 天 | ✅ 100% |
| M6 | 模板与主题 | 1 天 | ✅ 100% |
| M7 | Electron 打包发布 | 2 天 | ⬜ |

详见 [`spec/milestones.md`](spec/milestones.md)

当前总进度见 [`spec/progress.md`](spec/progress.md)：125/142 项完成（88%），下一阶段为 M7 打包发布。

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
| [spec/progress.md](spec/progress.md) | 实时进度跟踪 |

---

## 许可证

Copyright © 2026. Proprietary — 商业买断软件。

---

*PlotFlow: 让文案写分支，让程序拿数据。*
