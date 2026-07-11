# ADR-013 — 编码斜杠 FullID、布局迁移与 JSON Schema 0.2

- **日期：** 2026-07-11
- **状态：** 已通过
- **适用范围：** Parser AST、Graph Lab、布局持久化、Validator、JSON exporter、引擎运行时与章节变量
- **覆盖关系：** 细化 ADR-008/ADR-012 的双投影合同；覆盖历史实现中以连字符拼接 FullID、JSON Schema 0.1 继续作为默认导出格式，以及章节变量只有 `scope` 而没有归属章节的做法

## 背景

产品规格一直把节点 FullID 表述为 `章节/节点`，但当前实现曾使用 `${chapterId}-${nodeId}`。只要章节或节点名称本身包含连字符，这种字符串就无法无歧义拆分；不同二元组也可能得到同一个结果。FullID 同时被 Parser、选项目标、React Flow、布局、诊断、历史和导出消费，因此不能由各模块自行拼接或猜测。

Graph Lab 已成为默认工作区，旧文件中的 `layout.graph.nodes[].id` 必须继续可读。同时，跨章节显式目标和章节作用域变量为导出增加了新的公共语义；继续声明 JSON Schema 0.1 会让运行时无法判断自己拿到的是旧的碰撞 FullID 还是新合同，也无法可靠定位 chapter-scoped variable。

## 决策

### 1. Canonical FullID

命名章节中的节点 FullID 统一为：

```text
encodeURIComponent(chapterId) + "/" + encodeURIComponent(nodeId)
```

例如：

```text
第一章 / 北门-入口
→ %E7%AC%AC%E4%B8%80%E7%AB%A0/%E5%8C%97%E9%97%A8-%E5%85%A5%E5%8F%A3
```

- `/` 是两个编码组件之间唯一未编码的结构分隔符；helper 会对组件中的保留字符执行 `encodeURIComponent`。当前 `.mdstory` 节点语法仍禁止 `/` 与 `\`，不得借 FullID 编码规则绕过源语法约束。
- FullID 是 opaque key；运行时、App 和插件禁止通过拆分字符串反推章节或节点，显示信息始终来自独立的 `chapterId/nodeId` 字段。
- 匿名章节继续没有章节组件，其 FullID 为 `encodeURIComponent(nodeId)`。匿名节点仍受全局唯一性校验。
- FullID 只能通过 core 中的共享 helper 构造。App、Graph adapter、布局、validator 和 exporter 不得复制字符串模板。
- `.mdstory` 中用户可读的目标语法不改成百分号字符串。`章节/节点：目标` 仍由 parser 分别取得章节与节点，再生成 canonical `targetFullId`。

### 2. 旧布局只读迁移

`layout.graph.version` 继续保持 `1`，`nodes[].id` 改用 canonical encoded-slash FullID。读取布局时按以下顺序解析：

1. canonical ID 精确匹配；
2. 历史实现产生的 `chapter-node`；
3. 匿名章节的旧原始 node ID。

旧 ID 不通过字符串拆分迁移。Parser 必须枚举当前 AST 中的真实 `(chapterId, nodeId)` 二元组，为每个节点计算 legacy aliases，再反向匹配：

- 恰好一个节点匹配时，在内存中迁移到 canonical FullID 并保留坐标；
- 没有匹配时保留源文本但忽略该悬空坐标；
- 多个节点匹配时禁止猜测，忽略该坐标并报告歧义诊断。

打开文件本身不得静默改写 `.mdstory`。用户下一次保存、另存为、历史感知的布局写入、拖拽落点或 Relayout 时，Serializer 把唯一可迁移的坐标统一写为 canonical ID；普通保存迁移不额外制造 Graph 历史步骤，布局操作迁移则属于该次可撤销事务。

### 3. JSON Schema 0.2

默认 JSON exporter 只生成：

```text
https://plotflow.dev/schema/0.2/story.json
```

Schema 0.2 的语义要求：

- `Node.fullId`、`Option.targetFullId` 和节点级 `下一步` 投影出的 `targetFullId` 均使用 canonical encoded-slash FullID；
- Option 明确导出可空的 `targetChapterId`，不得再从 `targetFullId` 反向猜章节；
- chapter-scoped variable 明确导出归属章节；
- 0.2 Comparison 显式导出类型化 `left/right` 操作数，完整保留 literal-left、variable-right 与操作数顺序；0.1 的 `variable/value` 形状只作为历史读取兼容；
- `$schema` 使用 `0.2`；`.mdstory` 文件语法和系统管理的 `meta.plotflow` 继续使用 `0.1`，不得由 Inspector 任意编辑；
- `Node.fullId` 是非空字符串；无目标 Option 的 `targetFullId` 允许为 null。encoded-slash 组成、唯一性和引用存在性由语义 validator 校验，避免用无法表达 `encodeURIComponent` 对等关系的正则制造伪安全。

Schema 0.1 仅作为旧运行时/旧导出物的读取兼容层，不再是当前写出格式。读取 0.1 时应尽力迁移；任何重新导出都写 0.2，不原地修改旧 JSON 文件。

### 4. 章节变量

公共 `.mdstory` 与 JSON 合同使用字段 `chapter` 表示变量的归属章节：

```yaml
vars:
  警戒值:
    type: int
    default: 0
    scope: chapter
    chapter: 第一章
