# PlotFlow V0.1 发行前 QA 审计测试方案

> 版本：1.0 | 日期：2026-06-16 | 基于 V0.1.1 修复后代码基线

---

## 测试策略概览

```
测试金字塔
┌──────────────────────────────────────┐
│        L4: 用户闭合旅程 E2E          │  12 条旅程
├──────────────────────────────────────┤
│      L3: 集成测试（模块间数据流）     │  18 条用例
├──────────────────────────────────────┤
│    L2: 单元测试（已有 746 PASS）     │  复核 + 补充
├──────────────────────────────────────┤
│  L1: 静态检查（tsc/eslint/stylelint）│  零错误验证
└──────────────────────────────────────┘
```

---

## 一、L1 静态检查验证

### TS-01: TypeScript 编译零错误
```bash
cd D:\VibeCoding\PlotFlow && pnpm typecheck
```
**期望**: 零错误退出

### TS-02: ESLint 零错误
```bash
cd D:\VibeCoding\PlotFlow && pnpm lint
```
**期望**: 零错误（允许 3 条 no-console 警告）

### TS-03: Stylelint 零错误
```bash
cd D:\VibeCoding\PlotFlow && pnpm exec stylelint "packages/app/src/styles/**/*.css"
```
**期望**: 零错误

### TS-04: 裸 hex 色值扫描
```bash
grep -rn "color: '#[0-9a-fA-F]" packages/app/src/components/ --include='*.tsx' | grep -v 'var('
```
**期望**: 零裸 hex（`var()` 内的 fallback 除外）

### TS-05: 占位代码扫描
```bash
grep -rn "待 M[0-9]" packages/app/src/ packages/core/src/
```
**期望**: 零结果

---

## 二、L2 单元测试复核

### UT-01: 全量单元测试 PASS
```bash
cd D:\VibeCoding\PlotFlow && pnpm test
```
**期望**: 746+ 测试全部 PASS，零失败

### UT-02: 测试覆盖率报告
```bash
cd D:\VibeCoding\PlotFlow && pnpm exec vitest run --coverage 2>/dev/null || true
```
**期望**: 核心模块（parser/validator/exporter）覆盖率 ≥ 80%

---

## 三、Core 解析器边界测试（Haiku 执行）

### P-01: 空文件解析
- 输入：空字符串 + 仅 Frontmatter + 仅注释 + 仅空白行
- 验证：不崩溃，返回空 PlotFlowData

### P-02: Frontmatter 边界
- `---` 不配对、重复 `---`、YAML 注释、空 Frontmatter
- 变量类型边界：int 超限、float 科学计数法、bool 非标准值、枚举空列表
- 嵌套 object 4 层 → E006 错误

### P-03: 节点边界
- 单节点无选项、无章节前缀（匿名章节）、超大节点 ID（>100 字符）
- 重复节点 ID → E007、特殊 Unicode 节点名（emoji/阿拉伯文/泰文）
- 节点正文含 Markdown 标记（** ** * * ` ` ~~ ~~）

### P-04: 选项边界
- 无目标、多层缩进（5 级 tab）、选项描述含 `[选项]` 字面量
- 选项描述为空、选项含条件 + 效果 + 跳转全部组合
- 目标引用格式：`节点:X` vs `章节/节点:X` vs `节点：X`（全角冒号）
- `下一步: 节点：X` 节点级流程出口、跨章节 `下一步: 章节/节点：X`
- `下一步` 紧邻缩进 `效果:` 归属流程出口；格式错误的 `下一步` 不得吞掉后续正文或效果

### P-05: 条件表达式边界
- 深度嵌套：`(A AND B) OR (C AND (D OR E))`（3 层合法）
- 超深嵌套（4 层 → E006）、空括号 `()`
- NOT 链：`NOT NOT NOT A`、字符串含特殊字符
- 变量未声明 → E002、枚举值非法 → E003、类型不匹配 → E004

### P-06: 效果（SideEffect）边界
- int/float add/subtract 负数、set 空字符串、append 未初始化
- enum 变量 append 操作 → E004、不存在的字段路径

### P-07: 变量声明边界
- 重复声明 → E008、保留字变量名、超长变量名（64 字符）
- 6 种类型全覆盖、默认值类型不匹配
- Graph Lab 新增/删除变量后，条件变量下拉和效果变量下拉必须同步更新并写回 frontmatter `vars:`

---

## 四、验证器全面测试（Haiku 执行）

