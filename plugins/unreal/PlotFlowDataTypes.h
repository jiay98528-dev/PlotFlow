// ============================================================================
// PlotFlow Unreal Engine 数据模型 — PlotFlowDataTypes.h
//
// C++ 结构体定义 (M4-26)
// 对应 json-schema.md §9.4 Unreal 集成
//
// 提供给蓝图和 C++ 运行时使用的 PlotFlow 数据结构体。
// 所有结构体均标记 USTRUCT(BlueprintType)，允许在蓝图中直接读写。
//
// 包含:
//   FPlotFlowVariable   — 变量定义（名称/类型/默认值）
//   FPlotFlowOption     — 选项（描述/目标/条件/效果）
//   FPlotFlowNode       — 节点（ID/标题/正文/选项列表）
//
// 使用方式:
//   1. 将此文件放入 Unreal 项目的 Source/YourModule/Public/ 目录
//   2. 确保模块的 Build.cs 包含 "Json", "JsonUtilities" 依赖
//   3. 包含 #include "PlotFlowDataTypes.h" 后即可使用
//   4. 在 Unreal 编辑器中创建 BPI_PlotFlowReader 蓝图接口引用这些结构体
//
// 版本: 0.1.0
// 日期: 2026-06-13
// ============================================================================

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "PlotFlowDataTypes.generated.h"

// ============================================================================
// 前置声明
// ============================================================================

struct FPlotFlowOption;

// ============================================================================
// 枚举
// ============================================================================

/// <summary>
/// 变量类型枚举。
/// 对应 json-schema.md §4.1 类型系统。
/// </summary>
UENUM(BlueprintType)
enum class EPlotFlowVariableType : uint8
{
    Int     UMETA(DisplayName = "int"),
    Float   UMETA(DisplayName = "float"),
    Bool    UMETA(DisplayName = "bool"),
    String  UMETA(DisplayName = "string"),
    Enum    UMETA(DisplayName = "enum"),
    Object  UMETA(DisplayName = "object")
};

/// <summary>
/// 变量作用域。
/// 对应 json-schema.md §4.3 Scope 说明。
/// </summary>
UENUM(BlueprintType)
enum class EPlotFlowVariableScope : uint8
{
    Global  UMETA(DisplayName = "global"),
    Chapter UMETA(DisplayName = "chapter")
};

/// <summary>
/// 副作用操作类型。
/// 对应 json-schema.md §5.5 操作对照表。
/// </summary>
UENUM(BlueprintType)
enum class EPlotFlowSideEffectOp : uint8
{
    Set      UMETA(DisplayName = "set"),
    Add      UMETA(DisplayName = "add"),
    Subtract UMETA(DisplayName = "subtract"),
    Append   UMETA(DisplayName = "append")
};

/// <summary>
/// 比较运算符。
/// 对应 json-schema.md §5.4 Comparison 的 operator 枚举。
/// </summary>
UENUM(BlueprintType)
enum class EPlotFlowComparisonOp : uint8
{
    Equal          UMETA(DisplayName = "=="),
    NotEqual       UMETA(DisplayName = "!="),
    GreaterThan    UMETA(DisplayName = ">"),
    LessThan       UMETA(DisplayName = "<"),
    GreaterOrEqual UMETA(DisplayName = ">="),
    LessOrEqual    UMETA(DisplayName = "<=")
};

/// <summary>
/// AST 节点类型。
/// 对应 json-schema.md §5.4 AST 节点类型总览。
/// </summary>
UENUM(BlueprintType)
enum class EPlotFlowAstType : uint8
{
    LogicalAnd   UMETA(DisplayName = "logical_and"),
    LogicalOr    UMETA(DisplayName = "logical_or"),
    LogicalNot   UMETA(DisplayName = "logical_not"),
    Comparison   UMETA(DisplayName = "comparison"),
    FieldAccess  UMETA(DisplayName = "field_access")
};

// ============================================================================
// 数据结构体
// ============================================================================

