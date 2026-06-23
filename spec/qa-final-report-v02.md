# PlotFlow V0.2 发行前 QA 审计最终报告

> **审计日期**: 2026-06-19 | **代码基线**: `71f63cd` (V0.2)
> **审计团队**: QA Lead (Opus V4Pro) + 51 个审计 Agent (28 Opus + 24 Haiku)
> **审计方法**: 4 Waves × 52 Tasks | ~5.2M tokens | Workflow 自动化编排
> **上一份报告**: [`qa-final-report.md`](./qa-final-report.md) (V0.1, 2026-06-16)

---

## 一、执行概览

| Wave | Phase | Tasks | 模型分配 | 状态 | 时钟时间 |
|:---:|------|:---:|------|:---:|:---:|
| 1 | Phase 0: 代码静态推理 | 12 | 11 Opus + 1 Haiku | ✅ | ~220s |
| 2a | Phase 1: 数据追踪 | 8 | 7 Opus + 1 Haiku | ✅ | ~297s |
| 2b | Phase 2: 需求遵循 | 10 | 10 Haiku | ✅ | ~244s |
| 3 | Phase 3: E2E 功能测试 | 8 | 1 Opus + 7 Haiku | ✅ | ~925s |
| 4a | Phase 4: 用户旅程测试 | 6 | 6 Opus | ✅ | ~1121s |
| 4b | Phase 5: UX 审计 | 8 | 6 Opus + 2 Haiku | ✅ | (含Wave 4) |
| **总计** | **6 维度** | **52** | **28 Opus + 24 Haiku** | ✅ | **~3,200s** |

### 审计维度覆盖

```
┌────────────────────────────────────────────────────────┐
│ 维度 0: 代码静态推理 (Static Reasoning)   12 Tasks     │
│   架构遵从 / 类型安全 / IPC安全 / XSS / 代码质量       │
├────────────────────────────────────────────────────────┤
│ 维度 1: 数据追踪 (Data Trace)            8 Tasks       │
│   Monaco→AST→Graph / 双向同步 / 自动保存 / 补全引擎    │
├────────────────────────────────────────────────────────┤
│ 维度 2: 需求遵循 (Spec Conformance)     10 Tasks       │
│   PRD对照 / EBNF映射 / 里程碑验收 / 诊断码 / i18n      │
├────────────────────────────────────────────────────────┤
│ 维度 3: E2E 功能测试 (E2E Functional)    8 Tasks       │
│   Playwright 策略 + 41 个测试脚本生成                   │
├────────────────────────────────────────────────────────┤
│ 维度 4: 用户旅程测试 (User Journey)      6 Tasks       │
│   新手/专家/跨工具/边界对抗/并发/崩溃恢复              │
├────────────────────────────────────────────────────────┤
│ 维度 5: UX 审计 (UX Audit)               8 Tasks       │
│   视觉/交互/无障碍/主题/i18n/性能/跨平台/文档          │
└────────────────────────────────────────────────────────┘
```

---

## 二、按严重级别汇总

### 🔴 CRITICAL (2) — 阻塞发行

| ID | Phase | 文件 | 行号 | 描述 |
|:---:|:---:|------|:---:|------|
| **VULN-0.3-001** | 0.3 IPC 安全 | `main.ts` | 204 | **Chromium 沙箱未启用** — `sandbox: true` 缺失。渲染进程无沙箱保护，Chromium RCE 漏洞可逃逸到宿主 OS。Preload 架构完全兼容沙箱模式，开启无副作用 |
| **XSS-001** | 0.4 XSS 审计 | `exporter/html.ts` | 115, 389 | **HTML 导出存储型 XSS** — `JSON.stringify` 输出嵌入 `<script>` 标签时未转义 `</script>` 序列。用户文本含 `</script>` 可闭合标签注入任意脚本。攻击场景：恶意 .mdstory 作者导出 HTML 分发玩家 |

### 🟠 HIGH (10) — 发行前应修复