### V-01: 8 种错误检测全覆盖
| 错误 | 触发条件 | 验证点 |
|------|---------|--------|
| E001 | 选项目标节点不存在 | 波浪线 + 问题面板 + 侧边标记 |
| E002 | 条件中变量未声明 | 同上 |
| E003 | 枚举变量赋非法值 | 同上 |
| E004 | 类型不匹配 | 同上 |
| E005 | 语法解析失败 | 同上 |
| E006 | 嵌套深度超 3 层 | 同上 |
| E007 | 节点 ID 重复 | 同上 |
| E008 | 变量重复声明 | 同上 |

### V-02: 7 种警告检测全覆盖
| 警告 | 触发条件 | 验证点 |
|------|---------|--------|
| W001 | 孤立节点（无入边） | 黄色波浪线 |
| W002 | 死胡同节点（无出边） | 黄色波浪线 |
| W003 | 未使用变量 | 黄色波浪线 |
| W004 | 重复选项描述 | 黄色波浪线 |
| W005 | 空正文节点 | 黄色波浪线 |
| W006 | 格式不规范 | 黄色波浪线 |
| W007 | 选项边或 `下一步` 边形成无外部出口闭环 | 黄色波浪线 + 问题面板；有明确出口的回环不报警 |

### V-03: 3 种建议检测全覆盖
| 建议 | 触发条件 | 验证点 |
|------|---------|--------|
| I001 | 全部选项带条件（可能卡关） | 蓝色下划线 |
| I002 | 描述 < 10 字符 | 蓝色下划线 |
| I003 | 无章节归属 | 蓝色下划线 |

### V-04: 多诊断叠加
- 同一节点同时产生 E001 + W001 + W002、同一行多个诊断
- 验证 Monaco decorations 不重叠/不丢失

---

## 五、导出器测试（Haiku 执行）

### EX-01: JSON 导出往返一致性
- `.mdstory → parse → AST → exportJSON → JSON.parse → 语义一致`
- 测试所有 4 个内置模板 + 空白文件

### EX-02: JSON Schema 验证
- 导出 JSON 对照 `spec/json-schema.md` 验证结构完整性
- 所有必填字段存在、`$schema` 声明正确

### EX-03: HTML 导出自包含性
- 导出 HTML 文件不含外部资源引用（`<link>`/`<script src>`）
- 所有 CSS/JS 内嵌

### EX-04: HTML 可玩版交互逻辑
- 选项按钮可点击、条件选项灰显（🔒）
- 变量面板折叠/展开、面包屑导航可回溯
- `**bold**`/`*italic*`/`~~strike~~`/`` `code` `` Markdown 渲染

### EX-05: TXT 导出纯净性
- 无 Markdown 标记残留、无 Frontmatter YAML、无 `[条件]`/`[效果]` 子行

### EX-06: 导出大文件
- 50+ 节点故事导出 JSON/HTML/TXT，验证不超时/不OOM

---

## 六、模板系统测试（Haiku 执行）

### TPL-01: 5 个模板完整性
- 空白文件/RPG 对话/视觉小说/解谜逃脱/Godot 示例
- 每个模板可成功解析（无语法错误）、变量声明完整

### TPL-02: 模板引擎占位符替换
- `{{title}}`/`{{author}}`/`{{engine}}` 正确替换
- 未提供的变量保持 `{{var}}` 原样

### TPL-03: 模板节点图可构建
- 每个模板解析后 → AST → React Flow 数据适配 → 节点+边非空

---

## 七、IPC 与文件操作测试（Haiku 执行）

### IPC-01: file:save 正常流程
- 保存新文件 → 成功返回 `{success: true, timestamp}`
- 内容正确写入磁盘

### IPC-02: file:open 正常流程
- 打开已有 `.mdstory` 文件 → 返回 `{filePath, content}`
- 取消对话框 → 返回 `null`

### IPC-03: file:saveAs 正常流程
- 另存为 → 返回 `{filePath}` → 文件存在

### IPC-04: file:export 多格式
- JSON/HTML/TXT 三种格式导出 → 文件正确写入
- 取消导出 → 返回 `null`

### IPC-05: file:getPendingOpenFile
- 无待打开文件 → 返回 `null`
- 双击 `.mdstory` → 返回文件路径+内容

### IPC-06: 文件操作错误处理
- 保存到只读目录 → 错误不崩溃
- 打开不存在的路径（边缘情况）
- 文件名含特殊字符（`测试:文件?.mdstory`）

### IPC-07: preload API 完整性
- `window.plotflow.platform` 存在且为 `'win32'`/`'darwin'`/`'linux'`
- `window.plotflow.versions` 含 `node`/`electron`/`chrome`
- `window.plotflow.file.*` 所有 6 个方法存在
- `window.plotflow.menu.*` 所有 3 个方法存在

