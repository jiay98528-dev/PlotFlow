# PlotFlow JSON 导出格式规范 V0.2

**版本**：V0.2
**日期**：2026-07-11
**当前写出 Schema 标识符**：`https://plotflow.dev/schema/0.2/story.json`
**历史读取兼容 Schema**：`https://plotflow.dev/schema/0.1/story.json`
**JSON Schema 版本**：draft-2020-12

> ADR-013 是当前身份与导出合同。`.mdstory` frontmatter 中系统管理的 `plotflow: "0.1"` 是源语法版本，不随 JSON Schema 升级而改变；当前 JSON exporter 写出 0.2，0.1 只用于读取旧导出物。源文件与内部 AST 的 engine 枚举为 `generic | godot | unity | unreal`，导出器在 JSON 0.2 边界把 `generic` 映射为 `none`。P1 源码与严格 unpacked/Ajv 门禁已通过；installed、人工巡检、真实引擎工具链与签名仍待验收，因此本规范不能作为 release-candidate-passed 声明。

---

## 目录

1. [Schema 总览](#1-schema-总览)
2. [顶层结构](#2-顶层结构)
3. [Meta 对象](#3-meta-对象)
4. [Variables 定义](#4-variables-定义)
5. [Chapters 数组](#5-chapters-数组)
   - 5.1 [Chapter 对象](#51-chapter-对象)
   - 5.2 [Node 对象](#52-node-对象)
   - 5.3 [Option 对象](#53-option-对象)
   - 5.4 [ConditionExpression](#54-conditionexpression)
   - 5.5 [SideEffect](#55-sideeffect)
6. [完整示例](#6-完整示例)
7. [验证规则](#7-验证规则)
8. [版本兼容性](#8-版本兼容性)
9. [引擎集成指南](#9-引擎集成指南)

---

## 1. Schema 总览

### 1.1 目的

本文件定义 PlotFlow 的**标准 JSON 导出格式**。它是以下三方之间的**机器可验证契约**：

| 角色 | 用途 |
|------|------|
| **PlotFlow 编辑器** | 将 `.mdstory` 解析后的中间表示导出为符合本 Schema 的 JSON |
| **游戏引擎插件**（Godot/Unity/Unreal） | 读取 JSON 并重建运行时节点树、条件评估器、变量管理器 |
| **CI/CD / 测试工具** | 使用 ajv 等 JSON Schema 验证器自动检查导出产物的合法性 |

### 1.2 版本信息

| 属性 | 值 |
|------|-----|
| `.mdstory` `meta.plotflow` | `0.1`（系统管理、只读） |
| 当前写出 Schema 标识符 | `https://plotflow.dev/schema/0.2/story.json` |
| 历史读取 Schema | `https://plotflow.dev/schema/0.1/story.json` |
| JSON Schema 规范 | [draft-2020-12](https://json-schema.org/draft/2020-12) |
| 验证器兼容性 | ajv（推荐）、jsonschema（Python）、everit-org/json-schema（Java）等 |

### 1.3 JSON Schema 完整定义文件

机器可执行合同以 `packages/core/schema/0.2/story.json` 为唯一当前写出来源，并镜像到 `website/public/schema/0.2/story.json`。0.1 冻结文件位于相邻 `0.1/story.json`，只用于历史读取兼容。本文内嵌片段用于解释；与机器文件冲突时以对应版本机器文件和 ADR-013 为准。

---

## 2. 顶层结构

### 2.1 历史 0.1 顶层片段（已被 ADR-013 的 0.2 写出合同覆盖）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://plotflow.dev/schema/0.1/story.json",
  "title": "PlotFlow Story Export",
  "description": "JSON export format for PlotFlow narrative branching tool V0.1",
  "type": "object",
  "required": ["meta", "variables", "chapters"],
  "properties": {
    "$schema": {
      "type": "string",
      "description": "Reference to the PlotFlow story schema identifier."
    },
    "meta": { "$ref": "#/$defs/Meta" },
    "variables": { "$ref": "#/$defs/Variables" },
    "chapters": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/Chapter" }
    }
  },
  "additionalProperties": false,
```

### 2.2 顶层字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `$schema` | string | **是** | 当前写出必须等于 `https://plotflow.dev/schema/0.2/story.json` |
| `meta` | object | **是** | 文件元信息，版本/标题/作者/引擎/时间戳 |
| `variables` | object | **是** | 所有变量定义，key 为变量名 |
| `chapters` | array | **是** | 章节数组，至少 1 个章节 |

零章节、零节点或任一空章节均产生 `E009`（Error），JSON/HTML/TXT 导出必须在打开原生保存对话框前统一阻断。JSON 导出器还必须对序列化结果执行完整 Schema 0.2 校验；任何 Schema 违规均返回失败，不得以 Warning 写出。

---

## 3. Meta 对象

### 3.1 JSON Schema 定义

```json
  "$defs": {
    "Meta": {
      "type": "object",
      "required": ["plotflow", "title", "engine", "exportedAt"],
      "properties": {
        "plotflow": {
          "type": "string",
          "description": "PlotFlow version that generated this export.",
          "pattern": "^\\d+\\.\\d+$"
        },
        "title": {
          "type": "string",
          "description": "Story title from YAML frontmatter.",
          "minLength": 1
        },
        "author": {
          "type": "string",
          "description": "Author name (optional)."
        },
        "engine": {
          "type": "string",
          "enum": ["godot", "unity", "unreal", "none"],
          "description": "Target game engine."
        },
        "exportedAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO 8601 UTC timestamp of export."
        }
      },
      "additionalProperties": false
    },
```

### 3.2 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `plotflow` | string | **是** | PlotFlow 版本号，格式 `主.次`（如 `0.1`） |
| `title` | string | **是** | 故事标题，不可为空 |
| `author` | string | 否 | 作者名，可省略 |
| `engine` | string | **是** | JSON 输出枚举：`godot` / `unity` / `unreal` / `none`；源/内部 `generic` 导出为 `none` |
| `exportedAt` | string | **是** | ISO-8601 UTC 时间戳，如 `2026-06-10T12:00:00Z` |

`engine` 只允许上表四个 JSON 枚举值。`.mdstory` 与 Inspector 使用 `generic | godot | unity | unreal`：导出时 `generic → none`，读取 JSON 时 `none → generic`。源 parser 不需要接受 `engine: none`；未知字符串不得原样进入 0.2 导出，必须先产生 Error 诊断并阻断导出。

---

## 4. Variables 定义

### 4.1 类型系统

PlotFlow 支持 6 种变量类型：

| 类型 | 语法标记 | 默认值 | JSON `type` 字段值 |
|------|---------|--------|---------------------|
| 整数 | `int` | `0` | `"int"` |
| 浮点数 | `float` | `0.0` | `"float"` |
| 布尔值 | `bool` | `false` | `"bool"` |
| 字符串 | `string` | `""` | `"string"` |
| 枚举 | `enum[值1, 值2, ...]` | 第一个值 | `"enum"`（带 `values` 数组） |
| 对象 | `object{字段: 类型, ...}` | 各字段默认值 | `"object"`（带 `fields` 对象） |

### 4.2 历史/过渡期内嵌片段（由 0.2 机器 Schema 覆盖）

```json
    "Variables": {
      "type": "object",
      "description": "Variable definitions keyed by variable name.",
      "additionalProperties": false,
      "patternProperties": {
        "^[^$]+$": { "$ref": "#/$defs/VariableDef" }
      },
      "minProperties": 0
    },

    "VariableDef": {
      "description": "A single variable definition.",
      "oneOf": [
        {
          "properties": {
            "type": { "type": "string", "enum": ["int"] },
            "default": { "type": "integer", "default": 0 },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" }
          },
          "required": ["type"],
          "additionalProperties": false
        },
        {
          "properties": {
            "type": { "type": "string", "enum": ["float"] },
            "default": { "type": "number", "default": 0.0 },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" }
          },
          "required": ["type"],
          "additionalProperties": false
        },
        {
          "properties": {
            "type": { "type": "string", "enum": ["bool"] },
            "default": { "type": "boolean", "default": false },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" }
          },
          "required": ["type"],
          "additionalProperties": false
        },
        {
          "properties": {
            "type": { "type": "string", "enum": ["string"] },
            "default": { "type": "string", "default": "" },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" }
          },
          "required": ["type"],
          "additionalProperties": false
        },
        {
          "properties": {
            "type": { "type": "string", "enum": ["enum"] },
            "values": {
              "type": "array",
              "minItems": 1,
              "items": { "type": "string" }
            },
            "default": { "type": "string" },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" }
          },
          "required": ["type", "values"],
          "additionalProperties": false
        },
        {
          "properties": {
            "type": { "type": "string", "enum": ["object"] },
            "scope": { "$ref": "#/$defs/VariableScope" },
            "description": { "type": "string" },
            "default": { "type": "object" },
            "chapter": {
              "type": "string",
              "description": "Required when scope is 'chapter'. Specifies which chapter the variable belongs to."
            },
            "fields": {
              "type": "object",
              "additionalProperties": { "$ref": "#/$defs/VariableDef" }
            }
          },
          "required": ["type", "fields"],
          "additionalProperties": false
        }
      ]
    },

    "VariableScope": {
      "type": "string",
      "enum": ["global", "chapter"],
      "description": "Variable scope: 'global' accessible throughout the story, 'chapter' scoped to one chapter."
    },
```

### 4.3 Scope 说明

| 值 | 说明 |
|------|------|
| `global` | 全局变量，整个故事范围内可读写；顶层省略 `scope` 时等价于 global，且禁止携带 `chapter` |
| `chapter` | 章节局部变量；顶层声明必须附带非空 `chapter` 并引用真实章节。值随故事会话持久化，但只在该章节的叙事上下文中可见 |

`scope` 与 `chapter` 只属于顶层变量。object 的嵌套 `fields` 继承根变量的有效作用域与章节，禁止自行声明二者。所有 object 导出都必须包含 `fields`，即使为空也必须写为 `"fields": {}`。

### 4.4 Object 嵌套规则

- `object` 类型的 `fields` 中，每个字段的 type 可以是 `int`、`float`、`bool`、`string`、`enum` 或另一个 `object`
- 最大嵌套深度：**3 层**（外层 object → 内层 object → 最内层 object）
- 深度超过 3 层的嵌套在解析时报错 **E006**（阻断性错误）
- 深度验证无法在 JSON Schema 层面完成，需要在应用层验证（见[第 7 节](#7-验证规则)）

### 4.5 变量声明示例

```json
"variables": {
  "好感度": { "type": "int", "default": 0, "scope": "global" },
  "金币": { "type": "int", "default": 0, "scope": "global" },
  "职业": {
    "type": "enum",
    "values": ["战士", "法师", "盗贼"],
    "default": "战士",
    "scope": "global"
  },
  "装备": {
    "type": "object",
    "scope": "chapter",
    "chapter": "第一章",
    "fields": {
      "武器": { "type": "enum", "values": ["剑", "弓", "杖"], "default": "剑" },
      "护甲": { "type": "int", "default": 0 },
      "饰品": {
        "type": "object",
        "fields": {
          "名称": { "type": "string", "default": "" },
          "效果": { "type": "string", "default": "" }
        }
      }
    }
  },
  "拥有钥匙": { "type": "bool", "default": false, "scope": "global" },
  "角色状态": {
    "type": "object",
    "scope": "global",
    "fields": {
      "生命": { "type": "int", "default": 100 },
      "魔力": { "type": "int", "default": 50 }
    }
  }
}
```

---

## 5. Chapters 数组

### 5.1 Chapter 对象

```json
    "Chapter": {
      "type": "object",
      "required": ["id", "title", "nodes"],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1,
          "description": "Chapter identifier (from H1 heading text)."
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "description": "Chapter display title."
        },
        "nodes": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/Node" }
        }
      },
      "additionalProperties": false
    },
```

#### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 章节标识符，取自 H1 标题（如 `第一章`） |
| `title` | string | **是** | 章节显示名称（如 `村庄`）；匿名章节导出时使用稳定 ID `_anonymous`，保证非空 |
| `nodes` | array | **是** | 该章节下的节点数组，至少 1 个节点 |

---

### 5.2 Node 对象

```json
    "Node": {
      "type": "object",
      "required": ["id", "chapterId", "fullId", "title", "body", "options", "position", "isRoot", "isOrphan", "isDeadEnd"],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1,
          "description": "Node ID within the chapter (without chapter prefix)."
        },
        "chapterId": {
          "type": "string",
          "minLength": 1,
          "description": "ID of the chapter this node belongs to."
        },
        "fullId": {
          "type": "string",
          "minLength": 1,
            "description": "Opaque canonical ID: encodeURIComponent(chapterId) + '/' + encodeURIComponent(id)."
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "description": "Node display title."
        },
        "body": {
          "type": "array",
          "description": "Paragraphs of body text. Each element is one paragraph.",
          "items": { "type": "string" }
        },
        "options": {
          "type": "array",
          "items": { "$ref": "#/$defs/Option" },
          "description": "Available options/choices from this node. May be empty (dead end)."
        },
        "position": {
          "type": "object",
          "required": ["x", "y"],
          "properties": {
            "x": { "type": "number", "description": "X coordinate in graph layout." },
            "y": { "type": "number", "description": "Y coordinate in graph layout." }
          },
          "additionalProperties": false,
          "description": "Graph layout position for the branch visualization. Exporters SHOULD use .mdstory layout.graph.nodes when present and fall back to { x: 0, y: 0 } or computed editor layout when absent."
        },
        "isRoot": {
          "type": "boolean",
          "description": "True if this is the starting node of the story."
        },
        "isOrphan": {
          "type": "boolean",
          "description": "Diagnostic: true if no option in the story targets this node (except root)."
        },
        "isDeadEnd": {
          "type": "boolean",
          "description": "Diagnostic: true if this node has no exit options."
        }
      },
      "additionalProperties": false
    },
```

#### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 节点 ID（不含章节前缀），如 `森林入口` |
| `chapterId` | string | **是** | 所属章节的 ID |
| `fullId` | string | **是** | opaque canonical ID：`encodeURIComponent(chapterId) + "/" + encodeURIComponent(id)`；消费者禁止自行拆分 |
| `title` | string | **是** | 节点显示名称 |
| `body` | string[] | **是** | 描述文本数组，每个元素为一个段落 |
| `options` | array | **是** | 该节点的选项列表，可为空数组（死胡同节点） |
| `position` | object | **是** | 分支图中的布局坐标 `{x, y}`；优先来自 `.mdstory` 的 `layout.graph.nodes`，缺失时使用导出器 fallback |
| `isRoot` | boolean | **是** | 是否为故事起始节点（仅第一个章节的第一个节点为 true） |
| `isOrphan` | boolean | **是** | 诊断：是否为孤立节点（无入口路径，根节点除外） |
| `isDeadEnd` | boolean | **是** | 诊断：是否为死胡同（无出口选项） |

> V0.3 兼容说明：JSON Schema 0.2 仍不新增独立 `nextTarget` 字段。导出器必须把 `.mdstory` 的节点级 `下一步` 投影为一个合成 `Option`：`text` 固定为 `下一步`、`conditions` 为 `null`、`sideEffects` 来自紧邻 `效果:` 行、`targetNodeId/targetChapterId/targetFullId` 指向流程出口目标。存在 `下一步` 的节点不应仅因源 `options` 列表为空而被运行时视为无出口节点。

---

### 5.3 Option 对象

```json
    "Option": {
      "type": "object",
      "required": ["index", "text", "targetNodeId", "targetChapterId", "targetFullId", "conditions", "sideEffects"],
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 0,
          "description": "Zero-based display/order index of this option within its node."
        },
        "text": {
          "type": "string",
          "minLength": 1,
          "description": "Display text for this choice."
        },
        "targetNodeId": {
          "type": ["string", "null"],
          "description": "Target node ID (without chapter prefix). null if option has no target."
        },
        "targetChapterId": {
          "type": ["string", "null"],
          "description": "Explicit target chapter from .mdstory. null when the source used an unqualified same-chapter reference."
        },
        "targetFullId": {
          "type": ["string", "null"],
          "description": "Globally unique target node fullId. null if option has no target."
        },
        "conditions": {
          "description": "Condition expression that must be satisfied for this option to appear. null means always available.",
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/$defs/ConditionExpression" }
          ]
        },
        "sideEffects": {
          "type": "array",
          "description": "Variable modifications that execute when this option is chosen. Empty array means no effects.",
          "items": { "$ref": "#/$defs/SideEffect" }
        }
      },
      "additionalProperties": false
    },
```

#### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `index` | integer | **是** | 选项在节点内的序号（从 0 开始） |
| `text` | string | **是** | 选项显示文本，不可为空 |
| `targetNodeId` | string\|null | **是** | 跳转目标节点 ID；无目标时为 `null` |
| `targetChapterId` | string\|null | **是** | `.mdstory` 中显式写出的目标章节；未显式限定章节时为 `null` |
| `targetFullId` | string\|null | **是** | canonical opaque FullID；无目标时为 `null`，不得从该字符串反向猜章节 |
| `conditions` | object\|null | **是** | 出现条件，`null` 表示无条件（默认选项） |
| `sideEffects` | array | **是** | 副作用数组，空数组 `[]` 表示无副作用 |

---

### 5.4 ConditionExpression

条件表达式同时包含**原始文本**和**AST**。文本用于人类阅读和 Git diff，AST 用于引擎逻辑评估。

```json
    "ConditionExpression": {
      "type": "object",
      "required": ["expression", "ast"],
      "properties": {
        "expression": {
          "type": "string",
          "minLength": 1,
          "description": "Human-readable condition expression text, e.g. '($金币>=10) AND ($武器!='无')'."
        },
        "ast": {
          "description": "Abstract syntax tree of the condition expression.",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        }
      },
      "additionalProperties": false
    },
```

#### AST 节点类型总览

| AST 节点 | `type` 值 | 说明 | 示例表达式 |
|----------|-----------|------|-----------|
| `LogicalAnd` | `"logical_and"` | 逻辑与，左右均需满足 | `($a>=1) AND ($b==true)` |
| `LogicalOr` | `"logical_or"` | 逻辑或，至少一侧满足 | `($a>=1) OR ($b==true)` |
| `LogicalNot` | `"logical_not"` | 逻辑非 | `NOT ($a>=1)` |
| `Comparison` | `"comparison"` | 变量比较运算 | `$金币 >= 10` |
| `FieldAccess` | `"field_access"` | 对象字段访问 | `$角色状态.魔力` |

#### LogicalAnd

```json
    "LogicalAnd": {
      "type": "object",
      "required": ["type", "left", "right"],
      "properties": {
        "type": { "type": "string", "const": "logical_and" },
        "left": {
          "description": "Left operand (any AST node).",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        },
        "right": {
          "description": "Right operand (any AST node).",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        }
      },
      "additionalProperties": false
    },
```

#### LogicalOr

```json
    "LogicalOr": {
      "type": "object",
      "required": ["type", "left", "right"],
      "properties": {
        "type": { "type": "string", "const": "logical_or" },
        "left": {
          "description": "Left operand.",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        },
        "right": {
          "description": "Right operand.",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        }
      },
      "additionalProperties": false
    },
```

#### LogicalNot

```json
    "LogicalNot": {
      "type": "object",
      "required": ["type", "operand"],
      "properties": {
        "type": { "type": "string", "const": "logical_not" },
        "operand": {
          "description": "The negated sub-expression.",
          "oneOf": [
            { "$ref": "#/$defs/LogicalAnd" },
            { "$ref": "#/$defs/LogicalOr" },
            { "$ref": "#/$defs/LogicalNot" },
            { "$ref": "#/$defs/Comparison" },
            { "$ref": "#/$defs/FieldAccess" }
          ]
        }
      },
      "additionalProperties": false
    },
```

#### Comparison

```json
    "Comparison": {
      "type": "object",
      "required": ["type", "left", "operator", "right"],
      "properties": {
        "type": { "const": "comparison" },
        "left": { "$ref": "#/$defs/Operand" },
        "operator": {
          "enum": ["==", "!=", ">", "<", ">=", "<="]
        },
        "right": { "$ref": "#/$defs/Operand" }
      },
      "additionalProperties": false
    },
    "Operand": {
      "oneOf": [
        {
          "type": "object",
          "required": ["type", "name"],
          "properties": {
            "type": { "const": "variable" },
            "name": { "type": "string", "minLength": 1 }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": ["type", "value"],
          "properties": {
            "type": { "const": "literal" },
            "value": { "$ref": "#/$defs/VariableValue" }
          },
          "additionalProperties": false
        }
      ]
    }
```

0.2 的 `Comparison` 两侧都显式标记为 variable 或 literal，因而可无损表示变量与变量、变量与字面量或字面量与字面量的合法比较。variable operand 的 `name` 不含 `$`；object 字段访问以完整点路径保存，例如 `角色状态.魔力`。

历史 0.1 的 `{ "type": "comparison", "variable": string, "operator": string, "value": VariableValue }` 只属于读取兼容合同。0.2 schema 不接受该旧形状，serializer 也不得继续写出；引擎加载器应按 `$schema` 读取，并在运行时边界同时容忍两种形状。

#### FieldAccess

`FieldAccess` 是 0.2 `ConditionAst` 保留的显式对象字段访问节点。普通比较中的对象字段引用直接写入 variable operand 的完整点路径；独立 `field_access` 节点仍可供需要显式字段树的消费者使用。

```json
    "FieldAccess": {
      "type": "object",
      "required": ["type", "object", "field"],
      "properties": {
        "type": { "type": "string", "const": "field_access" },
        "object": {
          "type": "string",
          "minLength": 1,
          "description": "The object variable name or parent field (for nested access)."
        },
        "field": {
          "type": "string",
          "minLength": 1,
          "description": "The field name to access on the object."
        }
      },
      "additionalProperties": false
    }
```

> **注**：比较 `$角色状态.魔力 >= 10` 的 0.2 标准写出为：
> ```json
> {
>   "expression": "($角色状态.魔力>=10)",
>   "ast": {
>     "type": "comparison",
>     "left": { "type": "variable", "name": "角色状态.魔力" },
>     "operator": ">=",
>     "right": { "type": "literal", "value": 10 }
>   }
> }
> ```
> 引擎解析 variable operand 的 `name` 时通过 `.` 分隔符逐级访问 object 字段。

---

### 5.5 SideEffect

```json
    "SideEffect": {
      "type": "object",
      "required": ["variable", "operation", "value"],
      "properties": {
        "variable": {
          "type": "string",
          "minLength": 1,
          "description": "Variable name to modify, e.g. '好感度' or '角色状态.生命' for nested fields."
        },
        "operation": {
          "type": "string",
          "enum": ["set", "add", "subtract", "append"],
          "description": "Operation type: 'set' (assign), 'add' (increment), 'subtract' (decrement), 'append' (string concatenation)."
        },
        "value": {
          "description": "The value to apply. Type depends on the variable's declared type.",
          "oneOf": [
            { "type": "integer" },
            { "type": "number" },
            { "type": "boolean" },
            { "type": "string" }
          ]
        }
      },
      "additionalProperties": false
    }
```

#### 操作对照表

| 操作 | JSON `operation` | 语法示例 | 适用类型 | 说明 |
|------|------------------|---------|---------|------|
| 赋值 | `set` | `武器='长剑'` | 所有类型 | 直接覆盖变量值 |
| 增加 | `add` | `好感度+3` | int, float | 在现有值上增加 |
| 减少 | `subtract` | `金币-10` | int, float | 在现有值上减少 |
| 追加 | `append` | `日志←'获得了钥匙'` | string | 追加文本到末尾 |

#### 注意事项

- 对非数值类型使用 `add`/`subtract` 是错误 **E004**（类型不匹配）
- 对非字符串类型使用 `append` 是错误 **E004**
- `set` 操作的值类型必须与变量声明类型一致
- 枚举类型使用 `set` 时，`value` 必须是声明 `values` 数组中的合法值（错误 **E003**）

---

## 6. 历史 0.1 完整示例（保留记录，已被 ADR-013 的 0.2 合同覆盖）

以下是将 PRD §4.6 的完整 `.mdstory` 文件导出为标准 JSON 的结果。

```json
{
  "$schema": "https://plotflow.dev/schema/0.1/story.json",
  "meta": {
    "plotflow": "0.1",
    "title": "暗夜森林·试玩版",
    "author": "PlotFlow Team",
    "engine": "godot",
    "exportedAt": "2026-06-10T12:00:00Z"
  },
  "variables": {
    "好感度": { "type": "int", "default": 0, "scope": "global" },
    "金币": { "type": "int", "default": 0, "scope": "global" },
    "武器": {
      "type": "enum",
      "values": ["无", "剑", "弓", "杖"],
      "default": "无",
      "scope": "global"
    },
    "拥有钥匙": { "type": "bool", "default": false, "scope": "global" },
    "角色状态": {
      "type": "object",
      "scope": "global",
      "fields": {
        "生命": { "type": "int", "default": 100 },
        "魔力": { "type": "int", "default": 50 }
      }
    }
  },
  "chapters": [
    {
      "id": "第一章",
      "title": "村庄",
      "nodes": [
        {
          "id": "森林入口",
          "chapterId": "第一章",
          "fullId": "第一章/森林入口",
          "title": "森林入口",
          "body": [
            "你站在幽暗森林的边缘，两条小径延伸向前。",
            "夜幕即将降临，你必须做出选择。"
          ],
          "options": [
            {
              "index": 0,
              "text": "走向左边的狼嚎声",
              "targetNodeId": "狼穴",
              "targetChapterId": null,
              "targetFullId": "第一章/狼穴",
              "conditions": null,
              "sideEffects": [
                { "variable": "好感度", "operation": "add", "value": 1 }
              ]
            },
            {
              "index": 1,
              "text": "探索右边的古井",
              "targetNodeId": "古井",
              "targetChapterId": null,
              "targetFullId": "第一章/古井",
              "conditions": null,
              "sideEffects": []
            },
            {
              "index": 2,
              "text": "返回村庄",
              "targetNodeId": "村庄广场",
              "targetChapterId": null,
              "targetFullId": "第一章/村庄广场",
              "conditions": null,
              "sideEffects": []
            }
          ],
          "position": { "x": 0, "y": 0 },
          "isRoot": true,
          "isOrphan": false,
          "isDeadEnd": false
        },
        {
          "id": "狼穴",
          "chapterId": "第一章",
          "fullId": "第一章/狼穴",
          "title": "狼穴",
          "body": [
            "洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。",
            "一头巨狼挡在路前。"
          ],
          "options": [
            {
              "index": 0,
              "text": "战斗",
              "targetNodeId": "战斗结果",
              "targetChapterId": null,
              "targetFullId": "第一章/战斗结果",
              "conditions": null,
              "sideEffects": [
                { "variable": "角色状态.生命", "operation": "subtract", "value": 10 }
              ]
            },
            {
              "index": 1,
              "text": "投喂食物",
              "targetNodeId": "驯服狼",
              "targetChapterId": null,
              "targetFullId": "第一章/驯服狼",
              "conditions": {
                "expression": "($金币>=10) AND ($武器!='无')",
                "ast": {
                  "type": "logical_and",
                  "left": {
                    "type": "comparison",
                    "variable": "金币",
                    "operator": ">=",
                    "value": 10
                  },
                  "right": {
                    "type": "comparison",
                    "variable": "武器",
                    "operator": "!=",
                    "value": "无"
                  }
                }
              },
              "sideEffects": [
                { "variable": "金币", "operation": "subtract", "value": 10 },
                { "variable": "好感度", "operation": "add", "value": 5 }
              ]
            },
            {
              "index": 2,
              "text": "悄悄退后",
              "targetNodeId": "森林入口",
              "targetChapterId": null,
              "targetFullId": "第一章/森林入口",
              "conditions": null,
              "sideEffects": []
            }
          ],
          "position": { "x": 300, "y": 150 },
          "isRoot": false,
          "isOrphan": false,
          "isDeadEnd": false
        },
        {
          "id": "古井",
          "chapterId": "第一章",
          "fullId": "第一章/古井",
          "title": "古井",
          "body": [
            "井口长满青苔，井水清澈见底。",
            "井壁上刻着古老的符文。"
          ],
          "options": [
            {
              "index": 0,
              "text": "喝井水",
              "targetNodeId": "井水效果",
              "targetChapterId": null,
              "targetFullId": "第一章/井水效果",
              "conditions": null,
              "sideEffects": [
                { "variable": "角色状态.魔力", "operation": "add", "value": 5 }
              ]
            },
            {
              "index": 1,
              "text": "调查符文",
              "targetNodeId": "符文秘密",
              "targetChapterId": null,
              "targetFullId": "第一章/符文秘密",
              "conditions": {
                "expression": "($角色状态.魔力>=10)",
                "ast": {
                  "type": "comparison",
                  "variable": "角色状态.魔力",
                  "operator": ">=",
                  "value": 10
                }
              },
              "sideEffects": [
                { "variable": "拥有钥匙", "operation": "set", "value": true }
              ]
            },
            {
              "index": 2,
              "text": "离开",
              "targetNodeId": "森林入口",
              "targetChapterId": null,
              "targetFullId": "第一章/森林入口",
              "conditions": null,
              "sideEffects": []
            }
          ],
          "position": { "x": 600, "y": 150 },
          "isRoot": false,
          "isOrphan": false,
          "isDeadEnd": false
        }
      ]
    }
  ]
}
```

### 示例结构要点

| 要点 | 说明 |
|------|------|
| `fullId` 唯一性 | 每个节点的 canonical `fullId` 在整个 JSON 文件中唯一；身份来自独立 chapterId/id 组件，不从 FullID 反向拆分 |
| `conditions: null` | 无条件选项（默认选项），引擎应始终显示该选项 |
| `sideEffects: []` | 无副作用的选项，空数组而非省略 |
| `targetFullId` 引用 | 非 null 的 `targetFullId` 必须能在 JSON 中找到对应的 `Node.fullId`；它是 opaque key，禁止拆分 |
| 对象字段路径 | `角色状态.生命` 用 `.` 分隔符表示嵌套对象字段访问 |
| 诊断标志 | `isRoot`、`isOrphan`、`isDeadEnd` 由编辑器计算，引擎插件**不应**依赖它们做运行时判断——引擎应自行评估可达性 |
| `position` | 仅用于编辑器分支图布局恢复；引擎运行时忽略此字段 |

---

## 7. 验证规则

以下规则**超出 JSON Schema 类型检查范围**，需要在应用层验证。

### 7.1 结构完整性规则

| 编号 | 规则 | 严重性 | 检查方法 |
|------|------|--------|---------|
| V01 | 所有 `fullId` 必须全局唯一 | 🔴 Error | 收集所有 `Node.fullId`，检查重复 |
| V02 | 每个非 null 的 `Option.targetFullId` 必须引用一个存在的 `Node.fullId` | 🔴 Error | 收集所有 `Node.fullId`，检查引用存在性 |
| V03 | 有且只有一个 `isRoot: true` 的节点 | 🔴 Error | 统计 `isRoot` 为 `true` 的节点数，不等于 1 则错误 |
| V04 | `Node.chapterId` 必须匹配其所属 `Chapter.id` | 🔴 Error | 检查 `chapterId` 与容器 Chapter 的 `id` 一致 |
| V05 | `Node.fullId` 必须等于共享 helper 对 chapterId/id 生成的 encoded-slash canonical ID | 🔴 Error | 调用同一 helper 比较；禁止手写模板或拆分 FullID |
| V06 | 故事至少包含一个章节，且每个章节至少包含一个节点 | 🔴 E009 | 同时执行语义 validator 与 Schema 0.2 `minItems` 校验；失败时禁止写盘 |

### 7.2 变量与类型规则

| 编号 | 规则 | 严重性 | 检查方法 |
|------|------|--------|---------|
| V10 | `ConditionExpression.ast` 中引用的变量必须在 `variables` 中定义 | 🔴 Error | 遍历 AST 收集变量名，逐一查找 |
| V11 | `SideEffect.variable` 引用的变量必须在 `variables` 中定义 | 🔴 Error | 遍历所有 sideEffects，逐一验证 |
| V12 | `SideEffect.operation` 必须与变量类型兼容 | 🔴 Error | `add`/`subtract` 仅用于 int/float；`append` 仅用于 string |
| V13 | `SideEffect.value` 类型必须与变量声明类型匹配 | 🔴 Error | 按 `integration`、`number`、`boolean`、`string` 分别校验 |
| V14 | 枚举变量的 `SideEffect.value`（当 `operation="set"`）必须在声明 `values` 中 | 🔴 Error | 查找 `VariableDef.values` 数组，检查包含关系 |
| V15 | Object 嵌套深度不超过 3 层 | 🔴 Error | 递归遍历 `VariableDef.fields`，计数深度 |
| V16 | `Comparison.left/right` 的 typed operands 必须存在且类型兼容 | 🔴 Error | 解析 variable operand 的声明类型与 literal operand 的 JSON 类型；变量-变量比较两侧声明类型也须兼容 |
| V17 | 顶层 `scope=chapter` 必须有真实 `chapter`；其他 scope 禁止 chapter | 🔴 Error | 对照 `chapters[].id`；阻断导出 |
| V18 | 嵌套 fields 禁止 `scope/chapter`，并继承顶层变量可见性 | 🔴 Error | 递归字段声明并使用根变量上下文 |

### 7.3 逻辑一致性规则

| 编号 | 规则 | 严重性 | 检查方法 |
|------|------|--------|---------|
| V20 | 若 `conditions != null`，`expression` 字符串应与 `ast` 语义一致 | 🟡 Warning | 将 AST 序列化为文本，与 `expression` 做等价性比较（宽松匹配） |
| V21 | `Option.index` 在同一节点的选项列表中不得重复 | 🔴 Error | 收集 `index` 值，检查重复 |
| V22 | `isOrphan` 应与实际情况一致 | 🟡 Warning | 自行计算：检查是否有任何 Option 指向该节点 |
| V23 | `isDeadEnd` 应与实际情况一致 | 🟡 Warning | 自行计算：检查 `options` 数组是否为空 |

### 7.4 应用层验证示例（TypeScript）

```typescript
import Ajv2020 from "ajv/dist/2020.js";
import schema from "../packages/core/schema/0.2/story.json";

/**
 * Validate a PlotFlow story JSON against both JSON Schema and
 * application-level rules.
 */
function validateStory(json: unknown): ValidationResult {
  // Step 1: JSON Schema validation (structural + type checking)
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);
  const schemaValid = validate(json);

  if (!schemaValid) {
    return { valid: false, errors: validate.errors! };
  }

  // Step 2: Application-level rules
  const appErrors = runAppValidationRules(json as Story);
  return {
    valid: appErrors.length === 0,
    errors: appErrors,
  };
}

function runAppValidationRules(story: Story): AppError[] {
  const errors: AppError[] = [];

  // V01: fullId uniqueness
  const fullIds = new Map<string, Node>();
  for (const ch of story.chapters) {
    for (const node of ch.nodes) {
      if (fullIds.has(node.fullId)) {
        errors.push({
          code: "V01",
          message: `Duplicate fullId: "${node.fullId}"`,
          severity: "error",
        });
      }
      fullIds.set(node.fullId, node);
    }
  }

  // V02: targetFullId must reference existing node
  for (const ch of story.chapters) {
    for (const node of ch.nodes) {
      for (const opt of node.options) {
        if (opt.targetFullId !== null && !fullIds.has(opt.targetFullId)) {
          errors.push({
            code: "V02",
            message: `Option "${opt.text}" targets non-existent node "${opt.targetFullId}"`,
            severity: "error",
          });
        }
      }
    }
  }

  // V03: exactly one root
  const rootCount = Array.from(fullIds.values()).filter(n => n.isRoot).length;
  if (rootCount !== 1) {
    errors.push({
      code: "V03",
      message: `Expected exactly 1 root node, found ${rootCount}`,
      severity: "error",
    });
  }

  // ... additional rules V04-V23

  return errors;
}
```

---

## 8. 版本兼容性

### 8.1 版本号策略

PlotFlow JSON Schema 遵循**语义化版本**（SemVer）：

```
MAJOR.MINOR.PATCH
  │      │      └── 由 PlotFlow 编辑器版本决定（如 0.1.3）
  │      └────────── Schema 版本号（如 0.1）
  └───────────────── 保留，固定为 0（预正式版阶段）
```

Schema 标识符格式：`https://plotflow.dev/schema/{MAJOR}.{MINOR}/story.json`

### 8.2 向后兼容变更（不改变 MINOR 版本）

以下变更**不**需要提升 Schema 版本号：

| 变更类型 | 示例 |
|----------|------|
| 新增可选字段 | 给 `Node` 加一个 `tags: string[]`（可选） |
| 放宽约束 | `body` 允许空数组（之前 `minItems: 1`） |
| 新增 enum 值 | `VariableScope` 加 `"file"` 作用域 |
| 新增 AST 节点类型 | 加 `"comparison_chain"` 类型（不影响旧节点解析） |
| 字段顺序变更 | `meta` 对象内字段重排 |

### 8.3 破坏性变更（必须提升 MINOR 版本，MAJOR 为 0 时）

以下变更**必须**提升 Schema MINOR 版本（如 0.1 → 0.2）：

| 变更类型 | 示例 |
|----------|------|
| 移除必须字段 | 删除 `meta.engine` |
| 新增必须字段 | 给 `Node` 加 `priority: number`（必须） |
| 类型变更 | `operation` 从 `string` 变为 `enum` |
| 结构重组 | `chapters[]` 改成 `story.chapters` 嵌套 |
| 移除 AST 节点类型 | 删除 `field_access` 支持 |
| Semantic change | `index` 从 0-based 改为 1-based |

### 8.4 引擎插件版本适配矩阵

| Schema 版本 | Godot 插件版本 | Unity 插件版本 | Unreal 插件版本 |
|-------------|---------------|---------------|----------------|
| 0.1（历史读取兼容） | 0.1.x | 0.1.x | 0.1.x |
| 0.2（当前写出合同；实现门禁进行中） | 0.2.x | 0.2.x | 0.1.x（只读兼容层） |

0.2 的 FullID 是 `encodeURIComponent(chapterId) + "/" + encodeURIComponent(nodeId)` 生成的 opaque key。`targetChapterId` 必填但可空；`targetNodeId` / `targetFullId` 必填且可空。encoded-slash 对等关系、引用存在性、章节变量所指章节存在性和 FullID 唯一性由语义 validator 负责，不用 JSON Schema 正则模拟。

### 8.5 前向兼容处理建议

引擎插件在解析 JSON 时应遵循 **Postel 法则**：

```
"Be conservative in what you send, liberal in what you accept."
```

- **未知字段**：忽略（不报错），允许 Schema 版本升级后旧插件仍能读取
- **已知字段、未知值**：降级处理。如遇到未来的 `operation: "multiply"`，记录 Warning 并跳过该 SideEffect
- **`$schema` 版本检查**：若 `$schema` 指向的版本高于插件支持的最高版本，输出 Warning "此 JSON 由更新版本的 PlotFlow 导出，部分特性可能不可用"，但继续尽力解析

---

## 9. 引擎集成指南

### 9.1 通用解析流程

无论目标引擎是什么，解析 PlotFlow JSON 的标准流程如下：

```
                              加载 story.json
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
              验证 JSON Schema              读取 meta 信息
              (ajv 或等效工具)              (版本/引擎/标题)
                     │
                     ▼
              ┌──────────────────┐
              │  Step 1: 构建变量表 │
              │  遍历 variables    │
              │  初始化默认值      │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Step 2: 索引节点  │
              │  构建 fullId →    │
              │  Node 映射表      │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Step 3: 构建 AST  │
              │  条件的 AST 树存  │
              │  储为可评估结构   │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Step 4: 就绪     │
              │  Loader 对外暴露  │
              │  get_node() API  │
              └──────────────────┘
```

### 9.2 Godot 集成（GDScript）

#### 数据模型结构体

```gdscript
# res://addons/plotflow/runtime/PlotFlowData.gd
class_name PlotFlowVariableDef
var type: String          # "int", "float", "bool", "string", "enum", "object"
var default_value         # Variant
var scope: String         # "global" or "chapter"
var chapter: String       # Only for scope "chapter"
var values: Array         # Only for type "enum"
var fields: Dictionary    # Only for type "object"

class_name PlotFlowNode
var id: String
var chapter_id: String
var full_id: String
var title: String
var body: PackedStringArray
var options: Array[PlotFlowOption]
var position: Vector2
var is_root: bool
var is_orphan: bool
var is_dead_end: bool

class_name PlotFlowOption
var index: int
var text: String
var target_node_id: String
var target_chapter_id: String
var target_full_id: String
var conditions   # null or Dictionary (AST)
var side_effects: Array[PlotFlowSideEffect]

class_name PlotFlowSideEffect
var variable: String
var operation: String   # "set", "add", "subtract", "append"
var value               # Variant
```

#### 加载器示例

```gdscript
# res://addons/plotflow/runtime/StoryLoader.gd
class_name PlotFlowStoryLoader
extends RefCounted

var _nodes: Dictionary = {}  # fullId -> PlotFlowNode
var _variables: Dictionary = {}
var _root_id: String

static func load(path: String) -> PlotFlowStoryLoader:
    var file = FileAccess.open(path, FileAccess.READ)
    var json_text = file.get_as_text()
    file.close()

    var json = JSON.new()
    var error = json.parse(json_text)
    if error != OK:
        push_error("PlotFlow: Failed to parse JSON: %s" % json.get_error_message())
        return null

    var data = json.get_data()
    var loader = PlotFlowStoryLoader.new()
    loader._parse(data)
    return loader

func _parse(data: Dictionary) -> void:
    # Step 1: 初始化变量
    for var_name in data["variables"]:
        var def = data["variables"][var_name]
        _variables[var_name] = _resolve_default(def)

    # Step 2: 索引节点
    for chapter in data["chapters"]:
        for node_data in chapter["nodes"]:
            var node = _parse_node(node_data)
            _nodes[node.full_id] = node
            if node.is_root:
                _root_id = node.full_id

func get_node(full_id: String) -> PlotFlowNode:
    return _nodes.get(full_id, null)

func get_root() -> PlotFlowNode:
    return _nodes.get(_root_id, null)

func get_variables() -> Dictionary:
    return _variables

func _resolve_default(def: Dictionary):
    match def["type"]:
        "int": return def.get("default", 0)
        "float": return def.get("default", 0.0)
        "bool": return def.get("default", false)
        "string": return def.get("default", "")
        "enum": return def.get("default", def["values"][0])
        "object":
            var obj = {}
            for field in def.get("fields", {}):
                obj[field] = _resolve_default(def["fields"][field])
            return obj
    return null
```

#### 条件评估器

```gdscript
# res://addons/plotflow/runtime/ConditionEval.gd
class_name PlotFlowConditionEval
extends RefCounted

# Evaluate an option's conditions against current variable state
static func evaluate(conditions, variables: Dictionary) -> bool:
    if conditions == null:
        return true  # Unconditional option

    var ast = conditions["ast"]
    return _eval_ast(ast, variables)

static func _eval_ast(ast: Dictionary, vars: Dictionary) -> bool:
    match ast["type"]:
        "logical_and":
            return _eval_ast(ast["left"], vars) and _eval_ast(ast["right"], vars)
        "logical_or":
            return _eval_ast(ast["left"], vars) or _eval_ast(ast["right"], vars)
        "logical_not":
            return not _eval_ast(ast["operand"], vars)
        "comparison":
            # 0.2 uses typed left/right operands. The fallback is historical 0.1.
            var left_value
            var right_value
            if ast.has("left") and ast.has("right"):
                left_value = _resolve_operand(ast["left"], vars)
                right_value = _resolve_operand(ast["right"], vars)
            else:
                left_value = _resolve_variable(str(ast.get("variable", "")), vars)
                right_value = ast.get("value")
            match ast["operator"]:
                "==": return left_value == right_value
                "!=": return left_value != right_value
                ">":  return left_value > right_value
                "<":  return left_value < right_value
                ">=": return left_value >= right_value
                "<=": return left_value <= right_value
    return false

static func _resolve_operand(operand: Dictionary, vars: Dictionary):
    match operand.get("type", ""):
        "variable": return _resolve_variable(str(operand.get("name", "")), vars)
        "literal": return operand.get("value")
    return null

# Resolve variable including dot-path for nested objects
static func _resolve_variable(path: String, vars: Dictionary):
    var parts = path.split(".")
    var current = vars.get(parts[0])
    for i in range(1, parts.size()):
        if current is Dictionary and parts[i] in current:
            current = current[parts[i]]
        else:
            return null
    return current
```

#### 变量管理器

```gdscript
# res://addons/plotflow/runtime/VariableStore.gd
class_name PlotFlowVariableStore
extends RefCounted

var _vars: Dictionary = {}

func init_from_defs(defs: Dictionary) -> void:
    for var_name in defs:
        _vars[var_name] = _resolve_default(defs[var_name])

func apply_effects(effects: Array) -> void:
    for effect in effects:
        _apply_effect(effect)

func _apply_effect(eff: Dictionary) -> void:
    var target = _get_var_ref(eff["variable"])
    match eff["operation"]:
        "set":
            _set_var_ref(eff["variable"], eff["value"])
        "add":
            var old = _get_var_ref(eff["variable"])
            _set_var_ref(eff["variable"], old + eff["value"])
        "subtract":
            var old = _get_var_ref(eff["variable"])
            _set_var_ref(eff["variable"], old - eff["value"])
        "append":
            var old = _get_var_ref(eff["variable"])
            _set_var_ref(eff["variable"], str(old) + str(eff["value"]))

func _get_var_ref(path: String):
    # Dot-path resolution for nested object fields
    var parts = path.split(".")
    var current = _vars[parts[0]]
    for i in range(1, parts.size()):
        current = current[parts[i]]
    return current

func _set_var_ref(path: String, value) -> void:
    var parts = path.split(".")
    if parts.size() == 1:
        _vars[parts[0]] = value
        return
    var current = _vars[parts[0]]
    for i in range(1, parts.size() - 1):
        current = current[parts[i]]
    current[parts[parts.size() - 1]] = value

func _resolve_default(def: Dictionary):
    match def["type"]:
        "int": return def.get("default", 0)
        "float": return def.get("default", 0.0)
        "bool": return def.get("default", false)
        "string": return def.get("default", "")
        "enum": return def.get("default", def["values"][0])
        "object":
            var obj = {}
            for field in def.get("fields", {}):
                obj[field] = _resolve_default(def["fields"][field])
            return obj
    return null
```

### 9.3 Unity 集成（C#）

#### 数据模型

```csharp
// PlotFlowData.cs
using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
public class PlotFlowStory
{
    public PlotFlowMeta meta;
    public Dictionary<string, PlotFlowVariableDef> variables;
    public List<PlotFlowChapter> chapters;
}

[Serializable]
public class PlotFlowMeta
{
    public string plotflow;
    public string title;
    public string author;
    public string engine;
    public string exportedAt;
}

[Serializable]
public class PlotFlowVariableDef
{
    public string type;
    public string scope;
    public string description;
    public string chapter;
    public object @default;
    public List<string> values;         // for enum
    public Dictionary<string, PlotFlowVariableDef> fields; // for object
}

[Serializable]
public class PlotFlowChapter
{
    public string id;
    public string title;
    public List<PlotFlowNode> nodes;
}

[Serializable]
public class PlotFlowNode
{
    public string id;
    public string chapterId;
    public string fullId;
    public string title;
    public List<string> body;
    public List<PlotFlowOption> options;
    public PlotFlowPosition position;
    public bool isRoot;
    public bool isOrphan;
    public bool isDeadEnd;
}

[Serializable]
public class PlotFlowPosition
{
    public float x;
    public float y;
}

[Serializable]
public class PlotFlowOption
{
    public int index;
    public string text;
    public string targetNodeId;
    public string targetChapterId;
    public string targetFullId;
    public PlotFlowConditionExpression conditions;
    public List<PlotFlowSideEffect> sideEffects;
}

[Serializable]
public class PlotFlowConditionExpression
{
    public string expression;
    // Use JsonNode or a library like Newtonsoft.Json.Linq for dynamic AST
    public object ast;
}

[Serializable]
public class PlotFlowSideEffect
{
    public string variable;
    public string operation; // "set", "add", "subtract", "append"
    public object value;
}
```

#### 加载器示例

```csharp
// PlotFlowStoryLoader.cs
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;

public class PlotFlowStoryLoader
{
    private Dictionary<string, PlotFlowNode> _nodes = new();
    private string _rootId;

    public static PlotFlowStoryLoader Load(string path)
    {
        var jsonText = System.IO.File.ReadAllText(path);
        var story = JsonConvert.DeserializeObject<PlotFlowStory>(jsonText);

        var loader = new PlotFlowStoryLoader();
        loader.Parse(story);
        return loader;
    }

    private void Parse(PlotFlowStory story)
    {
        foreach (var chapter in story.chapters)
        {
            foreach (var node in chapter.nodes)
            {
                _nodes[node.fullId] = node;
                if (node.isRoot)
                    _rootId = node.fullId;
            }
        }
    }

    public PlotFlowNode GetNode(string fullId)
        => _nodes.TryGetValue(fullId, out var node) ? node : null;

    public PlotFlowNode GetRoot()
        => GetNode(_rootId);
}
```

### 9.4 Unreal 集成（C++ / Blueprint）

#### 数据结构体（C++）

```cpp
// PlotFlowData.h
#pragma once

#include "CoreMinimal.h"
#include "PlotFlowData.generated.h"

UENUM(BlueprintType)
enum class EPlotFlowOperation : uint8
{
    Set      UMETA(DisplayName = "set"),
    Add      UMETA(DisplayName = "add"),
    Subtract UMETA(DisplayName = "subtract"),
    Append   UMETA(DisplayName = "append")
};

UENUM(BlueprintType)
enum class EPlotFlowVariableScope : uint8
{
    Global   UMETA(DisplayName = "global"),
    Chapter  UMETA(DisplayName = "chapter")
};

USTRUCT(BlueprintType)
struct FPlotFlowVariableDef
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FString Type;
    UPROPERTY(BlueprintReadOnly) EPlotFlowVariableScope Scope;
    UPROPERTY(BlueprintReadOnly) FString Chapter;

    // For enum type
    UPROPERTY(BlueprintReadOnly) TArray<FString> Values;

    // For object type
    UPROPERTY(BlueprintReadOnly) TMap<FString, FPlotFlowVariableDef> Fields;
};

USTRUCT(BlueprintType)
struct FPlotFlowSideEffect
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FString Variable;
    UPROPERTY(BlueprintReadOnly) EPlotFlowOperation Operation;
    // Use JSON value type or FString for simplicity in V0.1
    UPROPERTY(BlueprintReadOnly) FString ValueJson;
};

USTRUCT(BlueprintType)
struct FPlotFlowOption
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) int32 Index;
    UPROPERTY(BlueprintReadOnly) FString Text;
    UPROPERTY(BlueprintReadOnly) FString TargetNodeId;
    UPROPERTY(BlueprintReadOnly) FString TargetChapterId;
    UPROPERTY(BlueprintReadOnly) FString TargetFullId;

    // Conditions: use TSharedPtr<FJsonObject> for AST,
    // or a custom FPlotFlowASTNode hierarchy
    UPROPERTY(BlueprintReadOnly) FString ConditionsJson; // Serialized AST

    UPROPERTY(BlueprintReadOnly) TArray<FPlotFlowSideEffect> SideEffects;
};

USTRUCT(BlueprintType)
struct FPlotFlowNode
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FString Id;
    UPROPERTY(BlueprintReadOnly) FString ChapterId;
    UPROPERTY(BlueprintReadOnly) FString FullId;
    UPROPERTY(BlueprintReadOnly) FString Title;
    UPROPERTY(BlueprintReadOnly) TArray<FString> Body;
    UPROPERTY(BlueprintReadOnly) TArray<FPlotFlowOption> Options;
    UPROPERTY(BlueprintReadOnly) FVector2D Position;
    UPROPERTY(BlueprintReadOnly) bool bIsRoot;
    UPROPERTY(BlueprintReadOnly) bool bIsOrphan;
    UPROPERTY(BlueprintReadOnly) bool bIsDeadEnd;
};
```

### 9.5 通用解析模式总结

| 步骤 | 操作 | Godot API | Unity API | Unreal API |
|------|------|-----------|-----------|------------|
| 1. 加载 JSON | 读取文件并解析 | `JSON.new().parse()` | `JsonConvert.DeserializeObject<>()` | `FJsonObjectConverter::JsonObjectStringToUStruct()` |
| 2. 构建变量表 | 初始化所有变量默认值 | Dictionary | Dictionary | TMap<FString, ...> |
| 3. 索引节点 | fullId → Node 映射 | Dictionary | Dictionary | TMap<FString, FPlotFlowNode> |
| 4. 评估条件 | 递归遍历 AST | match/recursion | switch/recursion | switch/recursion |
| 5. 执行副作用 | 变量读-改-写 | match + Dictionary access | switch + Dictionary access | switch + TMap access |
| 6. 字段访问 | 点号分隔路径解析 | `split(".")` | `Split('.')` | `ParseIntoArray` |

---

## 附录 A：当前 0.2 schema 文件组装

以下仅展示当前机器合同结构索引。可直接验证的完整文件是 `packages/core/schema/0.2/story.json`，不得从本文片段重新拼装替代。

```
story.schema.json
├── $schema:      "https://json-schema.org/draft/2020-12/schema"
├── $id:          "https://plotflow.dev/schema/0.2/story.json"
├── title:        "PlotFlow Story Export"
├── type:         "object"
├── required:     ["$schema", "meta", "variables", "chapters"]
├── properties:   { $schema, meta, variables, chapters }
└── $defs:
    ├── Meta
    ├── Variables          (additionalProperties → TopLevelVariableDef)
    ├── TopLevelVariableDef (scope/chapter 条件约束)
    ├── FieldDef           (递归字段，禁止 scope/chapter)
    ├── VariableShape      (int | float | bool | string | enum | object)
    ├── VariableScope      (enum: global | chapter)
    ├── Chapter
    ├── Node
    ├── Option
    ├── ConditionExpression
    ├── LogicalAnd
    ├── LogicalOr
    ├── LogicalNot
    ├── Comparison
    ├── Operand            (variable{name} | literal{value})
    ├── FieldAccess
    └── SideEffect
```

### 如何使用

```bash
# 使用 ajv-cli 验证导出产物
npm install -g ajv-cli
ajv validate -s packages/core/schema/0.2/story.json -d exports/story.json

# 或在 Node.js 中编程验证
```

```typescript
import Ajv2020 from "ajv/dist/2020.js";
import schema from "../packages/core/schema/0.2/story.json";

const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

const story = JSON.parse(fs.readFileSync("story.json", "utf-8"));
if (!validate(story)) {
  console.error("Schema validation failed:", validate.errors);
  process.exit(1);
}
console.log("Story JSON is valid.");
```

---

## 附录 B：错误类型速查

Schema 层的类型冲突被映射到 PlotFlow 错误检测系统的对应编号：

| JSON Schema 违规类型 | 对应错误编号 | 说明 |
|---------------------|-------------|------|
| `required` 字段缺失 | E005 | 语法解析失败（关键字段缺失） |
| `type` 不匹配 | E004 | 类型不匹配 |
| `enum` 值不合法 | E003 | 枚举值非法（如 operation 不是有效值） |
| `pattern` 不匹配 | E005 | 格式错误 |
| `additionalProperties` 违规 | E002 | 未知字段（可能是拼写错误或未声明变量） |
| AST `const` 不匹配 | E005 | AST 类型判别值错误 |

---

*文档结束。本文档与 `syntax-formal.md`（解析器语法形式化定义）同为 PlotFlow 核心规范的组成部分。两者关系：*
- *`syntax-formal.md` 定义 `.mdstory` → 中间表示的**解析规则***
- *`json-schema.md`（本文档）定义中间表示 → JSON 的**导出资约***
