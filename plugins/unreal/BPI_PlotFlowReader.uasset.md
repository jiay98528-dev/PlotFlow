# BPI_PlotFlowReader — 蓝图接口占位说明

> **文件**: `plugins/unreal/BPI_PlotFlowReader.uasset`
> **状态**: 占位说明 (M4-25)
> **实际 .uasset 需在 Unreal 编辑器中手动创建**
>
> **关联**: `plugins/unreal/PlotFlowDataTypes.h` (M4-26)
> **版本**: 0.1.0 | **日期**: 2026-06-13

---

## 创建步骤

在 Unreal 编辑器中按以下步骤手动创建 `BPI_PlotFlowReader` 蓝图接口：

1. 打开 Unreal Editor，确保已将 `PlotFlowDataTypes.h` 加入项目模块
2. 在 Content Browser 中右键 → `Blueprints` → `Blueprint Interface`
3. 命名为 `BPI_PlotFlowReader`
4. 保存到 `Content/PlotFlow/Blueprints/BPI_PlotFlowReader.uasset`

---

## 接口函数定义

该蓝图接口定义以下 4 个函数，与 Unity 的 `IPlotFlowReader` C# 接口语义等价。

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
    UPROPERTY(BlueprintReadOnly) TArray<FPlotFlowNode> Nodes;     // 扁平化节点列表
    UPROPERTY(BlueprintReadOnly) TMap<FString, FPlotFlowVariable> Variables;
};
```

### 函数 2: GetNode

| 属性 | 值 |
|------|-----|
| **函数名** | `GetNode` |
| **输入** | `NodeId` (FString) — 节点 fullId (如 "第一章/森林入口") |
| **输出** | `Return Value` (FPlotFlowNode) — 匹配的节点结构体；若不存在返回空结构体 |
| **描述** | 按 fullId 查询已加载故事中的节点 |

### 函数 3: GetAvailableOptions

| 属性 | 值 |
|------|-----|
| **函数名** | `GetAvailableOptions` |
| **输入** | `NodeId` (FString) — 当前所在节点的 fullId |
| | `Variables` (TMap<FString, FString>) — 当前运行时变量状态 |
| **输出** | `Return Value` (TArray<FPlotFlowOption>) — 通过条件筛选的可用选项列表 |
| **描述** | 根据变量状态评估指定节点的所有选项条件，返回可用选项 |
| **引擎逻辑** | 遍历 `Node.Options`，对每个选项评估 `Condition`：null 或空 → 可用；评估为 true → 可用；false → 跳过 |

### 函数 4: ApplySideEffects

| 属性 | 值 |
|------|-----|
| **函数名** | `ApplySideEffects` |
| **输入** | `Effects` (TArray<FPlotFlowSideEffect>) — 要执行的副作用列表 |
| | `Variables` (TMap<FString, FString>, **updatable**) — 变量状态映射（原地修改） |
| **输出** | 无 |
| **描述** | 执行副作用列表，原地修改变量状态 |
| **引擎逻辑** | 遍历 Effects，根据 `Operation` 执行 set/add/subtract/append |

---

## 运行时调用流程

```
1. BeginPlay / 关卡加载
   └── LoadStory("Content/Stories/my-story.json")
        ├── 解析 JSON → FPlotFlowStoryResult
        ├── 构建节点索引 (TMap<FString, FPlotFlowNode>)
        ├── 初始化变量默认值 (TMap<FString, FString>)
        └── 获取根节点 fullId

2. 显示当前节点内容
   └── GetNode(CurrentFullId)
        └── 读取 Body、Options → UI 渲染

3. 获取可用选项
   └── GetAvailableOptions(CurrentFullId, Variables)
        └── 条件评估 → 返回可用选项列表

4. 玩家选择选项
   ├── ApplySideEffects(Option.Effects, Variables)
   │   └── 变量状态更新
   └── Set CurrentFullId = Option.TargetFullId
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
    5. 填充 TMap<FString, FPlotFlowNode> 节点索引
    6. 返回 FPlotFlowStoryResult

Event GetNode(NodeId)
    1. 在节点索引 TMap 中查找
    2. 找到 → 返回 FPlotFlowNode
    3. 未找到 → 返回空 FPlotFlowNode

Event GetAvailableOptions(NodeId, Variables)
    1. GetNode(NodeId) → 获取节点
    2. 遍历节点.Options
    3. 对每个选项:
       a. 若 Condition 为空 → 始终添加
       b. 若 Condition 非空 → 调用 EvaluateCondition
    4. 返回可用选项数组

Event ApplySideEffects(Effects, Variables)
    1. 遍历 Effects
    2. 根据 Operation 分支:
       - Set → Variables[Variable] = Value
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
- [ ] `GetNode("第一章/森林入口")` 返回正确节点
- [ ] 无条件选项在 `GetAvailableOptions` 中始终返回
- [ ] 满足条件的选项正确返回
- [ ] 不满足条件的选项正确过滤
- [ ] `ApplySideEffects` 正确修改变量值（set/add/subtract/append）
- [ ] 嵌套字段路径如 "角色状态.生命" 正确解析
