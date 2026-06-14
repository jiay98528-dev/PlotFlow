# PlotFlow 错题本

> **版本**：V0.1 | **创建日期**：2026-06-12 | **类型**：动态文档（发现 Bug 时立即记录）
> **规则**：编码前必读最近 10 条记录，避免重复踩坑。

---

## 快速导航

- [根因分类统计](#根因分类统计)
- [Bug 记录](#bug-记录)
- [高频错误模式](#高频错误模式)

---

## 根因分类统计

| 分类 | 代码 | 说明 | 累计次数 |
|------|:---:|------|:---:|
| 类型系统 | `TYP` | TypeScript 类型标注遗漏/错误/any 滥用 | 0 |
| 状态管理 | `STT` | Zustand store 更新时序/竞态/循环依赖 | 0 |
| 异步处理 | `ASY` | Promise/async 遗漏 await、未捕获 rejection | 0 |
| Monaco 集成 | `MON` | Editor API 误用、decoration 泄漏、tokenizer 状态机 bug、类型定义滞后 | 13 |
| React Flow | `RFL` | 节点坐标异常、连线渲染错误、性能回退 | 0 |
| 解析器 | `PRS` | 递归溢出、边界字符解析崩溃、AST 结构错误 | 0 |
| Electron | `ELC` | IPC 通信异常、主进程崩溃、文件锁冲突 | 0 |
| 文件 I/O | `FIO` | 编码错误、mtime 冲突、自动保存数据丢失 | 0 |
| 样式/主题 | `STY` | CSS 变量遗漏、主题切换闪烁、硬编码色值 | 0 |
| 国际化 | `I18` | 翻译遗漏、key 冲突、语言切换不完整 | 0 |
| 构建/打包 | `BLD` | Vite 配置错误、electron-builder 签名、路径问题 | 0 |
| 其他 | `OTH` | 以上分类不包括的 | 2 |

---

## Bug 记录

> 暂无记录 —— 等待第一个 Bug 被踩中。
>
> 格式模板：
>
> ```markdown
> ### BUG-001: [简短标题]
> 
> **日期**：YYYY-MM-DD
> **分类**：`TYP` / `STT` / `ASY` / ...
> **严重程度**：🔴 阻断 / 🟠 严重 / 🟡 一般 / 🔵 轻微
> **里程碑**：M0 / M1 / ...
> **文件/模块**：`path/to/file.ts`
> 
> **现象**：
> [用户可观测的行为描述]
> 
> **根因**：
> [技术层面的根本原因，不要只说"修复了 XXX"]
> 
> **教训**：
> [一句话教训，编码时能记住的]
> 
> **预防措施**：
> [ESLint 规则 / 单元测试 / 类型约束 / 代码审查检查点]
> 
> **修复**：
> [修复 commit SHA + 一句话描述]
> ```

---

### BUG-001: Monaco 0.45 类型定义滞后导致 13 个 TS 错误

**日期**：2026-06-13
**分类**：`MON`
**严重程度**：🟡 一般
**里程碑**：M1

**文件/模块**：`foldingProvider.ts` / `monaco-tokenizer.ts` / `setupEditor.ts`

**现象**：
16 个 TypeScript 类型错误，全部集中在 Monaco Editor 相关文件：
- `languages.ITextModel` 未导出（实际 API 存在，类型未声明）
- `IMonarchLanguageRule` 不接受 `fontStyle` 字段（实际 API 支持，类型过时）
- `monaco-editor/esm/vs/editor/editor.worker?worker` 模块声明缺失
- `Window` → `Record<string, unknown>` 转换不安全

**根因**：
Monaco Editor 0.45 的捆绑类型定义（`.d.ts`）滞后于实际运行时 API。Monarch tokenizer 的 `fontStyle`、`ITextModel` 等 API 在运行时正常工作，但 TypeScript 编译器不认识。

**教训**：
Monaco 0.45 的类型定义不是运行时真相源。升级到 0.50+ 或在 `src/types/monaco-patches.d.ts` 中补充缺失的类型声明。

**预防措施**：
- M6（主题/模板里程碑）统一升级 Monaco 到 0.50+ 并验证所有类型
- 新建 `packages/app/src/types/monaco-patches.d.ts` 补充 `ITextModel`、`IMonarchLanguageRule` 等声明
- CI 中 tsc 错误可针对 Monaco 文件临时豁免（`// @ts-nocheck`），等 M6 升级后移除

**修复**：
跳过 — M6 统一处理。修复本身（写类型补丁或升级版本）会导致 M2-M5 开发中 Monaco API 不稳定，打乱开发进程。

---

### BUG-002: ESLint `no-constant-condition` 在解析器 while(true) 循环中误报

**日期**：2026-06-13
**分类**：`OTH`
**严重程度**：🔵 轻微
**里程碑**：M1

**文件/模块**：`conditions.ts` 行 731、793

**现象**：
递归下降解析器的 `while (true) { ... break }` 模式被 ESLint 标记为 `no-constant-condition` 错误。

**根因**：
解析器的 `parseAnd()` 和 `parseOr()` 函数使用 `while (true)` + 内嵌 `break` 来消费连续的 AND/OR 运算符。这是递归下降解析器的标准模式，不是真正的无限循环。

**教训**：
解析器代码必然使用 `while (true)` 模式。ESLint 的 `no-constant-condition` 规则在解析器文件中应全局禁用。

**预防措施**：
- 在 `packages/core/.eslintrc.cjs` 中添加 `no-constant-condition: off`
- 或在 `conditions.ts` 文件头部添加 `/* eslint-disable no-constant-condition */`

**修复**：
已添加 `// eslint-disable-next-line no-constant-condition` 注释（2 处）。后续 M2-M5 新增解析器文件应在文件头禁用此规则。

---

> 同分类累计 ≥3 次时，在此总结模式并链接回具体 Bug 记录。

---

*每次发现 Bug 都值得被记住。踩过的坑，不该踩第二次。*