---

## 八、菜单事件系统测试（Haiku 执行）

### MENU-01: 16 个菜单事件通道注册
- 验证所有 16 个 channel 的监听器可注册
- 重复注册同一 channel 时旧监听器被清理

### MENU-02: 菜单事件触发
- 模拟 `menu:file:new` 触发 → store 状态更新
- 模拟 `menu:view:toggleTheme` → 主题切换

### MENU-03: 快捷键绑定
- Ctrl+N/O/S/Shift+S/F/H/E/Shift+E/Alt+E/Shift+O/Shift+G/Shift+M/Shift+T
- 验证快捷键与菜单 action 一致性

---

## 九、状态管理测试（Haiku 执行）

### ST-01: editorStore 状态流转
- `setContent()` → `isDirty=true` → `markSaved()` → `isDirty=false`
- `setFilePath()` → `filePath` 更新
- `reset()` → 所有状态归零

### ST-02: storyStore 状态流转
- `setPlotFlowData()` → `plotFlowData` 非 null → `isParsing=false`
- `setParseError()` → `parseError` 设置
- `getNodeByLine()` → 返回匹配节点
- `getNodeByFullId()` → 返回匹配节点

### ST-03: graphStore 状态流转
- `syncFromAST()` → `nodes` + `edges` 非空
- `selectNode()` → `selectedNodeId` 更新 → React Flow 高亮
- `toggleViewMode()` → `viewMode` 在 `'minimap'`/`'split'` 间切换

### ST-04: uiStore 状态流转
- `toggleTheme()` → `theme` 切换 → localStorage 持久化
- `setLanguage()` → `language` 切换 → i18n 刷新
- `toggleConditionEditor()` → `isConditionEditorOpen` 切换
- 所有 toggle/open/close 方法验证状态正确翻转

### ST-05: 跨 store 一致性
- 解析管道运行后：`storyStore.plotFlowData` 非 null + `graphStore.nodes` 非空 + `editorStore.diagnostics` 更新
- 文件保存后：`editorStore.isDirty=false` + `editorStore.filePath` 更新

---

## 十、组件渲染测试（Haiku 执行）

### CMP-01: ThemeProvider
- 渲染子组件、切换主题时 `data-theme` 属性更新
- Monaco 主题同步更新

### CMP-02: StatusBar
- 显示文件路径、节点计数、选项计数、缩放比例
- 状态消息显示/过滤 `save:` 前缀
- 诊断计数显示（error/warning/info 三级）

### CMP-03: OutlinePanel
- AST 解析后显示章节→节点树
- 点击节点 → 编辑器跳转
- 编辑器滚动 → 大纲高亮同步

### CMP-04: MonacoEditor
- 语法高亮正确（7 色 Monarch tokenizer）
- 括号自动闭合 `[` → `]`
- 节点折叠（Code Folding）

### CMP-05: GraphCanvas
- React Flow 画布渲染、小地图可见
- 节点卡片显示标题+摘要+选项徽章
- 连线颜色：条件=橙色虚线、无条件=青色实线

### CMP-06: NewFileDialog
- 5 个模板可选、预览区域显示模板内容
- 标题/作者填写 → 创建文件 → 编辑器加载

### CMP-07: ExportDialog
- 3 种格式可选、文件路径选择
- 导出成功 → 状态消息提示

### CMP-08: ProblemPanel
- 诊断列表显示、三级筛选（错误/警告/建议）
- 点击诊断 → 编辑器跳转到对应行

### CMP-09: ConditionEditor
- 变量下拉 + 运算符下拉 + 值输入
- AND/OR 组构建、条件预览行
- 双向文本同步
- 变量来源必须是当前 `.mdstory` frontmatter `vars:`；新增变量后下拉即时可选
- 效果编辑 UI 必须支持变量下拉、赋值/增减/切换等基础操作，并写回 `效果:`

### CMP-10: Graph Lab Chapter Workspace
- 顶部章节标签栏始终可见；新增章节后必须出现新标签并选中
- Source Drawer 在 Graph Lab 中显示当前章节源码切片，提交后映射回全文件
- 无选项节点显示默认流程连线口；有普通选项后默认流程连线口隐藏
- 章节标签栏、新建章节后的标签栏、完整工作区必须有 Playwright 截图附件和尺寸/非空断言

### CMP-11: CorpusManager
- 语料列表显示、分类筛选
- 导入/导出功能

---

## 十一、用户闭合旅程 E2E（Haiku 执行）