```

- `scope: chapter` 时 `chapter` 必填、非空，并且必须引用一个真实章节；缺失或悬空属于 Error 级诊断并阻断导出。
- `scope: global` 或省略 scope 时禁止携带 `chapter`，避免产生看似局部、实际全局的变量。
- `chapter` 是公共序列化字段。内部实现可以使用 `chapterId` 命名，但 parser/serializer/exporter 边界必须映射为 `chapter`。
- `scope` 与 `chapter` 只允许出现在顶层变量声明；object 的嵌套 fields 是根变量的结构，必须继承顶层变量的有效 scope/chapter，禁止声明自己的 `scope` 或 `chapter`。顶层省略 scope 时默认 global。
- Graph Inspector 编辑 chapter scope 时必须提供章节选择器；切回 global 时必须清除旧 chapter 值。重命名或删除章节时，validator 必须暴露受影响变量，禁止静默重定向。

## 后果

正面：

- 合法章节名、节点名包含 `-`、`%` 或 Unicode 时仍能得到稳定、无碰撞、全局唯一的 ID。
- Graph layout、跨章节引用、历史与导出共享同一身份合同，不再依赖 UI 层猜测。
- 旧布局可以保留坐标并延迟到用户真实编辑时升级，不破坏文件即真相源原则。
- 引擎运行时可以确定 chapter-scoped variable 的归属，而不是只看到一个无上下文的 `scope: chapter`。

负面：

- FullID 字符串快照、布局 fixture、E2E、Godot/Unity 示例和消费者索引必须同步更新。
- Schema 0.1 的字符串比较快照不再能作为当前导出断言。
- 旧连字符布局在存在歧义时无法自动恢复位置，需要用户 Relayout 或手动拖拽。

## 禁止回归

- 不得重新使用 `${chapterId}-${nodeId}` 或其他可碰撞拼接作为 FullID。
- 不得在 App 层通过 `split('-')`、`lastIndexOf('/')` 等方式解析 FullID。
- 不得在打开旧文件时无历史记录地改写 layout。
- 不得把 Schema 0.2 导出标记成 0.1，也不得只升级 URL 而保留旧 FullID 值。
- 不得允许 `scope: chapter` 缺少 `chapter` 后继续导出。

## 发行门禁

严格 packaged Graph-first journey 必须从全新 profile 经原生 Open 进入 Graph Lab，修复一个 Error 诊断、完成 GUI 编辑与会话内 Undo/Redo、保存、重启并通过 Continue editing 恢复故事，同时确认新 session 历史为空，最后经原生导出对话框写出 JSON，并验证：

- `$schema === "https://plotflow.dev/schema/0.2/story.json"`；
- `targetFullId` 等于共享 helper 对章节和节点生成的 encoded-slash FullID；
- 磁盘 JSON 通过 JSON Schema 0.2 的 Ajv draft-2020-12 校验；
- 全程未进入 Split，且未使用 `__test_store__`、`window.plotflow`、localStorage 注入或 `page.evaluate()` 内部探针。

## 相关文件

- `packages/core/src/parser/`
- `packages/core/src/exporter/json.ts`
- `packages/core/src/types/ast.ts`
- `packages/app/src/services/storySourceEditService.ts`
- `packages/app/e2e-blackbox/journey.spec.ts`
- `spec/json-schema.md`
- `spec/syntax-formal.md`
- `spec/release-blackbox-gate.md`
