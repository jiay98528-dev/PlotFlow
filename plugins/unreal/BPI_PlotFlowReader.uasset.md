# BPI_PlotFlowReader — 蓝图接口占位说明

> **文件**: `plugins/unreal/BPI_PlotFlowReader.uasset`
> **状态**: 占位说明 (M4-25)
> **实际 .uasset 需在 Unreal 编辑器中手动创建**
>
> **关联**: `plugins/unreal/PlotFlowDataTypes.h` (M4-26)
> **版本**: 0.2.0 | **日期**: 2026-07-11

---

## 创建步骤

在 Unreal 编辑器中按以下步骤手动创建 `BPI_PlotFlowReader` 蓝图接口：

1. 打开 Unreal Editor，确保已将 `PlotFlowDataTypes.h` 加入项目模块
2. 在 Content Browser 中右键 → `Blueprints` → `Blueprint Interface`
3. 命名为 `BPI_PlotFlowReader`
4. 保存到 `Content/PlotFlow/Blueprints/BPI_PlotFlowReader.uasset`

---

## 接口函数定义

该蓝图接口定义以下 5 个首选函数，与 Unity 的 scope-aware 读取接口语义等价。0.1 的平面 `TMap<FString, FString>` 入口仍保留在“兼容入口”一节。

### 函数 1: LoadStory

| 属性 | 值 |
|------|-----|
| **函数名** | `LoadStory` |
| **输入** | `JsonPath` (FString) — story.json 的绝对或相对路径 |
| **输出** | `Return Value` (FPlotFlowStoryResult) — 包含解析结果的结构体 |
| **描述** | 加载并解析 PlotFlow JSON 文件，构建节点索引 |

需要先在 C++ 中定义以下辅助结构体：

```cpp
USTRUCT(BlueprintType)
struct FPlotFlowStoryResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) bool bSuccess;
    UPROPERTY(BlueprintReadOnly) FString ErrorMessage;
    UPROPERTY(BlueprintReadOnly) FString StoryTitle;
    UPROPERTY(BlueprintReadOnly) FString PlotFlowVersion;        // 支持 0.1/0.2；更高版本 warning
    UPROPERTY(BlueprintReadOnly) TArray<FPlotFlowChapter> Chapters;
    UPROPERTY(BlueprintReadOnly) TArray<FPlotFlowNode> Nodes;     // 扁平化节点列表
    UPROPERTY(BlueprintReadOnly) TMap<FString, FPlotFlowVariable> Variables;
    UPROPERTY(BlueprintReadOnly) FPlotFlowVariableStore VariableStore;
    UPROPERTY(BlueprintReadOnly) FString RootFullId;
};
```

`LoadStory` 必须遍历标准 `chapters[].nodes[]`。`fullId` 是导出器提供的 opaque key，只能原样索引，禁止按 `/`、`-` 或章节标题拆分/重组。缺少 `fullId` 的旧 0.1 数据可用唯一局部 `id` 兼容；同名歧义时必须失败而不是猜测。

### 函数 2: GetNode

| 属性 | 值 |
|------|-----|
| **函数名** | `GetNode` |
| **输入** | `NodeId` (FString) — 导出器给出的 opaque 节点 fullId |
| **输出** | `Return Value` (FPlotFlowNode) — 匹配的节点结构体；若不存在返回空结构体 |
| **描述** | 按 fullId 查询已加载故事中的节点 |

### 函数 3: GetAvailableOptions

| 属性 | 值 |
|------|-----|
| **函数名** | `GetAvailableOptions` |
| **输入** | `NodeId` (FString) — 当前所在节点的 opaque fullId |
| | `VariableStore` (FPlotFlowVariableStore) — 含 global/chapter 命名空间和 CurrentChapterId |
| **输出** | `Return Value` (TArray<FPlotFlowOption>) — 通过条件筛选的可用选项列表 |
| **描述** | 根据变量状态评估指定节点的所有选项条件，返回可用选项 |
| **引擎逻辑** | 遍历 `Node.Options`，对每个选项评估 `Condition`：null 或空 → 可用；评估为 true → 可用；false → 跳过 |

### 函数 4: ApplySideEffects

| 属性 | 值 |
|------|-----|
| **函数名** | `ApplySideEffects` |
| **输入** | `Effects` (TArray<FPlotFlowSideEffect>) — 要执行的副作用列表 |
| | `Definitions` (TMap<FString, FPlotFlowVariable>) — 变量声明及 scope |
| | `VariableStore` (FPlotFlowVariableStore, **updatable**) — 作用域状态（原地修改） |
| **输出** | 无 |
| **描述** | 根据声明 scope 修改 global 或 CurrentChapterId 对应的章节命名空间 |
| **引擎逻辑** | 遍历 Effects，根据 `Operation` 执行 set/add/subtract/append；chapter 变量不得写入 global map |

### 函数 5: SetCurrentChapter