### J-01: 首次启动 → 新建文件 → 编辑 → 保存 → 关闭
1. 启动应用 → 看到空白编辑器
2. Ctrl+N → NewFileDialog → 选择 RPG 对话模板 → 填写标题/作者
3. 编辑器加载模板内容、分支图显示节点
4. 编辑文本 → 状态栏显示「未保存」
5. Ctrl+S 保存 → 状态栏显示文件路径
6. 关闭应用

### J-02: 打开文件 → 编辑 → 导出 → 查看结果
1. Ctrl+O → 打开 `.mdstory` 文件
2. 修改选项描述 → 编辑器和分支图同步更新
3. Ctrl+E → ExportDialog → 选择 JSON → 导出
4. 验证导出 JSON 文件存在且格式正确
5. Ctrl+Shift+E → 导出 HTML → 浏览器打开 → 测试交互
6. Ctrl+Alt+E → 导出 TXT → 验证纯文本格式

### J-03: 条件编辑完整流程
1. 打开有变量的故事（RPG 模板）
2. 在 `[选项]` 行上编辑 → 触发条件编辑器
3. 图形化构建条件 `$信任度 >= 5 AND $阵营 == "村民"`
4. 验证文本行自动更新为 `[条件] $信任度 >= 5 AND $阵营 == "村民"`
5. 手动编辑文本 → 条件编辑器自动刷新

### J-04: 分支图交互完整流程
1. 打开故事 → 分支图渲染所有节点
2. 单击节点 → 编辑器跳转 + 节点高亮
3. 双击节点 → 内联重命名 → 标题更新
4. 拖拽连线端点 → 修改跳转目标 → 文本更新
5. 右键空白 → 添加节点 → 新节点出现
6. 右键节点 → 删除 → 节点+相关连线移除
7. 缩放（滚轮）+ 平移（中键/空白拖拽）

### J-05: 错误检测与修复流程
1. 编辑文本引入错误（如删除目标节点）
2. → 红色波浪线出现 + 侧边标记 + 问题面板更新
3. Hover 错误 → Tooltip 显示诊断编号+描述+修复建议
4. Ctrl+Shift+M → 打开问题面板 → 点击跳转
5. 修复错误 → 波浪线消失 + 问题面板清除

### J-06: 主题切换流程
1. 默认亮色主题
2. Ctrl+Shift+T → 切换暗色主题 → 编辑器+分支图+面板全部暗色
3. 再切换 → 回到亮色
4. 切换强调色：海洋蓝 ↔ 暖金

### J-07: 多标签/多文件切换
1. 打开文件 A → 编辑 → 未保存
2. 打开文件 B → 确认丢弃 A 的修改
3. 在文件 B 中编辑 → 保存

### J-07A: Graph Lab P0/P1 闭环
1. 保存 `.mdstory` 后重启应用 → Home `Continue editing` 重新加载最近保存文件
2. 在 Graph Lab 中新增变量 → 条件和效果编辑器都能下拉选中该变量
3. 创建无选项节点并从默认 handle 连线 → 源码写入 `下一步`
4. 给同一节点新增普通选项 → 默认流程 handle 隐藏
5. 新建章节 → 顶部章节标签栏显示新 tab，Source Drawer 只显示当前章节切片
6. 构造 A→B→A 和 A→B→C→A → 出现 W007；给闭环增加外部出口后 W007 消失

### J-08: 中英双语切换
1. 默认中文界面
2. 设置切换为英文 → 工具栏/菜单/面板文案全部英文
3. 切回中文 → 恢复

### J-09: 自动保存与恢复
1. 编辑文件 → 等待 500ms → 自动保存触发
2. 模拟崩溃 → 文件内容已持久化
3. 重新打开 → 内容完整

### J-10: 大文件性能测试
1. 创建含 50+ 节点的故事
2. 编辑器滚动 → 不卡顿
3. 分支图渲染 → 所有节点可见 → 缩放平移流畅
4. 修改文本 → 500ms 内分支图更新

### J-11: 特殊字符与 Unicode
1. 节点名含 emoji（🎮⚔️🛡️）→ 解析正常
2. 选项描述含中文标点（「」『』——）→ 解析正常
3. 变量值含特殊字符（`\n`/`\t`/引号）→ 转义正确

### J-12: 条件逻辑完整性
1. 创建多条件选项（AND/OR/NOT 组合）
2. HTML 导出 → 条件评估逻辑正确
3. 变量修改（side effect）→ HTML 中变量面板实时更新

---

## 十二、边界与压力测试（Haiku 执行）

