// ============================================================================
// PlotFlow Unity Runtime Interface — IPlotFlowReader
//
// 标准化读取接口 (M4-22)
// 对应 json-schema.md §9.3 Unity 集成
//
// 所有游戏引擎插件必须实现此接口，确保跨引擎行为一致：
//   1. LoadStory()              — 加载并解析 story.json
//   2. GetNode()                — 按 fullId 获取节点
//   3. GetAvailableOptions()    — 根据当前变量状态过滤可用选项
//
// 版本: 0.2.0（保留 0.1 Dictionary API）
// 日期: 2026-07-11
// ============================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PlotFlow
{
    // ============================================================================
    // 顶层数据模型
    // ============================================================================

    /// <summary>
    /// 完整故事数据。
    /// 对应 json-schema.md §2 顶层结构。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class PlotFlowData
    {
        [JsonProperty("$schema")]
        public string SchemaVersion;

        [JsonProperty("meta")]
        public StoryMeta Meta;

        [JsonProperty("variables")]
        public Dictionary<string, VariableDeclaration> Variables;

        [JsonProperty("chapters")]
        public List<Chapter> Chapters;
    }

    /// <summary>
    /// 故事元信息。
    /// 对应 json-schema.md §3 Meta 对象。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class StoryMeta
    {
        [JsonProperty("plotflow")]
        public string Plotflow;

        [JsonProperty("title")]
        public string Title;

        [JsonProperty("author")]
        public string Author;

        [JsonProperty("engine")]
        public string Engine;

        [JsonProperty("exportedAt")]
        public string ExportedAt;
    }

    // ============================================================================
    // 变量系统
    // ============================================================================

    /// <summary>
    /// 变量声明。
    /// 对应 json-schema.md §4 VariableDef。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class VariableDeclaration
    {
        [JsonProperty("type")]
        public string Type;          // "int" | "float" | "bool" | "string" | "enum" | "object"

        [JsonProperty("scope")]
        public string Scope;         // "global" | "chapter"

        // 0.1 compatibility: older integrations may still provide a concrete chapter.
        [JsonProperty("chapter")]
        public string Chapter;       // 仅 scope="chapter" 时使用

        [JsonProperty("values")]
        public List<string> Values;  // 仅 type="enum" 时使用

        [JsonProperty("fields")]
        public Dictionary<string, VariableDeclaration> Fields; // 仅 type="object" 时使用

        [JsonProperty("description")]
        public string Description;

        // 默认值以 JSON 原生类型存储。解析时根据 Type 字段反序列化具体值。
        // 例如: int → long, float → double, bool → bool, string → string
        [JsonProperty("default")]
        public object DefaultValue;
    }

    // ============================================================================
    // 章节与节点
    // ============================================================================

    /// <summary>
    /// 章节。
    /// 对应 json-schema.md §5.1 Chapter。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class Chapter
    {
        [JsonProperty("id")]
        public string Id;

        [JsonProperty("title")]
        public string Title;

        [JsonProperty("nodes")]
        public List<StoryNode> Nodes;
    }

    /// <summary>
    /// 故事节点。
    /// 对应 json-schema.md §5.2 Node。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class StoryNode
    {
        [JsonProperty("id")]
        public string Id;

        [JsonProperty("chapterId")]
        public string ChapterId;

        [JsonProperty("fullId")]
        public string FullId;

        [JsonProperty("title")]
        public string Title;

        [JsonProperty("body")]
        public List<string> Body;

        [JsonProperty("options")]
        public List<StoryOption> Options;

        [JsonProperty("position")]
        public NodePosition Position;

        [JsonProperty("isRoot")]
        public bool IsRoot;

        [JsonProperty("isOrphan")]
        public bool IsOrphan;

        [JsonProperty("isDeadEnd")]
        public bool IsDeadEnd;
    }

    /// <summary>
    /// 分支图布局坐标。
    /// 对应 json-schema.md §5.2 Node.position。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class NodePosition
    {
        [JsonProperty("x")]
        public float X;

        [JsonProperty("y")]
        public float Y;
    }

    // ============================================================================
    // 选项
    // ============================================================================

    /// <summary>
    /// 选项。
    /// 对应 json-schema.md §5.3 Option。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class StoryOption
    {
        [JsonProperty("index")]
        public int Index;

        [JsonProperty("text")]
        public string Text;

        [JsonProperty("targetNodeId")]
        public string TargetNodeId;

        [JsonProperty("targetChapterId")]
        public string TargetChapterId;

        [JsonProperty("targetFullId")]
        public string TargetFullId;

        [JsonProperty("conditions")]
        public ConditionExpression Conditions;

        [JsonProperty("sideEffects")]
        public List<SideEffect> SideEffects;
    }

    // ============================================================================
    // 条件表达式
    // ============================================================================

    /// <summary>
    /// 条件表达式。
    /// 对应 json-schema.md §5.4 ConditionExpression。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class ConditionExpression
    {
        /// <summary>人类可读的条件表达式文本，如 "($金币>=10) AND ($武器!='无')"。</summary>
        [JsonProperty("expression")]
        public string Expression;

        /// <summary>
        /// 条件 AST。使用原始 JSON 节点存储，由运行时评估器解析。
        /// 运行时通过 ConditionEvaluator.Evaluate() 方法递归解释。
        /// </summary>
        [JsonProperty("ast")]
        public object Ast;
    }

    /// <summary>
    /// AST 节点类型常量。
    /// 对应 json-schema.md §5.4 AST 节点类型总览。
    /// </summary>
    public static class AstNodeTypes
    {
        public const string LogicalAnd = "logical_and";
        public const string LogicalOr = "logical_or";
        public const string LogicalNot = "logical_not";
        public const string Comparison = "comparison";
        public const string FieldAccess = "field_access";
    }

    // ============================================================================
    // 副作用
    // ============================================================================

    /// <summary>
    /// 副作用（变量操作）。
    /// 对应 json-schema.md §5.5 SideEffect。
    /// </summary>
    [Serializable]
    [JsonObject(MemberSerialization.OptIn)]
    public class SideEffect
    {
        [JsonProperty("variable")]
        public string Variable;

        [JsonProperty("operation")]
        public string Operation; // "set" | "add" | "subtract" | "append"

        [JsonProperty("value")]
        public object Value;
    }

    // ============================================================================
    // 条件枚举
    // ============================================================================

    /// <summary>比较运算符。</summary>
    public enum ComparisonOperator
    {
        Equal,          // ==
        NotEqual,       // !=
        GreaterThan,    // >
        LessThan,       // <
        GreaterOrEqual, // >=
        LessOrEqual     // <=
    }

    /// <summary>逻辑运算符。</summary>
    public enum LogicalOperator
    {
        And,
        Or,
        Not
    }

    // ============================================================================
    // 标准化读取接口
    // ============================================================================

    /// <summary>
    /// PlotFlow 标准化读取接口。
    ///
    /// 所有游戏引擎（Unity / Godot / Unreal）的运行时加载器均应实现
    /// 语义等价的接口，确保跨引擎故事运行时行为一致。
    ///
    /// 实现约定:
    ///   - LoadStory() 应在游戏启动时或章节切换时调用一次
    ///   - GetNode() 是无副作用的纯查询
    ///   - GetAvailableOptions() 是纯查询，不修改变量状态
    ///   - 变量状态的修改通过 VariableStore 独立管理
    ///
    /// 数据流:
    ///   LoadStory → 构建节点索引 → GetNode 查询
    ///                               → GetAvailableOptions 条件过滤
    /// </summary>
    public interface IPlotFlowReader
    {
        /// <summary>
        /// 加载并解析 story.json 文件。
        /// 构建节点索引（fullId → StoryNode）和变量表。
        /// </summary>
        /// <param name="jsonPath">story.json 文件的路径（相对或绝对）。</param>
        /// <returns>解析后的完整故事数据，含所有章节、节点、变量声明。</returns>
        /// <exception cref="System.IO.FileNotFoundException">文件不存在时抛出。</exception>
        /// <exception cref="PlotFlowParseException">JSON 格式错误或违反 Schema 规则时抛出。</exception>
        PlotFlowData LoadStory(string jsonPath);

        /// <summary>
        /// 按 fullId 获取节点。
        /// </summary>
        /// <param name="nodeId">
        /// 全局唯一节点标识符 (fullId)，格式为 "chapterId/nodeId"。
        /// 例如: "第一章/森林入口"。
        /// </param>
        /// <returns>匹配的节点，若不存在则返回 null。</returns>
        StoryNode GetNode(string nodeId);

        /// <summary>
        /// 获取指定节点中当前可用的选项列表。
        /// 根据运行时变量状态评估每个选项的 conditions:
        ///   - conditions == null → 始终可用
        ///   - 条件评估为 true → 可用
        ///   - 条件评估为 false → 从返回列表中排除
        /// </summary>
        /// <param name="nodeId">当前所在节点的 fullId。</param>
        /// <param name="variables">当前运行时变量状态（变量名 → 值）。</param>
        /// <returns>通过条件筛选的可用选项列表（保持原 index 顺序）。</returns>
        List<StoryOption> GetAvailableOptions(string nodeId, Dictionary<string, object> variables);
    }

    /// <summary>
    /// 可选的 0.2 作用域感知读取接口。旧的 Dictionary 入口保留在
    /// IPlotFlowReader 中，现有项目无需迁移即可继续运行。
    /// </summary>
    public interface IPlotFlowScopedReader : IPlotFlowReader
    {
        List<StoryOption> GetAvailableOptions(string nodeId, PlotFlowVariableStore variables);
    }

    // ============================================================================
    // 异常类型
    // ============================================================================

    /// <summary>PlotFlow JSON 解析异常。</summary>
    public class PlotFlowParseException : Exception
    {
        public PlotFlowParseException(string message) : base(message) { }
        public PlotFlowParseException(string message, Exception inner) : base(message, inner) { }
    }
}
