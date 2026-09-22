# JSON 导出合同

> 文档导航：[故事数据与引擎索引](../doc/indexes/data.md) · [总索引](../doc/INDEX.md)

## 1. 版本与权威来源

当前写出为 [Schema 0.2](../packages/core/schema/0.2/story.json)；[Schema 0.1](../packages/core/schema/0.1/story.json) 仅保留旧数据读取兼容。机器 Schema 使用 draft-2020-12；官网镜像位于 website/public/schema，对应内容由 scripts/sync-story-schema.mjs 同步。

软件版本、源文本格式与 JSON Schema 是三个独立概念。源文本及 meta.plotflow 仍为 0.1，当前 JSON 的 $schema 必须为 https://plotflow.dev/schema/0.2/story.json。不要把编辑器的 0.1.1 软件版本写入 meta.plotflow。

本文件解释当前机器合同，不再内嵌旧 Schema 全文或复制引擎实现。修改字段时同步机器 Schema、生成校验器、导出器、引擎消费者与此处说明；具体身份规则见 [ADR-013](../doc/adr/ADR-013-fullid-schema-02.md)。

## 2. 顶层结构

顶层必须包含 $schema、meta、variables、chapters，禁止额外字段。chapters 至少有一个章节，每个章节至少一个节点。空故事、空章节等不满足导出结构时产生 E009；JSON/HTML/TXT 的共同导出检查拒绝 Error 级诊断。

## 3. Meta 对象

| 字段 | 说明 |
|---|---|
| plotflow | 源格式版本，当前为 0.1 |
| title | 非空故事标题 |
| author | 可选作者字符串 |
| engine | godot / unity / unreal / none |
| exportedAt | 导出时生成的 date-time 字符串 |

源文本和内部 AST 使用 generic 表示通用引擎，导出边界映射为 none；不把未知字符串直接写入 JSON。

## 4. Variables 定义

variables 是以不含 $ 前缀的变量名为 key 的对象。每个变量包含 type，可选 default、description；支持 int、float、bool、string、enum、object。

- int 默认值为整数，float 为数字，bool 为布尔值，string 为字符串。
- enum 必须有非空、不重复的字符串 values；默认值和枚举成员的一致性由语义检查负责。
- object 必须有 fields；字段递归使用同样的类型结构，嵌套最多三层由解析/语义层限制。
- 顶层可声明 scope: global 或 chapter；省略时按 global 处理。
- scope 为 chapter 时必须给出非空 chapter，并引用真实章节。global 变量不能携带 chapter。
- object 的 fields 不能单独声明 scope/chapter，继承根变量作用域。

## 5. Chapters、Nodes 与 Options

### 5.1 Chapter

包含非空 id、title 和非空 nodes 数组。

### 5.2 Node

必须包含 id、chapterId、fullId、title、body、options、position、isRoot、isOrphan、isDeadEnd。body 是字符串数组，position 包含数值 x/y，三个状态字段为布尔值。

FullID 通过 Core [fullId.ts](../packages/core/src/fullId.ts) 生成。命名章节节点为 encodeURIComponent(chapterId) + '/' + encodeURIComponent(nodeId)，匿名章节按共享 helper 规则生成。FullID 是不透明 key；引擎用独立章节字段，不自行拆字符串。

源文本的节点级“下一步”在 JSON 中投影为一个 Option，text 为“下一步”，conditions 为 null，效果与目标字段由该出口提供；不新增 nextTarget JSON 字段。

### 5.3 Option

必须包含 index、text、targetNodeId、targetChapterId、targetFullId、conditions、sideEffects。index 为非负整数，text 非空，三个目标字段必须存在但允许 null。conditions 为 null 或条件对象，sideEffects 为数组。

目标引用一致性、FullID 唯一性和目标存在性由语义校验负责，不用 Schema 正则代替跨节点检查。

### 5.4 条件

条件对象包含 expression 与 ast。AST 允许 comparison、logical_and、logical_or、logical_not、field_access。

0.2 comparison 的字段为 type、left、operator、right。left/right 均为带类型的操作数：variable 使用 name，literal 使用 value。operator 为 ==、!=、>、<、>=、<=。变量 name 不带 $；对象字段用完整点路径。

AND/OR 节点包含 left/right，NOT 节点包含 operand。field_access 包含 object 和 field，object 可继续是字段访问节点。普通对象字段比较通常直接使用 variable 操作数的点路径。

0.1 的 variable/value 比较形状只属于旧数据读取，不属于 0.2 写出。

### 5.5 效果

每项包含 variable、operation、value；operation 为 set、add、subtract、append。value 支持数字、布尔值、字符串和递归对象；具体操作与变量类型的一致性由语义校验负责。

## 6. 可运行示例与消费者

直接使用 [0.2 故事 fixture](../tests/engine-contract/fixtures/story-0.2.json)；旧兼容示例为 [0.1 fixture](../tests/engine-contract/fixtures/story-0.1.json)。这些文件与引擎合同测试共同维护，避免文档复制出另一套数据。

| 消费者 | 当前维护入口 |
|---|---|
| Godot | [StoryLoader.gd](../addons/plotflow/runtime/StoryLoader.gd)、ConditionEval.gd、VariableStore.gd |
| Unity | [IPlotFlowReader.cs](../plugins/unity/IPlotFlowReader.cs) 与 [PlotFlowJsonReader.cs](../plugins/unity/PlotFlowJsonReader.cs) |
| Unreal | [PlotFlowDataTypes.h](../plugins/unreal/PlotFlowDataTypes.h) 与 [蓝图接口说明](../plugins/unreal/BPI_PlotFlowReader.uasset.md) |

三种接入的完整程度不同，以 [产品范围](../PRD.md) 为准。合同测试不是实际引擎工具链运行结果。

## 7. 验证与维护

- JSON exporter 在写出前使用生成的 Ajv standalone 校验器；直接编辑生成文件会被下一次生成覆盖。
- 更新 Schema 后运行 generate:schema-validator，并同步官网镜像。
- check:schema 核对镜像与生成校验器，test:engine-contract 核对跨语言数据消费合同。
- 软件的当前测试与交付结果只维护在 [progress.md](progress.md)。