### EDGE-01: 超大单文件
- 5000 行 `.mdstory`、200 节点、1000 选项
- 解析时间 < 5 秒、编辑器不卡死

### EDGE-02: 超长单行
- 节点正文 10000 字符、选项描述 2000 字符
- 不崩溃、不断行错误

### EDGE-03: 递归/循环引用
- A → B → C → A 形成环 → W001/W002 警告

### EDGE-04: 空白处理
- 行首/行尾空格、连续空行、仅空格行、tab vs 空格混用

### EDGE-05: Frontmatter 破坏测试
- 截断的 YAML、非法嵌套、超深嵌套（>10 层）
- 不崩溃、返回 E005

### EDGE-06: 并发操作
- 编辑器快速输入（模拟 60fps 打字）+ 分支图同步
- debounce 正确：只在最后输入 500ms 后触发解析

### EDGE-07: 内存泄漏检查
- 反复打开/关闭文件 20 次
- 事件监听器不累积、store 状态正确清理

### EDGE-08: 路径边界
- 文件路径含空格、中文、emoji、超长路径（>260 字符）
- IPC 文件操作正常

---

## 十三、持久化与数据完整性测试（Haiku 执行）

### DATA-01: Round-trip 数据完整性
- `.mdstory → parse → AST → exportJSON → 比对源文本`
- 语义一致（允许格式规范化差异）

### DATA-02: 自动保存原子性
- 自动保存期间手动 Ctrl+S → 不冲突
- 保存过程中修改内容 → 防抖正确处理

### DATA-03: localStorage 持久化
- 主题/语言/强调色设置 → 关闭重开 → 恢复
- uiStore 初始状态从 localStorage 正确加载

### DATA-04: 文件编码
- UTF-8 BOM 文件、UTF-16 文件 → 正确处理
- `.mdstory` 始终以 UTF-8 无 BOM 保存

---

## 十四、测试执行计划

### 执行模型分配

| 测试类别 | 模型 | Agent 数 | 预计时间 |
|---------|:---:|:---:|:---:|
| L1 静态检查 | Haiku | 1 | 30s |
| L2 单元测试 | Haiku | 1 | 2min |
| P-01~P-07 解析器边界 | Haiku | 7 | 3min |
| V-01~V-04 验证器 | Haiku | 4 | 2min |
| EX-01~EX-06 导出器 | Haiku | 6 | 3min |
| TPL-01~TPL-03 模板 | Haiku | 3 | 2min |
| IPC-01~IPC-07 文件操作 | Haiku | 7 | 3min |
| MENU-01~MENU-03 菜单 | Haiku | 3 | 2min |
| ST-01~ST-05 状态管理 | Haiku | 5 | 3min |
| CMP-01~CMP-10 组件 | Haiku | 10 | 5min |
| J-01~J-12 用户旅程 | Haiku | 12 | 8min |
| EDGE-01~EDGE-08 边界 | Haiku | 8 | 5min |
| DATA-01~DATA-04 持久化 | Haiku | 4 | 3min |
| **合计** | | **71** | **~40min** |

### 并行执行策略
- L1 + L2 作为独立 Phase 0（先行验证基线）
- P-01~P-07 并行执行
- V-01~V-04 并行执行
- EX-01~EX-06 并行执行
- TPL-01~TPL-03 并行执行
- IPC-01~IPC-07 并行执行
- MENU-01~MENU-03 并行执行
- ST-01~ST-05 并行执行
- CMP-01~CMP-10 并行执行（每 5 个一组避免过多并发）
- J-01~J-12 并行执行（每 6 个一组）
- EDGE-01~EDGE-08 并行执行
- DATA-01~DATA-04 并行执行

---

## 十五、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|:---:|:---:|------|
| Vitest 测试失败（已有 746） | 低 | 高 | 先跑基线确认 |
| IPC handler 在非 Electron 环境下无法测试 | 高 | 中 | 仅验证代码路径+类型检查 |
| React Flow 组件需要 DOM 环境 | 中 | 中 | 使用 vitest jsdom 环境 |
| HTML 导出器输出需要浏览器验证 | 中 | 低 | 验证 HTML 结构+嵌入脚本语法 |
| 大文件性能无精确度量标准 | 中 | 低 | 接受 500ms 解析阈值 |
| 用户旅程 J-01~J-12 在纯 Node 环境下无法完整执行 | 高 | 中 | 验证代码路径逻辑+数据流正确性 |

---

*本文件由 QA Team Lead (Opus/V4Pro) 设计，测试执行由 Haiku/V4Flash agent 执行。*
