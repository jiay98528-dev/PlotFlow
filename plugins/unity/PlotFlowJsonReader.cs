// ============================================================================
// PlotFlow Unity 运行时 — PlotFlowJsonReader
//
// 基于 JSON 的参考实现 (M4-23)
// 对应 json-schema.md §9.3 Unity 集成 + §9.5 通用解析模式
//
// 此实现演示标准解析流程:
//   1. 读取 JSON 文件
//   2. 构建 fullId → StoryNode 索引
//   3. 初始化变量默认值
//   4. 运行时条件评估 + 副作用执行
//
// 依赖: Newtonsoft.Json (可通过 Package Manager 安装)
//
// 使用示例:
//   var reader = new PlotFlowJsonReader();
//   var story = reader.LoadStory("Assets/Stories/my-story.json");
//   var rootNode = reader.GetNode(story.Chapters[0].Nodes[0].FullId);
//   var vars = new Dictionary<string, object> { { "金币", 10L } };
//   var available = reader.GetAvailableOptions(rootNode.FullId, vars);
//
// 版本: 0.2.0（兼容 0.1/0.2 JSON）
// 日期: 2026-07-11
// ============================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace PlotFlow
{
    /// <summary>
    /// Fablevia JSON 读取器的参考实现。
    ///
    /// 实现了 IPlotFlowReader 接口的全部方法。
    /// 使用 Newtonsoft.Json 解析 JSON，支持 Schema §5.4 定义的完整 AST 条件评估。
    ///
    /// 线程安全: 非线程安全。应在主线程中串行调用。
    /// </summary>
    public class PlotFlowJsonReader : IPlotFlowScopedReader
    {
        // fullId → StoryNode 映射表（Step 2: 索引节点）
        private Dictionary<string, StoryNode> _nodeIndex;

        // Unique chapter-local id fallback for 0.1 exports. Ambiguous ids are omitted.
        private Dictionary<string, StoryNode> _legacyNodeIndex;
        private HashSet<string> _ambiguousLegacyNodeIds;

        // 章节索引（chapterId → Chapter）
        private Dictionary<string, Chapter> _chapterIndex;

        // 变量声明定义（Step 1: 构建变量表原型）
        private Dictionary<string, VariableDeclaration> _variableDefs;

        // 加载后的完整故事数据
        private PlotFlowData _storyData;

        // ======================================================================
        // 公开接口实现
        // ======================================================================

        /// <summary>
        /// 加载并解析 story.json 文件。
        /// 执行 json-schema.md §9.1 标准解析流程的全部 3 个步骤。
        /// </summary>
        public PlotFlowData LoadStory(string jsonPath)
        {
            if (string.IsNullOrEmpty(jsonPath))
                throw new ArgumentException("jsonPath must not be null or empty", nameof(jsonPath));

            // 读取文件
            string jsonText;
            try
            {
                jsonText = System.IO.File.ReadAllText(jsonPath, System.Text.Encoding.UTF8);
            }
            catch (System.IO.FileNotFoundException ex)
            {
                throw new PlotFlowParseException($"Story file not found: {jsonPath}", ex);
            }
            catch (Exception ex)
            {
                throw new PlotFlowParseException($"Failed to read story file: {jsonPath}", ex);
            }

            // 解析 JSON
            PlotFlowData data;
            try
            {
                data = JsonConvert.DeserializeObject<PlotFlowData>(jsonText, new JsonSerializerSettings
                {
                    MissingMemberHandling = MissingMemberHandling.Ignore,
                    Error = (sender, args) =>
                    {
                        // Newtonsoft.Json 反序列化错误时记录但不中断
                        args.ErrorContext.Handled = true;
                    }
                });
            }
            catch (JsonException ex)
            {
                throw new PlotFlowParseException("Failed to parse story JSON", ex);
            }

            if (data == null)
                throw new PlotFlowParseException("Parsed story is null — JSON may be empty or malformed");

            // 初始化内部索引
            _storyData = data;
            _nodeIndex = new Dictionary<string, StoryNode>();
            _legacyNodeIndex = new Dictionary<string, StoryNode>();
            _ambiguousLegacyNodeIds = new HashSet<string>();
            _chapterIndex = new Dictionary<string, Chapter>();
            _variableDefs = data.Variables ?? new Dictionary<string, VariableDeclaration>();
            WarnForSchemaVersion(data);

            // Step 1: 构建变量表（验证变量声明）
            ValidateVariableDefs(_variableDefs);

            // Step 2: 索引节点（fullId → StoryNode）
            if (data.Chapters != null)
            {
                foreach (var chapter in data.Chapters)
                {
                    if (!string.IsNullOrEmpty(chapter.Id))
                    {
                        _chapterIndex[chapter.Id] = chapter;
                    }

                    if (chapter.Nodes != null)
                    {
                        foreach (var node in chapter.Nodes)
                        {
                            if (string.IsNullOrEmpty(node.ChapterId))
                                node.ChapterId = chapter.Id;
                            if (!string.IsNullOrEmpty(node.FullId))
                            {
                                // fullId is opaque: index the exported value verbatim.
                                _nodeIndex[node.FullId] = node;
                            }
                            IndexLegacyNodeId(node);
                        }
                    }
                }
            }

            // Step 3+4: 节点索引已就绪，条件评估延迟到 GetAvailableOptions 调用时执行
            return data;
        }

        /// <summary>
        /// 按 fullId 获取节点。
        /// </summary>
        public StoryNode GetNode(string nodeId)
        {
            if (string.IsNullOrEmpty(nodeId))
                return null;

            _nodeIndex.TryGetValue(nodeId, out var node);
            if (node != null)
                return node;
            _legacyNodeIndex.TryGetValue(nodeId, out node);
            return node;
        }

        /// <summary>
        /// 获取指定节点中当前可用的选项列表。
        /// 对每个选项评估条件:
        ///   - conditions == null → 始终可用
        ///   - 否则递归评估 AST → true 可用, false 不可用
        /// </summary>
        public List<StoryOption> GetAvailableOptions(string nodeId, Dictionary<string, object> variables)
        {
            var node = GetNode(nodeId);
            if (node == null)
                return new List<StoryOption>();

            var available = new List<StoryOption>();
            foreach (var option in node.Options ?? new List<StoryOption>())
            {
                if (EvaluateCondition(option.Conditions, variables))
                {
                    available.Add(option);
                }
            }
            return available;
        }

        /// <summary>
        /// Scope-aware 0.2 entry point. The current chapter namespace is selected
        /// by PlotFlowVariableStore.CurrentChapterId.
        /// </summary>
        public List<StoryOption> GetAvailableOptions(string nodeId, PlotFlowVariableStore variables)
        {
            var node = GetNode(nodeId);
            var available = new List<StoryOption>();
            if (node == null || variables == null)
                return available;
            foreach (var option in node.Options ?? new List<StoryOption>())
            {
                if (EvaluateCondition(option.Conditions, variables))
                    available.Add(option);
            }
            return available;
        }

        // ======================================================================
        // 条件评估器
        // ======================================================================

        private delegate bool TryResolveVariable(string path, out object value);

        private sealed class OperandResolution
        {
            public bool Found;
            public object Value;
        }

        /// <summary>
        /// 评估条件表达式。
        /// 对应 json-schema.md §9.2 Godot ConditionEval 的 C# 等价实现。
        /// </summary>
        /// <param name="conditions">条件表达式，null 表示无条件。</param>
        /// <param name="variables">运行时变量状态。</param>
        /// <returns>true 表示条件满足（选项可用），false 表示不满足。</returns>
        public bool EvaluateCondition(ConditionExpression conditions, Dictionary<string, object> variables)
        {
            if (conditions == null)
                return true;

            // AST 以 object 类型存储，实际为 JObject
            if (!(conditions.Ast is JObject ast))
                return true; // 无 AST 视为无条件（前向兼容）

            TryResolveVariable resolver = (string path, out object value) =>
                TryResolveVariablePath(path, variables ?? new Dictionary<string, object>(), out value);
            return CanResolveAllVariables(ast, resolver) && EvaluateAst(ast, resolver);
        }

        public bool EvaluateCondition(ConditionExpression conditions, PlotFlowVariableStore variables)
        {
            if (conditions == null)
                return true;
            if (!(conditions.Ast is JObject ast) || variables == null)
                return false;
            TryResolveVariable resolver = (string path, out object value) =>
                TryResolveVariablePath(path, variables, out value);
            return CanResolveAllVariables(ast, resolver) && EvaluateAst(ast, resolver);
        }

        /// <summary>
        /// 递归评估 AST 节点。
        /// </summary>
        private bool EvaluateAst(JObject ast, TryResolveVariable resolver)
        {
            if (ast == null)
                return false;
            var type = ast["type"]?.Value<string>();
            if (string.IsNullOrEmpty(type))
                return false;

            switch (type)
            {
                case AstNodeTypes.LogicalAnd:
                    return EvaluateAst(ast["left"] as JObject, resolver)
                        && EvaluateAst(ast["right"] as JObject, resolver);

                case AstNodeTypes.LogicalOr:
                    return EvaluateAst(ast["left"] as JObject, resolver)
                        || EvaluateAst(ast["right"] as JObject, resolver);

                case AstNodeTypes.LogicalNot:
                    var operand = ast["operand"] as JObject;
                    return !EvaluateAst(operand, resolver);

                case AstNodeTypes.Comparison:
                    return EvaluateComparison(ast, resolver);

                case AstNodeTypes.FieldAccess:
                    // FieldAccess 不是终端节点——实际取值后由 Comparison 包装评估
                    return EvaluateFieldAccess(ast, resolver);

                default:
                    UnityEngine.Debug.LogWarning($"Fablevia: Unknown AST node type '{type}' — skipping condition");
                    return false;
            }
        }

        private bool CanResolveAllVariables(JObject ast, TryResolveVariable resolver)
        {
            if (ast == null)
                return false;
            switch (ast["type"]?.Value<string>())
            {
                case AstNodeTypes.LogicalAnd:
                case AstNodeTypes.LogicalOr:
                    return CanResolveAllVariables(ast["left"] as JObject, resolver)
                        && CanResolveAllVariables(ast["right"] as JObject, resolver);
                case AstNodeTypes.LogicalNot:
                    return CanResolveAllVariables(ast["operand"] as JObject, resolver);
                case AstNodeTypes.Comparison:
                    if (ast["left"] != null || ast["right"] != null)
                        return CanResolveOperand(ast["left"], resolver) && CanResolveOperand(ast["right"], resolver);
                    return resolver(ast["variable"]?.Value<string>(), out _);
                case AstNodeTypes.FieldAccess:
                {
                    var objectName = ast["object"]?.Value<string>();
                    var fieldName = ast["field"]?.Value<string>();
                    return resolver($"{objectName}.{fieldName}", out _);
                }
                default:
                    return true;
            }
        }

        private bool CanResolveOperand(JToken token, TryResolveVariable resolver)
        {
            if (!(token is JObject operand))
                return false;
            switch (operand["type"]?.Value<string>())
            {
                case "literal": return operand["value"] != null;
                case "variable": return resolver(operand["name"]?.Value<string>(), out _);
                default: return false;
            }
        }

        /// <summary>
        /// 评估比较表达式。
        /// 支持运算符: ==, !=, >, <, >=, <=
        /// 支持嵌套字段访问路径如 "角色状态.魔力"。
        /// </summary>
        private bool EvaluateComparison(JObject comp, TryResolveVariable resolver)
        {
            var operatorStr = comp["operator"]?.Value<string>();
            if (string.IsNullOrEmpty(operatorStr))
                return false;

            OperandResolution left;
            OperandResolution right;
            if (comp["left"] != null || comp["right"] != null)
            {
                // PlotFlow 0.2: preserve operand order, including literal-left.
                left = ResolveOperand(comp["left"], resolver);
                right = ResolveOperand(comp["right"], resolver);
            }
            else
            {
                // PlotFlow 0.1: variable is the left operand, value is the right.
                var variable = comp["variable"]?.Value<string>();
                left = ResolveVariableOperand(variable, resolver);
                var valueToken = comp["value"];
                right = new OperandResolution
                {
                    Found = valueToken != null,
                    Value = valueToken == null ? null : PlotFlowVariableStore.NormalizeJsonValue(valueToken.ToObject<object>())
                };
            }

            if (!left.Found || !right.Found)
                return false;

            // 执行比较
            int comparisonResult = CompareValues(left.Value, right.Value);

            return operatorStr switch
            {
                "==" => comparisonResult == 0,
                "!=" => comparisonResult != 0,
                ">"  => comparisonResult > 0,
                "<"  => comparisonResult < 0,
                ">=" => comparisonResult >= 0,
                "<=" => comparisonResult <= 0,
                _    => false
            };
        }

        private OperandResolution ResolveOperand(JToken token, TryResolveVariable resolver)
        {
            if (!(token is JObject operand))
                return new OperandResolution { Found = false };
            switch (operand["type"]?.Value<string>())
            {
                case "literal":
                    var valueToken = operand["value"];
                    return new OperandResolution
                    {
                        Found = valueToken != null,
                        Value = valueToken == null ? null : PlotFlowVariableStore.NormalizeJsonValue(valueToken.ToObject<object>())
                    };
                case "variable":
                    return ResolveVariableOperand(operand["name"]?.Value<string>(), resolver);
                default:
                    return new OperandResolution { Found = false };
            }
        }

        private OperandResolution ResolveVariableOperand(string path, TryResolveVariable resolver)
        {
            if (string.IsNullOrEmpty(path) || !resolver(path, out var value))
                return new OperandResolution { Found = false };
            return new OperandResolution { Found = true, Value = value };
        }

        /// <summary>
        /// 解析带点号分隔符的变量路径。
        /// 例如: "角色状态.魔力" → 先取 variables["角色状态"]（Dictionary），再取 ["魔力"]。
        /// </summary>
        private bool TryResolveVariablePath(string path, Dictionary<string, object> variables, out object value)
        {
            value = null;
            if (string.IsNullOrEmpty(path))
                return false;
            if (path[0] == '$')
                path = path.Substring(1);
            var parts = path.Split('.');
            if (!variables.TryGetValue(parts[0], out var current))
                return false;

            for (int i = 1; i < parts.Length; i++)
            {
                if (current is Dictionary<string, object> dict)
                {
                    dict.TryGetValue(parts[i], out current);
                }
                else
                {
                    return false;
                }
            }
            value = current;
            return true;
        }

        private bool TryResolveVariablePath(string path, PlotFlowVariableStore variables, out object value)
        {
            value = null;
            if (string.IsNullOrEmpty(path))
                return false;
            if (path[0] == '$')
                path = path.Substring(1);
            var parts = path.Split('.');
            if (!variables.TryGetValue(parts[0], out var current))
                return false; // Includes cross-chapter ownership denial.
            for (int i = 1; i < parts.Length; i++)
            {
                if (!(current is Dictionary<string, object> dictionary)
                    || !dictionary.TryGetValue(parts[i], out current))
                    return false;
            }
            value = current;
            return true;
        }

        /// <summary>
        /// 比较两个值。
        /// 返回: -1 (小于), 0 (等于), 1 (大于)。
        /// 处理 long/int/float/double/string 跨类型比较。
        /// </summary>
        private int CompareValues(object a, object b)
        {
            if (a == null && b == null) return 0;
            if (a == null) return -1;
            if (b == null) return 1;

            // 数值比较
            if (a is long lA && b is long lB) return lA.CompareTo(lB);
            if (a is long lA2 && b is double dB2) return ((double)lA2).CompareTo(dB2);
            if (a is double dA && b is double dB) return dA.CompareTo(dB);
            if (a is double dA2 && b is long lB2) return dA2.CompareTo((double)lB2);
            if (a is int iA && b is int iB) return iA.CompareTo(iB);
            if (a is int iA2 && b is long lB3) return ((long)iA2).CompareTo(lB3);
            if (a is long lA3 && b is int iB3) return lA3.CompareTo((long)iB3);

            // 布尔比较
            if (a is bool bA && b is bool bB) return bA.CompareTo(bB);

            // 字符串比较
            if (a is string sA && b is string sB)
                return string.Compare(sA, sB, StringComparison.Ordinal);

            // 回退: 字符串表示比较
            return string.Compare(
                a.ToString(),
                b.ToString(),
                StringComparison.Ordinal
            );
        }

        /// <summary>
        /// 评估 FieldAccess AST 节点。
        /// 预留实现，当前比较表达式直接在 variable 字段中使用点号路径。
        /// </summary>
        private bool EvaluateFieldAccess(JObject fieldAccess, TryResolveVariable resolver)
        {
            var objName = fieldAccess["object"]?.Value<string>();
            var field = fieldAccess["field"]?.Value<string>();

            if (string.IsNullOrEmpty(objName) || string.IsNullOrEmpty(field))
                return false;

            return resolver($"{objName}.{field}", out var value) && value != null;
        }

        // ======================================================================
        // 变量管理
        // ======================================================================

        /// <summary>
        /// 根据变量声明初始化默认值字典。
        /// </summary>
        /// <returns>变量名 → 默认值的字典。</returns>
        public Dictionary<string, object> CreateDefaultVariables()
        {
            var defaults = new Dictionary<string, object>();
            foreach (var kvp in _variableDefs)
            {
                defaults[kvp.Key] = ResolveDefaultValue(kvp.Value);
            }
            return defaults;
        }

        /// <summary>Create an isolated global/chapter variable store.</summary>
        public PlotFlowVariableStore CreateVariableStore(string currentChapterId = null)
        {
            if (currentChapterId == null)
                currentChapterId = FindInitialChapterId();
            return new PlotFlowVariableStore(_variableDefs, currentChapterId);
        }

        /// <summary>
        /// 执行副作用列表，修改变量状态。
        /// 对应 json-schema.md §9.2 Godot VariableStore.apply_effects()。
        /// </summary>
        /// <param name="effects">要执行的副作用列表。</param>
        /// <param name="variables">变量状态字典（原地修改）。</param>
        public void ApplySideEffects(List<SideEffect> effects, Dictionary<string, object> variables)
        {
            if (effects == null || variables == null)
                return;

            foreach (var effect in effects)
            {
                ApplySingleEffect(effect, variables);
            }
        }

        /// <summary>Scope-aware side-effect entry point.</summary>
        public void ApplySideEffects(List<SideEffect> effects, PlotFlowVariableStore variables)
        {
            if (effects == null || variables == null)
                return;
            foreach (var effect in effects)
                ApplySingleEffect(effect, variables);
        }

        /// <summary>
        /// 执行单个副作用。
        /// </summary>
        private void ApplySingleEffect(SideEffect effect, Dictionary<string, object> variables)
        {
            var path = effect.Variable;
            var parts = path.Split('.');
            var value = effect.Value;

            if (parts.Length == 1)
            {
                // 顶层变量
                if (!variables.ContainsKey(parts[0]))
                    return;

                variables[parts[0]] = ApplyOperation(variables[parts[0]], effect.Operation, value);
            }
            else
            {
                // 嵌套字段（object 类型）
                if (!variables.TryGetValue(parts[0], out var obj) || !(obj is Dictionary<string, object> dict))
                    return;

                for (int i = 1; i < parts.Length - 1; i++)
                {
                    if (!dict.TryGetValue(parts[i], out var nested) || !(nested is Dictionary<string, object> nestedDict))
                        return;
                    dict = nestedDict;
                }

                var lastKey = parts[parts.Length - 1];
                if (dict.ContainsKey(lastKey))
                {
                    dict[lastKey] = ApplyOperation(dict[lastKey], effect.Operation, value);
                }
            }
        }

        private void ApplySingleEffect(SideEffect effect, PlotFlowVariableStore variables)
        {
            if (effect == null || string.IsNullOrEmpty(effect.Variable))
                return;
            var parts = effect.Variable.Split('.');
            var value = PlotFlowVariableStore.NormalizeJsonValue(effect.Value);
            if (!variables.CanAccess(parts[0]))
            {
                UnityEngine.Debug.LogWarning(
                    $"Fablevia: Cannot apply effect to chapter variable '{parts[0]}' from chapter '{variables.CurrentChapterId}'");
                return;
            }
            if (parts.Length == 1)
            {
                if (!variables.TryGetValue(parts[0], out var current))
                    return;
                if (!variables.TrySet(parts[0], ApplyOperation(current, effect.Operation, value)))
                    UnityEngine.Debug.LogWarning($"Fablevia: Effect write denied for variable '{parts[0]}'");
                return;
            }

            if (!(variables.Get(parts[0]) is Dictionary<string, object> dictionary))
                return;
            for (var index = 1; index < parts.Length - 1; index++)
            {
                if (!dictionary.TryGetValue(parts[index], out var nested)
                    || !(nested is Dictionary<string, object> nestedDictionary))
                    return;
                dictionary = nestedDictionary;
            }
            var lastKey = parts[parts.Length - 1];
            if (dictionary.TryGetValue(lastKey, out var currentValue))
                dictionary[lastKey] = ApplyOperation(currentValue, effect.Operation, value);
        }

        /// <summary>
        /// 对单个变量应用操作。
        /// 对应 json-schema.md §5.5 操作对照表。
        /// </summary>
        private object ApplyOperation(object current, string operation, object value)
        {
            switch (operation)
            {
                case "set":
                    return value;

                case "add":
                    return NumericAdd(current, value);

                case "subtract":
                    return NumericSubtract(current, value);

                case "append":
                    return string.Concat(current?.ToString() ?? "", value?.ToString() ?? "");

                default:
                    UnityEngine.Debug.LogWarning($"Fablevia: Unknown operation '{operation}' — skipping");
                    return current;
            }
        }

        private object NumericAdd(object a, object b)
        {
            if (a is long lA && b is long lB) return lA + lB;
            if (a is double dA && b is double dB) return dA + dB;
            if (a is long lA2) return lA2 + Convert.ToDouble(b);
            if (b is long lB2) return Convert.ToDouble(a) + lB2;
            return Convert.ToDouble(a) + Convert.ToDouble(b);
        }

        private object NumericSubtract(object a, object b)
        {
            if (a is long lA && b is long lB) return lA - lB;
            if (a is double dA && b is double dB) return dA - dB;
            if (a is long lA2) return lA2 - Convert.ToDouble(b);
            if (b is long lB2) return Convert.ToDouble(a) - lB2;
            return Convert.ToDouble(a) - Convert.ToDouble(b);
        }

        /// <summary>
        /// 递归解析默认值。
        /// </summary>
        private object ResolveDefaultValue(VariableDeclaration def)
        {
            return PlotFlowVariableStore.ResolveDefaultValue(def);
        }

        private Dictionary<string, object> ResolveObjectDefaults(Dictionary<string, VariableDeclaration> fields)
        {
            var obj = new Dictionary<string, object>();
            if (fields == null)
                return obj;

            foreach (var kvp in fields)
            {
                obj[kvp.Key] = ResolveDefaultValue(kvp.Value);
            }
            return obj;
        }

        // ======================================================================
        // 内部校验
        // ======================================================================

        /// <summary>
        /// 验证变量声明的基本合法性。
        /// </summary>
        private void ValidateVariableDefs(Dictionary<string, VariableDeclaration> defs)
        {
            if (defs == null)
                return;

            foreach (var kvp in defs)
            {
                var name = kvp.Key;
                var def = kvp.Value;

                if (string.IsNullOrEmpty(def.Type))
                {
                    UnityEngine.Debug.LogWarning($"Fablevia: Variable '{name}' has no type — defaulting to 'string'");
                    def.Type = "string";
                }

                // object 类型必须有 fields
                if (def.Type == "object" && def.Fields == null)
                {
                    UnityEngine.Debug.LogWarning($"Fablevia: Variable '{name}' is type 'object' but has no fields — initializing empty");
                    def.Fields = new Dictionary<string, VariableDeclaration>();
                }

                // enum 类型必须有 values
                if (def.Type == "enum" && (def.Values == null || def.Values.Count == 0))
                {
                    UnityEngine.Debug.LogWarning($"Fablevia: Variable '{name}' is type 'enum' but has no values — defaulting to 'string'");
                    def.Type = "string";
                }
            }
        }

        private void IndexLegacyNodeId(StoryNode node)
        {
            if (node == null || string.IsNullOrEmpty(node.Id) || _ambiguousLegacyNodeIds.Contains(node.Id))
                return;
            if (_legacyNodeIndex.TryGetValue(node.Id, out var existing) && !ReferenceEquals(existing, node))
            {
                _legacyNodeIndex.Remove(node.Id);
                _ambiguousLegacyNodeIds.Add(node.Id);
                return;
            }
            _legacyNodeIndex[node.Id] = node;
        }

        private string FindInitialChapterId()
        {
            if (_storyData?.Chapters == null)
                return string.Empty;
            foreach (var chapter in _storyData.Chapters)
            {
                foreach (var node in chapter.Nodes ?? new List<StoryNode>())
                {
                    if (node.IsRoot)
                        return node.ChapterId ?? chapter.Id ?? string.Empty;
                }
            }
            return _storyData.Chapters.Count > 0 ? _storyData.Chapters[0].Id ?? string.Empty : string.Empty;
        }

        private static void WarnForSchemaVersion(PlotFlowData data)
        {
            var version = ReadSchemaVersion(data);
            if (string.IsNullOrEmpty(version))
                return; // Legacy 0.1 exports may omit meta.plotflow.
            var normalized = version.Split('-')[0];
            if (!Version.TryParse(normalized, out var parsed))
            {
                UnityEngine.Debug.LogWarning($"Fablevia: Unknown story version '{version}'; loading supported fields only");
                return;
            }
            if (parsed.Major > 0 || parsed.Minor > 2)
                UnityEngine.Debug.LogWarning($"Fablevia: Story version '{version}' is newer than the 0.2 runtime contract; unknown fields are ignored");
        }

        private static string ReadSchemaVersion(PlotFlowData data)
        {
            var schema = data?.SchemaVersion;
            if (!string.IsNullOrEmpty(schema))
            {
                const string marker = "/schema/";
                var markerIndex = schema.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (markerIndex >= 0)
                {
                    var tail = schema.Substring(markerIndex + marker.Length);
                    var slashIndex = tail.IndexOf('/');
                    return slashIndex >= 0 ? tail.Substring(0, slashIndex) : tail;
                }
                return schema;
            }
            return data?.Meta?.Plotflow;
        }
    }
}