| 属性 | 值 |
|------|-----|
| **函数名** | `SetCurrentChapter` |
| **输入** | `ChapterId` (FString) — 新的当前章节 ID |
| | `Definitions` (TMap<FString, FPlotFlowVariable>) — 变量声明 |
| | `VariableStore` (FPlotFlowVariableStore, **updatable**) |
| **输出** | 无 |
| **描述** | 更新 `CurrentChapterId`，并为首次进入的章节按 chapter-scope 默认值创建独立命名空间 |

### 0.1 兼容入口

旧蓝图可以继续使用 `GetAvailableOptions(NodeId, Variables)`、`EvaluateCondition(Condition, Variables)` 与 `ApplySideEffects(Effects, Variables)` 的平面 Map 版本。该入口等价于单一 global 命名空间，不提供章节隔离；新项目应使用 `FPlotFlowVariableStore`。

---

## 运行时调用流程

```
1. BeginPlay / 关卡加载
   └── LoadStory("Content/Stories/my-story.json")
        ├── 解析 JSON → FPlotFlowStoryResult
        ├── 构建节点索引 (TMap<FString, FPlotFlowNode>)
        ├── 初始化 FPlotFlowVariableStore.GlobalValues
        ├── 以根节点 ChapterId 调用 SetCurrentChapter
        └── 获取导出的根节点 opaque fullId

2. 显示当前节点内容
   └── GetNode(CurrentFullId)
        └── 读取 Body、Options → UI 渲染

3. 获取可用选项
   └── GetAvailableOptions(CurrentFullId, VariableStore)
        └── 条件评估 → 返回可用选项列表

4. 玩家选择选项
   ├── ApplySideEffects(Option.Effects, Definitions, VariableStore)
   │   └── 变量状态更新
   ├── Set CurrentFullId = Option.TargetFullId
   ├── GetNode(CurrentFullId).ChapterId 与 VariableStore.CurrentChapterId 不同时
   │    └── SetCurrentChapter(GetNode(CurrentFullId).ChapterId, Definitions, VariableStore)
   └── 跳转到步骤 2
```

---

## 蓝图实现参考（伪代码）

在蓝图中创建事件图表实现每个接口函数：

```
Event LoadStory(JsonPath)
    1. 使用 "Load String from File" 节点读取 JSON 文本
    2. 使用 "JsonObject::FromString" 解析
    3. 遍历 "chapters" → "nodes" 数组
    4. 对每个节点构造 FPlotFlowNode
    5. 使用节点导出的 fullId 原样填充 TMap<FString, FPlotFlowNode>
    6. 初始化 global/chapter 变量状态和 CurrentChapterId
    7. meta.plotflow 为 0.1/0.2 时正常加载；更高版本记录 warning 并忽略未知字段
    8. 返回 FPlotFlowStoryResult

Event GetNode(NodeId)
    1. 在节点索引 TMap 中查找
    2. 找到 → 返回 FPlotFlowNode
    3. 未找到 → 返回空 FPlotFlowNode

Event GetAvailableOptions(NodeId, VariableStore)
    1. GetNode(NodeId) → 获取节点
    2. 遍历节点.Options
    3. 对每个选项:
       a. 若 Condition 为空 → 始终添加
       b. 若 Condition 非空 → 使用 global + 当前 chapter 有效视图调用 EvaluateCondition
    4. 返回可用选项数组

Event ApplySideEffects(Effects, Definitions, VariableStore)
    1. 遍历 Effects
    2. 根据 Operation 分支:
       - Set → 按 Definitions[Variable].Scope 写入 global 或当前 chapter
       - Add → 数值加法
       - Subtract → 数值减法
       - Append → 字符串拼接
```

---

## 依赖项

| 依赖 | 类型 | 说明 |
|------|------|------|
| `PlotFlowDataTypes.h` | C++ 头文件 | 提供 FPlotFlowNode / FPlotFlowOption / FPlotFlowVariable 等结构体定义 |
| `Json.h` | Unreal 内置 | 用于 JSON 解析 (FJsonObject, FJsonSerializer) |
| `JsonUtilities.h` | Unreal 内置 | 用于 JSON 与 UStruct 互转 (FJsonObjectConverter) |

---

## 验证检查清单

创建完成后，在蓝图中验证以下流程：

- [ ] `LoadStory` 能正确解析标准 story.json 文件
- [ ] `LoadStory` 遍历 `chapters[].nodes[]`，并保留 opaque fullId
- [ ] `GetNode(导出的 FullId)` 返回正确节点
- [ ] 无条件选项在 `GetAvailableOptions` 中始终返回
- [ ] 满足条件的选项正确返回
- [ ] 不满足条件的选项正确过滤
- [ ] `ApplySideEffects` 正确修改变量值（set/add/subtract/append）
- [ ] 嵌套字段路径如 "角色状态.生命" 正确解析
- [ ] global 变量跨章节保持，chapter 变量在两个章节中互不污染
- [ ] 跨章节选项使用 `TargetChapterId`/`TargetFullId` 更新 CurrentChapterId
- [ ] PlotFlow 0.1/0.2 正常加载，更高版本给出 warning 而不是静默误解析