| ID | Phase | 文件 | 描述 |
|:---:|:---:|------|------|
| **VULN-0.3-002** | 0.3 IPC | `main.ts:37` | 所有写文件 IPC handler 无内容大小限制 → 主进程 OOM DoS |
| **VULN-0.3-003** | 0.3 IPC | `index.html:6` | CSP 缺少关键指令 (`object-src 'none'`/`base-uri 'self'`/Trusted Types) |
| **BUG-MAIN-001** | 0.8 主进程 | `main.ts:241-265` | `executeJavaScript` 无超时 → 渲染崩溃时窗口关闭永久挂起 |
| **BUG-MAIN-002** | 0.8 主进程 | `main.ts:316-333` | 缺 `app.requestSingleInstanceLock()` → Windows 双击 .mdstory 启动重复实例 |
| **BUG-MAIN-003** | 0.8 主进程 | `main.ts` 全域 | 缺 `render-process-gone`/`uncaughtException`/`unhandledRejection` 全局错误处理 |
| **BUG-GT-001** | 0.11 GhostText | `setupEditor.ts:132` | **中文语料 zh.json(45KB/157条) 已构建但从未加载** — 仅加载 `en.json`，中文用户 GhostText 完全不可见 |
| **BUG-01** | 0.9 Store | `graphStore.ts:248-262` | `collapsedGroups` 文件切换时不重置 → 旧文件状态泄漏到新文件 |
| **BUG-02** | 0.9 Store | `graphStore.ts:219-224` | `isEditing` 锁无超时安全网 → 拖拽连线异常中断时解析管线永久死锁 |
| **GAP-cycle** | 0.6 验证器 | `validator.ts` | **缺失循环引用检测** — A→B→C→A 不被任何规则标记，现有测试主动验证此 GAP 为预期行为 |
| **BUG-MAIN-004** | 0.8 主进程 | `main.ts:316-333` | Windows 长路径 (>260 字符) 无 `\\?\` 前缀支持，文件静默打开失败 |

### 🟡 MEDIUM (14)

| ID | Phase | 文件 | 描述 |
|:---:|:---:|------|------|
| **BUG-TXT** | 2.6 里程碑 | `exporter/txt.ts:156` | TXT 导出：`formatOption()` 未调用 `stripMarkdown()` → 导出文本泄漏 `[选项]` 和 `-> 节点:` 语法标记 |
| **B01** | 0.5 解析器 | `parser.ts:696-731` | `resolveTargetFullIds` 对匿名章节的同章节匹配失效 → 匿名章节内跨引用歧义 |
| **CS-04** | 0.9 Store | `adapter.ts` + `graphStore.ts` | `STATUS_TO_CLASS` 重复定义 → 两处不一致风险 |
| **BUG-MAIN-005** | 0.8 主进程 | `menu.ts:121-127` | 撤销/重做菜单项缺少 `accelerator` → 用户无法从菜单发现快捷键 |
| **BUG-MAIN-006** | 0.8 主进程 | `menu.ts:201-208` | 三个导出菜单项均调用同一函数无参数区分 → 菜单差异化未生效 |
| **GAP-E006** | 0.6 验证器 | `validator.ts` | E006 范围不完整：条件逻辑深度仅 parser 检查，validator 不覆盖 |
| **GAP-reserved** | 0.5/0.6 | `frontmatter.ts:59-63` | RESERVED_WORDS 仍缺少 30+ 编程关键字 (`if/else/while/for` 等) |
| **GAP-var-type** | 0.6 验证器 | `validator.ts:457-478` | 变量-变量比较缺少运算符特定类型检查 (string 变量可做 `>` 比较) |
| **BUG-diag-id** | 0.6 验证器 | `parser/*` + `validator/*` | 诊断 ID 格式不一致：Parser `E005-001` vs Validator `E005@L1:1` |
| **CORPUS-SIZE** | 2.6 里程碑 | `corpus/en.json` + `zh.json` | 语料包规模严重不足：英文 30KB (规格 1.5MB)，中文 44.6KB (规格 3.5MB) |
| **PROGRESS-ERR** | 2.10 进度 | `progress.md` | 进度追踪严重不准：M5 中 6 个已实现任务被误标为延后 (⏭️) |
| **ARCH-001** | 0.1 架构 | `graphStore.ts:168` | graphStore 缺少 `subscribeWithSelector` 中间件 → App.tsx 的 `selectedNodeId` 变化检测失效 |
| **COMP-CE-001** | 0.7 组件 | `ConditionEditor.tsx:107` | 模块级可变 `_idCounter` — 与 React 并发特性不兼容，应用 `useRef` |
| **GT-BUG-002** | 0.11 GhostText | `GhostTextPlugin.ts:209` | `lastTriggerTime` 在触发检测前无条件更新 → 非触发行上的打字阻断后续有效触发 |

### 🔵 LOW (15+)

| 类别 | 数量 | 关键项 |
|------|:---:|------|
| 裸 hex 色值 | 4 | GraphCanvas.tsx:874, ProblemPanel.tsx:301-304 |
| setTimeout 泄漏 | 3 | CorpusManager.tsx:367(高), GraphContextMenu.tsx:655/738(中) |
| 硬编码色值 | 2 | StoryEdge.tsx:101 (EdgeLabel 暗色主题不兼容) |
| V0.1 回归未修复 | 3 | CorpusManager W6/W7 未修复, ThemeProvider W8 未修复 |
| Store 设计问题 | 4 | editorInstance 不可序列化, isParsing 死代码, setContent 误设 dirty, updateNodeStatus 调用路径不明 |
| IPC 信息泄露 | 2 | `process.versions` 版本暴露, IPC 错误消息泄露路径 |
| 其他 | 5+ | before-quit handler 为空, 条件编辑器不响应外部 AST 变化, GhostText 缺测试覆盖 等 |

---

## 三、V0.1 回归验证

V0.1 审计 (2026-06-16) 发现的 5 个严重问题的修复状态：

| V0.1 Issue | 描述 | V0.2 状态 |
|:---:|------|:---:|
| **C1** | `file:save` 路径遍历漏洞 | ✅ **已修复** (V02-008) — 三层防护: 非空+类型检查 → `normalize()`前检测`..` → `.mdstory`扩展名白名单 |
| **C2** | ExportDialog setTimeout 泄漏 | ✅ **已修复** — `autoCloseTimerRef` 在对话框重开和组件卸载时正确清理 |
| **C3** | 新建文件 Ctrl+S 静默忽略 | ✅ **已修复** (V02-024) — `saveOrSaveAs()` 先调 `forceSave()` 再检查路径 |
| **C4** | 图→文本逆同步完全缺失 | ✅ **V0.2 新增** — 连线拖拽/重命名/右键菜单/条件编辑器双向同步全部实现 |
| **C5** | 保存竞态数据丢失 | ✅ **已修复** (V02-009) — `finally` 中改为条件清除，`pendingContent` 保留最新内容 |

V0.1 发现的 21 个 WARNING 和 10 个 INFO 中，约 60% 已修复，剩余项记录在本次审计报告中。

---

## 四、里程碑验收结果

| 里程碑 | 总任务 | 已完成 | 未完成 | L1 TypeCheck | L2 Test | L3 占位码 | 状态 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 脚手架 | 13 | 12 | 1 (已移除) | ⚠️ 5 测试文件错误 | ✅ 1098 PASS | ✅ | ✅ PASS |
| M1 核心解析 | 17 | 17 | 0 | — | ✅ 325+ 测试 | ✅ | ✅ PASS |
| M2 分支可视化 | 16 | 16 | 0 | — | ✅ 覆盖所有交互 | ✅ | ✅ PASS |
| M3 条件编辑 | 18 | 18 | 0 | — | ✅ 658+ 测试 | ✅ | ✅ PASS |
| M4 导出系统 | 26 | 12 | 14 (延后) | — | ⚠️ TXT BUG | ✅ | ⚠️ TXT 导出 BUG |
| M5 补全引擎 | 19 | 18 | 1 (延后) | — | ✅ 135 测试 | ✅ | ⚠️ 中文语料未加载 |
| M6 模板主题 | 18 | 18 | 0 | — | ✅ | ✅ | ✅ PASS |
| **总计** | **142** | **111** | **29+2** | ⚠️ 5 测试错误 | ⚠️ 1 BUG | ✅ | **78%** |

**注**: M7 (打包/Godot插件) 整体延后至 V0.3，不在本次审计范围。

---

## 五、数据流完整性

| 数据流路径 | 状态 | 验证结果 |
|------|:---:|------|
| 编辑器 → 解析器 → AST → 分支图 | ✅ | 500ms 防抖 + `isEditing` 三重检查 (MonacoEditor/parsePipeline/App.tsx) 正确 |
| 分支图拖拽 → 文本修改 → 重解析 | ✅ | `onConnect` → `edgeStore.parseEdgeId` → `executeEdits` → `onDidChangeModelContent` 链路完整 |
| 内联重命名 → 文本同步 | ✅ | `isCommitting` ref 防重复提交，操作锁防重命名期间冲突 |
| 编辑器 ↔ 大纲双向同步 | ✅ | `isNavigatingFromOutline` 600ms 冷却标记有效，`getNodeByLine` O(n) 可接受 |
| 自动保存竞态流程 | ✅ | 级联保存 + `pendingContent` 保留策略正确，V0.1 C3/C5 验证已修复 |
| 条件编辑器双向同步 | ⚠️ | 面板→文本方向正确；文本→面板方向：不响应外部 AST 变化 (已知行为，注释标注) |
| GhostText 补全数据流 | ⚠️ | 英文语料加载正确；**中文语料未加载**，InvertedIndex + NGramEngine 双重检索正确 |

---

## 六、UX 审计摘要

| 维度 | 评分 | 关键发现 |
|------|:---:|------|
| **视觉设计** | B+ | WCAG 对比度大部分达标；EdgeLabel 暗色主题下白色背景不兼容 |
| **交互设计** | B | 快捷键覆盖完整；**缺首次使用引导** (空白启动无欢迎界面/入门提示)；撤销/重做菜单项无快捷键显示 |
| **无障碍** | C+ | 缺乏 `aria-label`/`role` 属性；无键盘导航支持；颜色不是唯一信息传递方式（但诊断三色已是 ✅） |
| **主题保真** | A- | CSS Token 驱动正确，暗/亮双主题完整；**4 处裸 hex 色值**需替换为 Design Token |
| **i18n** | B+ | 翻译覆盖率 >90%；**4 处硬编码中文**待迁移到 i18n；错误/警告/建议消息有中英文翻译 |
| **性能** | B | 算法复杂度合理 (解析 O(n), 适配 O(1) Map查找, Dagre布局缓存)；无实际基准测试数据 |
| **跨平台** | B- | macOS/Windows 路径处理正确；**缺单实例锁** (Windows)；长路径无处理 |
| **文档入门** | C+ | 4 个模板质量良好；README 待补充；帮助菜单仍为占位 (V0.1 至今)；无首次使用引导 |

---

## 七、E2E 测试框架

- **框架选型**: Playwright 1.60 (Spectron 已于2022年废弃，不兼容 Electron 28 `contextIsolation:true`)
- **测试夹具设计**: 5 类 .mdstory 样本 (正常/错误/边界/大文件/多章节)
- **测试脚本**: 41 个 Playwright .spec.ts 已生成，涵盖 7 组模块：
  - 文件操作 (6 tests)
  - 解析器/验证器集成 (6 tests)
  - 分支图交互 (7 tests)
  - 条件编辑器 (6 tests)
  - 导出系统 (5 tests)
  - 主题/i18n (5 tests)
  - GhostText 补全 (6 tests)
- **CI 集成**: GitHub Actions + headless Electron 方案设计完成
- **测试 Hook**: `window.__plotflowTest__` 接口模式 (用于绕过 `contextIsolation` 访问内部状态)
- **配置文件**: `packages/app/e2e/playwright.config.ts` 模板已生成

---

## 八、发行建议

### 发行就绪检查清单

| 条件 | 状态 | 说明 |
|------|:---:|------|
| 所有 CRITICAL 问题已解决 | ❌ | 2 项待修复 (沙箱 + XSS) |
| 所有 HIGH 问题已解决/接受 | ❌ | 10 项待评估 |
| L1 TypeScript 零错误 | ❌ | 5 个测试文件类型错误 (生产代码零错误) |
| L2 单元测试全 PASS | ✅ | 1098 tests, 0 failures (1 TXT BUG 待修) |
| L3 占位代码 Zero | ✅ | `grep "待 M[0-9]"` 零结果 |
| E2E smoke test 通过 | ⏳ | Playwright 框架+41 脚本已生成，待执行 |
| 安全审计通过 (无 CVSS ≥7.0) | ❌ | sandbox + XSS 未解决 |
| V0.1 回归验证 | ✅ | 5/5 CRITICAL 已修复 |

### 📢 发行建议: **CONDITIONAL GO**

**🔴 阻塞发行 (必须修复)**:

1. **VULN-0.3-001**: 启用 Chromium 沙箱
   - 文件: `packages/app/src-electron/main.ts:204`
   - 修复: `webPreferences` 添加 `sandbox: true`
   - 风险: 低 — preload 仅使用 Electron 允许的沙箱子集 API

2. **XSS-001**: HTML 导出 XSS 修复
   - 文件: `packages/core/src/exporter/html.ts:389`
   - 修复: JSON 嵌入 `<script>` 前转义 `</` → `<\/`，或 base64 编码后 `atob` 解码

3. **VULN-0.3-002**: 添加内容大小限制
   - 文件: `packages/app/src-electron/main.ts` 所有写文件 handler
   - 修复: `if (content.length > 50 * 1024 * 1024) throw new Error('文件内容超出大小限制(50MB)')`

**🟠 强烈建议 (发行前修复)**:

4. **BUG-GT-001**: 加载中文语料
   - 文件: `packages/app/src/editor/setupEditor.ts:132`
   - 修复: 改为 `loadToEngine(engine, 'zh')` 或双语言加载

5. **BUG-MAIN-002**: 添加单实例锁
   - 文件: `packages/app/src-electron/main.ts`
   - 修复: `app.requestSingleInstanceLock()` + `second-instance` 事件处理

6. **BUG-MAIN-001**: executeJavaScript 超时
   - 文件: `packages/app/src-electron/main.ts:241-265`
   - 修复: `Promise.race([executeJavaScript(...), timeout(5000)])`

7. **BUG-TXT**: TXT 导出修复
   - 文件: `packages/core/src/exporter/txt.ts:156`
   - 修复: `formatOption()` 中对 `option.description` 调用 `stripMarkdown()`

**🟡 V0.3 修复**:
- 8 个 MEDIUM 问题 (匿名章节匹配/保留字扩展/循环检测/诊断ID统一/撤销菜单快捷键 等)
- 15+ LOW 问题 (裸hex色值/setTimeout泄漏/EdgeLabel暗色主题 等)

---

## 九、审计 Task 完整清单

### Phase 0: 代码静态推理

| Task | 审计对象 | 模型 | 状态 | 关键发现 |
|:---:|------|:---:|:---:|------|
| 0.1 | 架构合规 | Opus | WARN | graphStore 缺 subscribeWithSelector |
| 0.2 | 类型安全 | Opus | WARN | 5 tsc 错误 (全在测试文件), 4 any cast |
| 0.3 | IPC 安全 | Opus | **FAIL** | 9 漏洞 (1 CRITICAL + 2 HIGH + 4 MEDIUM + 2 LOW) |
| 0.4 | XSS 注入 | Opus | **FAIL** | 1 CRITICAL HTML导出XSS, CSP加固建议 |
| 0.5 | 解析器质量 | Opus | **FAIL** | 1 MEDIUM bug (匿名章节匹配), W19/W20 未修复 |
| 0.6 | 验证器质量 | Opus | PASS | 6 GAP (1 HIGH 圈检测 + 3 MEDIUM + 1 LOW + 1 INFO) |
| 0.7 | 组件审计 | Opus | **FAIL** | 7 反模式 (1 HIGH _idCounter), 3 清理问题, V0.1 5/8 已修复 |
| 0.8 | 主进程审计 | Opus | **FAIL** | 3 HIGH + 2 MEDIUM + 3 LOW |
| 0.9 | Store 审计 | Opus | **FAIL** | 2 MEDIUM (collapsedGroups泄漏, isEditing死锁) + 3 LOW |
| 0.10 | 服务层审计 | Opus | PASS | V0.1 C3/C5 已验证修复, 2 LOW 风险 |
| 0.11 | GhostText 审计 | Opus | **FAIL** | 1 HIGH (中文语料未加载) + 2 MEDIUM + 2 LOW |
| 0.12 | 代码异味扫描 | Haiku | WARN | 4 hex色值, 17 eslint-disable, 0 占位代码, 0 TODO |

### Phase 1: 数据追踪

| Task | 审计对象 | 模型 | 状态 | 关键发现 |
|:---:|------|:---:|:---:|------|
| 1.1 | 端到端数据流 | Opus | PASS | 主流程+逆向流程+诊断流程 7 步追踪正确 |
| 1.2 | 双向同步 | Opus | PASS | isEditing 锁路径完整, 反馈循环防护有效 |
| 1.3 | 大纲同步 | Opus | PASS | 双向同步正确, 冷却标记有效 |
| 1.4 | 自动保存完整性 | Opus | PASS | V0.1 C3/C5 已修复, 级联保存正确 |
| 1.5 | 条件编辑器同步 | Opus | WARN | 面板→文本正确; 文本→面板不响应外部变化 (已知行为) |
| 1.6 | 变量交叉引用 | Opus | PASS | 声明→使用追踪正确, 类型检查覆盖完整 |
| 1.7 | 导出数据完整性 | Haiku | PASS | JSON/HTML 正确, **TXT 发现 BUG** |
| 1.8 | 补全引擎数据流 | Opus | WARN | 英文流程正确, 中文语料加载确认缺失 |

### Phase 2: 需求遵循

| Task | 审计对象 | 模型 | 状态 | 关键发现 |
|:---:|------|:---:|:---:|------|
| 2.1 | PRD F3.1 核心编辑 | Haiku | PASS | 90% 实现 (括号智能补全未完全满足 PRD) |
| 2.2 | PRD F3.2 智能辅助 | Haiku | WARN | 四维补全实现; 本地学习/语料导入标记延后 |
| 2.3 | PRD F3.3-F3.4 导出+错误 | Haiku | WARN | TXT 导出 BUG 发现; 17 诊断规则全部实现 |
| 2.4 | 语法 EBNF 映射 | Haiku | PASS | 所有产生式映射到实现 |
| 2.5 | M0-M2 里程碑验收 | Haiku | PASS | 44/46 PASS (1 partial + 1 removed) |
| 2.6 | M3-M6 里程碑验收 | Haiku | WARN | TXT BUG + M5 进度追踪错误 + 语料规模不足 |
| 2.7 | 诊断码完整性 | Haiku | PASS | 17/17 已定义且生成, DIAGNOSTIC_MESSAGES 覆盖完整 |
| 2.8 | i18n 覆盖率 | Haiku | PASS | >90% 翻译覆盖, 4 处硬编码中文 |
| 2.9 | 保留字完整性 | Haiku | WARN | 30+ 编程关键字缺失 |
| 2.10 | 进度追踪准确性 | Haiku | WARN | M5 6 个任务误标, progress.md 数据不一致 |

### Phase 3: E2E 功能测试

| Task | 审计对象 | 模型 | 状态 | 产物 |
|:---:|------|:---:|:---:|------|
| 3.1 | E2E 策略设计 | Opus | ✅ | Playwright 框架, CI 方案, 测试 Hook 定义 |
| 3.2 | 文件操作测试 | Haiku | ✅ | 6 个测试脚本 |
| 3.3 | 解析器/验证器测试 | Haiku | ✅ | 6 个测试脚本 |
| 3.4 | 分支图交互测试 | Haiku | ✅ | 7 个测试脚本 |
| 3.5 | 条件编辑器测试 | Haiku | ✅ | 6 个测试脚本 |
| 3.6 | 导出系统测试 | Haiku | ✅ | 5 个测试脚本 |
| 3.7 | 主题/i18n 测试 | Haiku | ✅ | 5 个测试脚本 |
| 3.8 | GhostText 测试 | Haiku | ✅ | 6 个测试脚本 |

### Phase 4: 用户旅程测试

| Task | 审计对象 | 模型 | 状态 | 关键发现 |
|:---:|------|:---:|:---:|------|
| 4.1 | 新手创建旅程 | Opus | PASS | 无首次使用引导 (MEDIUM UX gap) |
| 4.2 | 专家编辑旅程 | Opus | PASS | 复杂条件/效果流程正确 |
| 4.3 | 跨工具 Godot 流程 | Opus | PASS | JSON schema 符合, 结构完整 |
| 4.4 | 边界案例对抗 | Opus | PASS | 超大节点/深层嵌套/Unicode 处理正确 |
| 4.5 | 并发编辑竞态 | Opus | PASS | isEditing 锁有效, 无数据丢失 |
| 4.6 | 崩溃恢复韧性 | Opus | WARN | 无全局异常处理, 无崩溃报告 |

### Phase 5: UX 审计

| Task | 审计对象 | 模型 | 状态 | 关键发现 |
|:---:|------|:---:|:---:|------|
| 5.1 | 视觉设计 | Opus | PASS | WCAG 对比度基本达标; EdgeLabel 暗色问题 |
| 5.2 | 交互设计 | Opus | PASS | 缺首次引导; 撤销/重做快捷键 |
| 5.3 | 无障碍 WCAG | Opus | FAIL | 缺 aria-label/role/键盘导航 |
| 5.4 | 主题保真 | Opus | WARN | 4 处裸 hex; 基本合规 |
| 5.5 | i18n 完整性 | Haiku | PASS | >90% 覆盖, 硬编码中文待迁移 |
| 5.6 | 性能基线 | Opus | WARN | 算法合理但无实测数据 |
| 5.7 | 跨平台兼容 | Haiku | WARN | 缺单实例锁; 长路径无处理 |
| 5.8 | 文档入门 | Opus | WARN | 模板质量好; README 待补充; 帮助菜单占位 |

---

## 十、后续行动项

### 立即 (V0.2.1)
- [ ] 启用 Chromium 沙箱 (`sandbox: true`)
- [ ] 修复 HTML 导出 XSS (`</` 转义)
- [ ] 添加 IPC 内容大小限制 (50MB)
- [ ] 加载中文语料 (`zh.json`)
- [ ] 添加 `requestSingleInstanceLock`
- [ ] executeJavaScript 5s 超时
- [ ] 修复 TXT 导出 `stripMarkdown()` BUG

### V0.3
- [ ] 添加循环引用检测 (W007)
- [ ] 扩展保留字集合
- [ ] 统一诊断 ID 格式
- [ ] 修复 `collapsedGroups` 状态泄漏
- [ ] 添加 `isEditing` 超时安全网
- [ ] 修复裸 hex 色值 4 处
- [ ] 补充首次使用引导
- [ ] 实现帮助菜单 (about/docs)
- [ ] 补充无障碍属性 (aria-label/role)
- [ ] 修复 progress.md 进度追踪

### V0.4+
- [ ] 执行 Playwright E2E 测试套件 (41 个脚本)
- [ ] 建立性能基准测试
- [ ] 补充 GhostTextPlugin 单元测试
- [ ] 中文语料扩展至 3.5MB 规格
- [ ] WCAG 2.1 AA 完整合规

---

*审计执行: 2026-06-19 | 52 个 Task × 6 维度 | 28 Opus + 24 Haiku | ~5.2M tokens | ~3,200s 总时钟时间*
*本报告为 PlotFlow V0.2 发行前审计的权威记录，基于对代码库的静态分析、数据流追踪、规格对照和场景模拟。*