/// <summary>
/// 变量定义。
/// 描述一个故事变量的名称、类型、默认值及类型特定属性。
/// 对应 json-schema.md §4 的 VariableDef。
///
/// 蓝图用法:
///   通过 EPlotFlowVariableType 区分变量类型。
///   - enum 类型: 使用 EnumValues 数组声明合法值列表
///   - object 类型: 使用 Fields 映射声明子字段（最多 3 层嵌套）
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowVariable
{
    GENERATED_BODY()

    /// <summary>变量名（不含 $ 前缀）。例如 "好感度"、"金币"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    FString Name;

    /// <summary>变量类型。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    EPlotFlowVariableType Type = EPlotFlowVariableType::Int;

    /// <summary>变量作用域。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    EPlotFlowVariableScope Scope = EPlotFlowVariableScope::Global;

    /// <summary>仅 scope==Chapter 时使用，指明所属章节 ID。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    FString Chapter;

    /// <summary>
    /// 默认值。
    /// 以 FString 形式存储，读取时根据 Type 字段做类型转换:
    ///   Int    → FCString::Atoi(*DefaultValue)
    ///   Float  → FCString::Atof(*DefaultValue)
    ///   Bool   → DefaultValue == "true"
    ///   String → 直接使用 DefaultValue
    ///   Enum   → 直接使用 DefaultValue（必须为 EnumValues 中一员）
    ///   Object → 递归解析子字段的 DefaultValue
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    FString DefaultValue;

    /// <summary>仅 Type==Enum 时使用。合法值列表，索引 0 为默认值。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    TArray<FString> EnumValues;

    /// <summary>仅 Type==Object 时使用。子字段定义映射（字段名 → 定义）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Variable")
    TMap<FString, FPlotFlowVariable> Fields;
};

/// <summary>
/// 副作用（变量操作）。
/// 对应 json-schema.md §5.5 SideEffect。
///
/// 在选项被选择后执行，修改运行时变量状态。
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowSideEffect
{
    GENERATED_BODY()

    /// <summary>
    /// 目标变量名。
    /// 支持点号路径访问嵌套字段，例如 "角色状态.生命"。
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|SideEffect")
    FString Variable;

    /// <summary>操作类型: set / add / subtract / append。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|SideEffect")
    EPlotFlowSideEffectOp Operation = EPlotFlowSideEffectOp::Set;

    /// <summary>
    /// 操作值（字符串表示）。
    /// 运行时根据 Variable 对应的变量类型做类型转换。
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|SideEffect")
    FString Value;
};

/// <summary>
/// 条件表达式的 AST 节点。
/// 对应 json-schema.md §5.4 的 Comparison / LogicalAnd / LogicalOr / LogicalNot / FieldAccess。
///
/// 此结构体采用统一格式的"指令式"表示而非完整树结构，便于蓝图直接构造和理解。
/// 复杂嵌套条件（AND/OR 组合）在 C++ 运行时通过递归函数 PlotFlow::EvalCondition() 解释。
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowConditionNode
{
    GENERATED_BODY()

    /// <summary>AST 节点类型。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    EPlotFlowAstType NodeType = EPlotFlowAstType::Comparison;

    /// <summary>比较运算的变量名（或字段路径），例如 "金币"、"角色状态.魔力"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FString Variable;

    /// <summary>比较运算符（NodeType==Comparison 时使用）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    EPlotFlowComparisonOp Operator = EPlotFlowComparisonOp::Equal;

    /// <summary>比较值（字符串表示，运行时会做类型转换）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FString ComparisonValue;

    /// <summary>
    /// FieldAccess 对象名（NodeType==FieldAccess 时使用）。
    /// 例如: "角色状态"
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FString FieldObject;

    /// <summary>
    /// FieldAccess 字段名（NodeType==FieldAccess 时使用）。
    /// 例如: "魔力"
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FString FieldName;

    // --- 嵌套子节点（用于 LogicalAnd / LogicalOr / LogicalNot） ---

    /// <summary>左子节点（LogicalAnd / LogicalOr 使用）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FPlotFlowConditionNode Left;

    /// <summary>右子节点（LogicalAnd / LogicalOr 使用）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FPlotFlowConditionNode Right;

    /// <summary>被否定子节点（LogicalNot 使用）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Condition")
    FPlotFlowConditionNode Operand;
};

/// <summary>
/// 选项。
/// 对应 json-schema.md §5.3 Option。
///
/// 描述玩家在某个节点可以做出的一个选择:
///   - 显示文本 (Text)
///   - 跳转目标 (TargetId)
///   - 出现条件 (Condition) — 条件不满足时该选项隐藏或灰显
///   - 选择后效果 (Effects) — 变量修改列表
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowOption
{
    GENERATED_BODY()

    /// <summary>选项在节点内的序号（从 0 开始）。用于保持显示顺序。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    int32 Index = 0;

    /// <summary>选项显示文本。例如 "走向左边的狼嚎声"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    FString Text;

    /// <summary>跳转目标节点 ID（不含章节前缀）。例如 "狼穴"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    FString TargetNodeId;

    /// <summary>跳转目标全局唯一 fullId。例如 "第一章/狼穴"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    FString TargetFullId;

    /// <summary>
    /// 出现条件。null / 空节点 表示始终可用。
    /// 非空时，引擎在显示选项前评估此条件。
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    FPlotFlowConditionNode Condition;

    /// <summary>
    /// 选择后执行的副作用列表。
    /// 空列表表示无副作用。
    /// </summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Option")
    TArray<FPlotFlowSideEffect> Effects;
};

/// <summary>
/// 分支图布局坐标。
/// 对应 json-schema.md §5.2 Node.position。
///
/// 仅用于编辑器分支图布局恢复。引擎运行时忽略此字段。
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowPosition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    float X = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    float Y = 0.0f;
};

/// <summary>
/// 故事节点。
/// 对应 json-schema.md §5.2 Node。
///
/// 叙事分支图中的一个节点，包含描述正文和可选项列表。
/// 是运行时最核心的数据结构——游戏逻辑通过当前节点的
/// Body 获取叙事文本，通过 Options 获取玩家选择。
/// </summary>
USTRUCT(BlueprintType)
struct FPlotFlowNode
{
    GENERATED_BODY()

    /// <summary>节点 ID（不含章节前缀）。例如 "森林入口"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    FString Id;

    /// <summary>所属章节 ID。例如 "第一章"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    FString ChapterId;

    /// <summary>全局唯一节点 ID，格式 "chapterId/nodeId"。例如 "第一章/森林入口"。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    FString FullId;

    /// <summary>节点显示标题。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    FString Title;

    /// <summary>节点描述正文段落列表。每个元素为一个段落。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    TArray<FString> Body;

    /// <summary>可用选项列表（可为空——死胡同节点）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    TArray<FPlotFlowOption> Options;

    /// <summary>分支图布局坐标（运行时忽略）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    FPlotFlowPosition Position;

    /// <summary>是否为根节点（故事起始节点）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    bool bIsRoot = false;

    /// <summary>诊断: 是否为孤立节点（无入口路径，根节点除外）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    bool bIsOrphan = false;

    /// <summary>诊断: 是否为死胡同（无出口选项）。</summary>
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "PlotFlow|Node")
    bool bIsDeadEnd = false;
};

// ============================================================================
// 辅助函数命名空间
// ============================================================================

/// <summary>
/// PlotFlow 运行时辅助函数。
/// 提供条件评估和副作用应用等核心功能。
/// </summary>
namespace PlotFlow
{
    /// <summary>
    /// 从 JSON 字符串解析 FPlotFlowNode 数组。
    /// 对应 json-schema.md §9.5 步骤 3: 索引节点。
    ///
    /// 使用示例:
    ///   TArray<FPlotFlowNode> Nodes;
    ///   PlotFlow::ParseNodesFromJson(JsonString, Nodes);
    /// </summary>
    /// <param name="JsonString">JSON 格式的节点数据。</param>
    /// <param name="OutNodes">解析后的节点数组。</param>
    /// <returns>解析成功返回 true，失败返回 false。</returns>
    bool ParseNodesFromJson(const FString& JsonString, TArray<FPlotFlowNode>& OutNodes);

    /// <summary>
    /// 评估条件 AST 节点。
    /// 对应 json-schema.md §9.2 Godot ConditionEval 的 C++ 等价实现。
    ///
    /// 递归遍历 FPlotFlowConditionNode 树，对照变量状态返回 true/false。
    /// </summary>
    /// <param name="Condition">条件 AST 根节点。</param>
    /// <param name="Variables">当前变量状态映射（变量名 → 字符串值）。</param>
    /// <returns>条件满足返回 true，否则返回 false。</returns>
    bool EvaluateCondition(const FPlotFlowConditionNode& Condition, const TMap<FString, FString>& Variables);

    /// <summary>
    /// 应用副作用列表。
    /// 对应 json-schema.md §9.2 Godot VariableStore.apply_effects()。
    ///
    /// 原地修改 Variables 映射。
    /// </summary>
    /// <param name="Effects">要执行的副作用列表。</param>
    /// <param name="Variables">要修改的变量状态映射（原地修改）。</param>
    void ApplySideEffects(const TArray<FPlotFlowSideEffect>& Effects, TMap<FString, FString>& Variables);
};
