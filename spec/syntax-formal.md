# PlotFlow .mdstory 语法形式化规范

**版本**：V1.0
**日期**：2026-06-10
**状态**：正式发布，作为解析器实现的唯一权威参考
**适用范围**：PlotFlow V0.1 解析器 (`@plotflow/parser`)

---

## 目录

1. [文件结构](#1-文件结构)
2. [YAML Frontmatter](#2-yaml-frontmatter)
3. [章节与节点](#3-章节与节点)
4. [选项语法](#4-选项语法)
5. [条件表达式](#5-条件表达式)
6. [变量操作（效果）](#6-变量操作效果)
7. [Token 定义](#7-token-定义)
8. [歧义消解规则](#8-歧义消解规则)
9. [完整解析示例](#9-完整解析示例)
10. [边界情况定义](#10-边界情况定义)

---

## 1. 文件结构

### 1.1 顶层产生式

采用 **ISO 14977 标准 EBNF** 记法。本文所有产生式均为权威定义，不得以自然语言描述覆盖。

```ebnf
(* ================================================================
   顶层结构
   ================================================================ *)

Story
    = Frontmatter ChapterList
    | Frontmatter
    | ChapterList
    ;

Frontmatter
    = "---" NL YAMLBlock "---" NL { NL }
    ;

ChapterList
    = Chapter { Chapter }
    ;

Chapter
    = ChapterHeading
      { NL }
      NodeList
    ;

NodeList
    = NodeBlock { NodeBlock }
    ;

NodeBlock
    = NodeHeading
      { NL }
      [ NodeBody ]
      OptionList
      [ Separator ]
      { NL }
    ;

OptionList
    = Option { Option }
    ;

Option
    = OptionLine { NL }
      [ ConditionLine { NL } ]
      [ EffectLine { NL } ]
    | OptionLine { NL }
      [ EffectLine { NL } ]
      [ ConditionLine { NL } ]
    ;
```

### 1.2 产生式说明

| 产生式 | 说明 |
|--------|------|
| `Story` | 一个完整的 .mdstory 文件。必须有 Frontmatter 或至少一个 Chapter，或两者都有。 |
| `Frontmatter` | YAML 分隔符 `---` 包裹的变量声明块。必须是文件的第一个非空内容。 |
| `ChapterList` | 一个或多个 Chapter 的序列。Chapter 之间不能嵌套。 |
| `Chapter` | 一个 H1 标题及其下的所有 Node。 |
| `NodeBlock` | 一个 H2 节点标题、正文、选项序列。节点之间由 `---` 分隔符或另一个 H2 标题自然分隔。 |
| `Option` | 一个选项行及其附属的条件/效果子行。条件与效果顺序可互换。 |

### 1.3 源文件编码

- **编码**：UTF-8（无 BOM）
- **换行符**：LF (`\n`) 或 CRLF (`\r\n`)，解析器必须同时支持
- **文件扩展名**：`.mdstory`（全小写）
- **MIME 类型**：`text/markdown; variant=plotflow`

---

## 2. YAML Frontmatter

### 2.1 整体结构

```ebnf
Frontmatter
    = "---" NL YAMLBlock "---" NL { NL }
    ;

YAMLBlock
    = MetaFields
      [ LayoutDecl ]
      VariableDeclarations
    ;

MetaFields
    = PlotFlowVersion
      TitleDecl
      [ AuthorDecl ]
      [ EngineDecl ]
    ;

PlotFlowVersion
    = "plotflow:" WS StringValue NL
    ;

TitleDecl
    = "title:" WS StringValue NL
    ;

AuthorDecl
    = "author:" WS StringValue NL
    ;

EngineDecl
    = "engine:" WS EngineValue NL
    ;

EngineValue
    = "generic" | "godot" | "unity" | "unreal"
    ;

LayoutDecl
    = "layout:" NL
      Indent "graph:" NL
      Indent Indent "version:" WS Integer NL
      Indent Indent "nodes:" NL
      { GraphLayoutNode }
    ;

GraphLayoutNode
    = Indent Indent Indent "-" WS "id:" WS StringValue NL
      Indent Indent Indent "x:" WS NumberValue NL
      Indent Indent Indent "y:" WS NumberValue NL
    ;

VariableDeclarations
    = "vars:" NL { Indent VariableDecl }
    ;
```

`.mdstory` 源语法和 Inspector 只使用 `generic | godot | unity | unreal`。`generic` 表示不绑定特定引擎；JSON Schema 0.2 导出边界必须把它映射为 `meta.engine: "none"`。`none` 仅属于 JSON 0.2 输出枚举，不是合法的源 `EngineValue`，parser 不应把源文件中的 `engine: none` 当作标准语法接受。

### 2.1.1 Graph Layout 块（可选）

`layout.graph.nodes` 是 Graph Lab / 分支图的手动布局投影，不属于剧情语义。旧文件可以完全没有该块；解析器必须继续用 Dagre 自动布局。存在该块时，节点坐标按 `id` 匹配到节点完整 ID。

```yaml
layout:
  graph:
    version: 1
    nodes:
      - id: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E6%9D%91%E5%8F%A3"
        x: 120
        y: 80
```

规则：

- `version` 当前固定为 `1`；未知版本不得阻断剧情解析，但可以忽略布局。
- `id` 使用 ADR-013 canonical FullID：`encodeURIComponent(chapterId) + "/" + encodeURIComponent(nodeId)`。FullID 是 opaque key，消费者不得自行拆分。
- `x` / `y` 必须是有限数字；非法坐标项应被忽略，不应导致 `.mdstory` 无法打开。
- 节点重命名、章节移动或删除时，Graph Lab 写回逻辑必须迁移或清理对应布局项。
- `layout.graph.version` 继续为 `1`。读取旧 `chapter-node` ID 时必须枚举当前 AST 的真实 `(chapterId, nodeId)` 计算 legacy alias；仅唯一匹配时在内存迁移坐标，碰撞时禁止猜测并报告歧义诊断。打开文件不得静默改写；下一次真实保存或布局事务才写回 canonical ID。

### 2.2 变量声明语法

```ebnf
VariableDecl
    = ShorthandVariableDecl
    | StructuredVariableDecl
    ;

ShorthandVariableDecl
    = Indent VarName ":" WS TypeSpec NL
    ;

StructuredVariableDecl
    = Indent VarName ":" NL
      Indent Indent StructuredVariableBody
    ;

StructuredVariableBody
    = "type:" WS VariableTypeName NL
      [ Indent Indent "default:" WS YamlValue NL ]
      [ Indent Indent "scope:" WS ( "global" | "chapter" ) NL ]
      [ Indent Indent "chapter:" WS StringValue NL ]
      [ Indent Indent "description:" WS StringValue NL ]
      [ Indent Indent "values:" WS YamlStringSequence NL ]
      [ Indent Indent "fields:" NL { StructuredFieldDecl } ]
    ;

VariableTypeName
    = PrimitiveType | "enum" | "object"
    ;

YamlValue
    = ? 与声明类型匹配的 YAML 标量、序列或映射 ?
    ;

YamlStringSequence
    = "[" StringValue { "," WS StringValue } "]"
    | ? 标准 YAML 块序列 ?
    ;

TypeSpec
    = PrimitiveType
    | EnumType
    | ObjectType
    ;

PrimitiveType
    = "int"
    | "float"
    | "bool"
    | "string"
    ;

EnumType
    = "enum" "[" EnumValue { "," EnumValue } "]"
    | "enum" "[" EnumValue { "，" EnumValue } "]"           (* 中文逗号分隔 *)
    ;

EnumValue
    = identifier                          (* 不含逗号、方括号、引号的非空字符串 *)
    | StringLiteral                       (* 含特殊字符时可用引号包裹 *)
    ;

ObjectType
    = "object" "{" NL
      { Indent Indent ObjectFieldDecl NL }
      Indent "}"
    ;

ObjectFieldDecl
    = VarName ":" WS TypeSpec
    ;

StructuredFieldDecl
    = Indent Indent Indent Indent VarName ":" WS TypeSpec NL
    | Indent Indent Indent Indent VarName ":" NL
      StructuredFieldBody
    ;

StructuredFieldBody
    = "type:" WS VariableTypeName NL
      [ Indent Indent "default:" WS YamlValue NL ]
      [ Indent Indent "description:" WS StringValue NL ]
      [ Indent Indent "values:" WS YamlStringSequence NL ]
      [ Indent Indent "fields:" NL { StructuredFieldDecl } ]
    ;
```

`StructuredVariableDecl` 是与旧 shorthand 并存的标准 YAML 映射形式。磁盘读取必须同时接受两种形式；写入结构化形式时使用以下字段：

| 字段 | 必需 | 约束 |
|------|:---:|------|
| `type` | ✅ | `int` / `float` / `bool` / `string` / `enum` / `object` |
| `default` | ❌ | 必须与声明类型匹配；省略时使用 §2.3 的类型默认值 |
| `scope` | ❌ | 仅顶层变量可用；`global` 或 `chapter`，省略时视为 `global` |
| `chapter` | scope 为 chapter 时必需 | 仅顶层变量可用；非空且必须引用当前故事中的真实章节 |
| `description` | ❌ | YAML 字符串 |
| `values` | enum 必需 | 非空、无重复的字符串序列；`default` 必须属于该序列 |
| `fields` | object 必需 | 字段名到结构化声明或旧 shorthand 的 YAML 映射，object 最多嵌套 3 层 |

```yaml
vars:
  金币: int                         # 旧 shorthand 继续有效
  职业:
    type: enum
    values: [战士, 法师, 盗贼]
    default: 法师
    scope: chapter
    chapter: 第一章
    description: 本章使用的职业伪装
  玩家:
    type: object
    default:                       # object default 可以局部覆盖字段默认值
      属性:
        生命: 80
    fields:
      名称:
        type: string
        default: 无名者
      属性:
        type: object
        fields:
          生命:
            type: int
            default: 100
          存活: bool               # fields 内可用 shorthand 渐进迁移
```

结构化声明的校验规则：

- `int` 默认值必须是 32 位有符号整数；`float` 必须是有限 YAML 数字；`bool` 与 `string` 不做隐式类型转换。
- `object.default` 必须是映射，只能引用 `fields` 中已声明的字段；允许局部覆盖，未出现的字段继承字段声明默认值。
- 顶层 `scope: chapter` 必须同时声明非空 `chapter`，且该章节必须存在；缺失或悬空是 Error 并阻断导出。`scope: global` 或省略 scope 时禁止携带 `chapter`。
- `scope` / `chapter` 只允许出现在顶层变量；object 的嵌套 fields 继承根变量的有效 scope/chapter，字段级声明二者触发 **E005**。
- chapter-scoped 变量随故事会话持久化，但只在其 `chapter` 指定章节的节点、条件和效果上下文中可见。
- 未知属性、非法类型、默认值类型不匹配或非法 `scope` 触发 **E005**；非法 enum 触发 **E003**；第 4 层 object 触发 **E006**。
- 旧 `name: int`、`name: enum[...]`、`name: object{...}` 文件无需迁移即可继续解析。

### 2.3 类型系统完整规格

| 类型 | 语法标记 | 默认值 | 合法值域 | 示例 |
|------|---------|--------|---------|------|
| `int` | `int` / `type: int` | `0` | 32位有符号整数 | `好感度: int` |
| `float` | `float` / `type: float` | `0.0` | IEEE 754 双精度 | `暴击率: float` |
| `bool` | `bool` / `type: bool` | `false` | `true` / `false` | `钥匙: bool` |
| `string` | `string` / `type: string` | `""` (空串) | 任意 Unicode 字符序列 | `日志: string` |
| `enum` | `enum[v1, ...]` / `type: enum` + `values` | 第一个枚举值 | 声明中列出的值 | `职业: enum[战士, 法师, 盗贼]` |
| `object` | `object{...}` / `type: object` + `fields` | 各字段默认值的组合 | 嵌套类型组合 | `装备: object{武器: enum[剑,弓], ...}` |

### 2.4 嵌套规则

```ebnf
(* 嵌套深度约束 *)
MaxObjectDepth = 3 ;    (* 外层 object → 内层 object → 最内层 object *)
```

- `object` 的字段类型可以是 `int`、`float`、`bool`、`string`、`enum` 或另一个 `object`
- 最大嵌套深度：**3 层**（以最外层 `object` 为第 1 层计数）
- 第 4 层及以上的 `object` 嵌套触发错误 **E006**
- 深度计算示例：
  ```
  # 深度 1: object
  #   深度 2: object
  #     深度 3: object    ← 合法，到达上限
  #       深度 4: int      ← 非法，触发 E006
  ```

### 2.5 变量名规则

```ebnf
VarName
    = identifier          (* 详见 §7 Token 定义 *)
    ;

(* 变量名约束 *)
(* - 必须以字母或中文字符开头 *)
(* - 可包含字母、数字、下划线、中文字符 *)
(* - 长度: 1-64 个 Unicode 码点 *)
(* - 区分大小写（英文部分） *)
(* - 同一 Frontmatter 内不得重复声明（触发 E008） *)
(* - 变量名不得与保留字冲突 *)
```

保留字（不可用作变量名）：

```
int, float, bool, string, enum, object,
true, false, AND, OR, NOT, generic, none,
plotflow, title, author, engine, layout, graph, version, nodes, x, y, vars
```

### 2.6 字符串值

```ebnf
StringValue
    = '"' { ? 任意非 '"' 字符 ? | '\"' } '"'
    | "'" { ? 任意非 "'" 字符 ? | "\'" } "'"
    | UnquotedString                             (* 不含冒号、换行的简单值 *)
    ;

UnquotedString
    = ? 不含 ":"、换行符、首尾空白的非空字符序列 ?
    ;
```

### 2.7 数字值

```ebnf
Integer
    = Digit { Digit }
    ;

NumberValue
    = [ "-" ] Digit { Digit } [ "." Digit { Digit } ]
    ;

Digit
    = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
    ;
```

---

## 3. 章节与节点

### 3.1 章节定义

```ebnf
ChapterHeading
    = "#" WS ChapterTitle NL
    ;

ChapterTitle
    = ? 非空文本行，不含换行符 ?
    ;

(* 同一 Chapter 内的所有 Node 归属于该 Chapter *)
(* Chapter 的 ID 为去除 "# " 前缀和首尾空白后的 ChapterTitle *)
```

### 3.2 节点定义

```ebnf
NodeHeading
    = "##" WS "节点" NodeColon WS NodeName NL
    ;

NodeColon
    = "："               (* U+FF1A 全角冒号，规范形式 *)
    | ":"                (* U+003A 半角冒号，解析器必须接受并规范化为全角 *)
    ;

NodeName
    = ? 非空文本，不含换行符 ?
    ;

(* 节点 ID = NodeName 去除首尾空白 *)
(* 命名章节 FullID = encodeURIComponent(ChapterTitle) "/" encodeURIComponent(NodeName) *)
(* 匿名章节 FullID = encodeURIComponent(NodeName) *)
(* FullID 必须全局唯一 *)
(* FullID 是 opaque key；禁止通过 split/substring 反推 chapterId 或 nodeId *)
```

### 3.3 节点头部约束

| 规则 | 约束内容 | 违反级别 |
|------|---------|---------|
| N1 | canonical FullID 全局唯一；不同章节允许同名节点，身份由独立 `chapterId` / `nodeId` 组件构造。 | 🔴 E007 |
| N3 | 章节标题格式 `# 标题`，节点标题格式 `## 节点：名称` | 🟡 W006 |
| N5 | 节点描述文本（body）不能为空或仅空白字符 | 🟡 W005 |

### 3.4 节点正文

```ebnf
NodeBody
    = Paragraph { Paragraph }
    ;

Paragraph
    = BodyLine NL
    ;

BodyLine
    = ? 非空行，不以 "#", "[选项]", "条件:", "效果:", "---" 开头 ?
    ;

(* 正文从 NodeHeading 之后开始，到第一个 OptionLine 之前结束 *)
(* 中间的纯空白行被忽略 *)
(* H3 标题（如 "### 选项区"）被视为正文的一部分（非结构化） *)
```

### 3.5 分隔符

```ebnf
Separator
    = "---"             (* Markdown 水平分隔线 *)
    ;

(* 出现在两个 NodeBlock 之间，可选 *)
(* 出现在 NodeBlock 内部时视为正文内容 *)
```

---

## 4. 选项语法

### 4.1 选项行

```ebnf
OptionLine
    = "[选项]" WS OptionText WS "->" WS TargetRef NL
    ;

OptionText
    = ? 非空文本，不含 "->" 序列 ?
    ;

TargetRef
    = [ ChapterPrefix "/" ] "节点" NodeColon WS TargetNodeName
    ;

ChapterPrefix
    = ChapterTitle              (* 保持用户可读原文；不写百分号编码 FullID *)
    ;

TargetNodeName
    = NodeName                  (* 目标节点的 NodeName *)
    ;
```

### 4.2 选项行约束

| 规则 | 约束内容 | 违反级别 |
|------|---------|---------|
| O1 | `-> 节点：目标` 必须存在，且 `TargetRef` 解析出的 FullID 必须对应一个已定义的 Node | 🔴 E001 |
| O5 | 无条件子行的选项 = 默认选项，始终可用 | — |
| O6 | 同一 Node 下所有 Option 的 OptionText（去除首尾空白后）不能完全相同 | 🟡 W004 |

`TargetRef` 始终先解析为独立的 `targetChapterId` 与 `targetNodeId`，再由 core 共享 helper 生成 canonical `targetFullId`。App、插件和运行时必须把 FullID 当作 opaque key，不得自行拼接或拆分。章节名含 `/` 时，以目标标记前最后一个结构性 `/节点` 边界解析，名称组件本身保持未编码的用户文本。

### 4.3 条件子行

```ebnf
ConditionLine
    = Indent "条件" CondColon WS ConditionExpression NL
    ;

CondColon
    = ":"                (* U+003A 半角冒号 *)
    | "："               (* U+FF1A 全角冒号，解析器必须接受 *)
    ;

ConditionExpression
    = ? 条件表达式，详见 §5 ?
    ;
```

### 4.4 效果子行

```ebnf
EffectLine
    = Indent "效果" EffectColon WS "(" EffectList ")" NL
    ;

EffectColon
    = ":"                (* U+003A 半角冒号 *)
    | "："               (* U+FF1A 全角冒号，解析器必须接受 *)
    ;

EffectList
    = ? 效果操作列表，详见 §6 ?
    ;
```

### 4.5 子行缩进规则

```ebnf
Indent
    = "  "               (* 2 个空格，推荐 *)
    | "\t"               (* 1 个 Tab *)
    ;

(* 条件/效果子行必须相对于其所属的 OptionLine 缩进 *)
(* 缩进量 = 恰好 1 级缩进（2 空格或 1 Tab） *)
(* 缩进不正确触发 E005 *)
```

### 4.6 选项完整结构约束

| 规则 | 约束内容 | 违反级别 |
|------|---------|---------|
| O2 | 条件子行以 `条件:` 开头，缩进 1 级 | 🔴 E005 |
| O3 | 效果子行以 `效果:` 开头，缩进 1 级 | 🔴 E005 |
| O4 | 一个选项可同时有条件和效果，也可只有其一或两者均无 | — |

---

## 5. 条件表达式

### 5.1 表达式语法（完整 EBNF）

```ebnf
(* ================================================================
   条件表达式 — 完整运算符优先级语法
   优先级从低到高: OR < AND < NOT < 比较运算符
   ================================================================ *)

ConditionExpression
    = OrExpression
    ;

OrExpression
    = AndExpression { WS "OR" WS AndExpression }
    ;

AndExpression
    = NotExpression { WS "AND" WS NotExpression }
    ;

NotExpression
    = "NOT" WS NotExpression
    | PrimaryExpression
    ;

PrimaryExpression
    = "(" WS ConditionExpression WS ")"
    | ComparisonExpression
    ;

ComparisonExpression
    = Operand WS CompOp WS Operand
    ;

Operand
    = FieldAccess
    | Literal
    ;

FieldAccess
    = "$" VarName { "." VarName }
    ;

CompOp
    = "=="
    | "!="
    | ">="
    | "<="
    | ">"
    | "<"
    ;
```

源 parser 将每个比较两侧解析为带类型的操作数。JSON Schema 0.2 的唯一写出形状为：

```json
{
  "type": "comparison",
  "left": { "type": "variable", "name": "角色状态.魔力" },
  "operator": ">=",
  "right": { "type": "literal", "value": 10 }
}
```

- variable operand 写为 `{ "type": "variable", "name": string }`，`name` 保留完整点路径但不含 `$`。
- literal operand 写为 `{ "type": "literal", "value": VariableValue }`。
- 0.1 的 `{ type: "comparison", variable, operator, value }` 仅用于旧 JSON 读取兼容，parser/serializer 不得再把它作为 0.2 写出目标。
- Godot、Unity、Unreal 运行时读取器必须在版本边界同时容忍 0.2 typed operands 与历史 0.1 `variable/value`，但重新导出统一规范化为 0.2。

### 5.2 运算符优先级表

| 优先级 | 结合性 | 运算符 | 说明 |
|--------|--------|--------|------|
| 1 (最低) | 左 | `OR` | 逻辑或 |
| 2 | 左 | `AND` | 逻辑与 |
| 3 | 右 | `NOT` | 逻辑非（一元前缀） |
| 4 (最高) | 无 | `==` `!=` `>=` `<=` `>` `<` | 比较运算符 |

### 5.3 字面量

```ebnf
Literal
    = IntLiteral
    | FloatLiteral
    | BoolLiteral
    | StringLiteral
    | EnumLiteral
    ;

IntLiteral
    = [ "-" ] Digit { Digit }
    ;

FloatLiteral
    = [ "-" ] Digit { Digit } "." Digit { Digit }
    | [ "-" ] "." Digit { Digit }
    ;

BoolLiteral
    = "true" | "false"
    ;

StringLiteral
    = "'" { ? 任意非 "'" 和 "\" 字符 ? | EscapeSeq } "'"
    ;

EnumLiteral
    = identifier              (* 与枚举值列表中的值匹配 *)
    ;

EscapeSeq
    = "\" ( "'" | "\" | "n" | "t" | "r" | "0" )
    ;
```

### 5.4 字段访问

```ebnf
FieldAccess
    = "$" VarName { "." VarName }
    ;

(* 语义约束 *)
(* - $VarName 必须引用 Frontmatter 中声明的变量（否则触发 E002） *)
(* - .field 链的长度取决于变量的 object 嵌套深度 *)
(* - 每一级 .field 必须在对应层级的 object 类型中声明 *)
(* - 示例: $角色状态.魔力 → VarName="角色状态", field="魔力" *)
```

### 5.5 类型检查规则

| 操作 | 合法类型组合 | 非法示例 |
|------|-------------|---------|
| `==` `!=` | 任意类型，但两边必须类型兼容 | `$好感度 == 'abc'` (int vs string) |
| `>=` `<=` `>` `<` | int, float | `$钥匙 > 3` (bool vs int) |
| `AND` `OR` | bool (每个子表达式须产生 bool) | `($好感度 + 3) AND ($钥匙)` |
| `NOT` | bool | `NOT ($好感度)` (int 非 bool) |

### 5.6 条件表达式示例

```
(* 简单比较 *)
$好感度 >= 5
$武器 == '剑'

(* 逻辑组合 *)
($好感度 >= 5) AND ($金币 > 10)
($职业 == '战士') OR ($职业 == '法师')

(* 逻辑非 *)
NOT ($钥匙 == true)

(* 嵌套 *)
(($好感度 >= 5) AND ($金币 > 10)) OR ($职业 == '法师')

(* 字段访问 *)
$角色状态.魔力 >= 10
$装备.武器 != '无'
```

---

## 6. 变量操作（效果）

### 6.1 效果列表语法

```ebnf
EffectList
    = EffectOp { Separator EffectOp }
    ;

Separator
    = ","                 (* U+002C 半角逗号 *)
    | "，"                (* U+FF0C 全角逗号，解析器接受 *)
    ;

EffectOp
    = Assignment
    | Increment
    | Decrement
    | Append
    ;
```

### 6.2 四种操作

```ebnf
Assignment
    = LValue WS "=" WS RValue
    ;

Increment
    = LValue WS "+" WS RValue
    ;

Decrement
    = LValue WS "-" WS RValue
    ;

Append
    = LValue WS "←" WS RValue        (* "←" = U+2190 *)
    ;

LValue
    = VarName { "." VarName }         (* 字段访问路径 *)
    ;

RValue
    = IntLiteral
    | FloatLiteral
    | BoolLiteral
    | StringLiteral
    | EnumLiteral
    ;
```

### 6.3 操作规格表

| 操作 | 语法 | 语义 | 适用类型 | 示例 |
|------|------|------|---------|------|
| 赋值 (`=`) | `var = value` | 将 `var` 的值设为 `value` | 所有类型 | `武器='长剑'`, `钥匙=true` |
| 增加 (`+`) | `var + value` | `var := var + value` | int, float | `好感度+3` |
| 减少 (`-`) | `var - value` | `var := var - value` | int, float | `金币-10` |
| 追加 (`←`) | `var ← value` | `var := var + value`（字符串拼接） | string | `日志←'获得了钥匙'` |

### 6.4 类型检查

| 操作 | LValue 类型 | RValue 类型要求 | 错误 |
|------|-----------|---------------|------|
| `=` | 任意 | 与 LValue 类型兼容 | E004 |
| `+` | int | int | E004 |
| `+` | float | int 或 float | E004 |
| `-` | int | int | E004 |
| `-` | float | int 或 float | E004 |
| `←` | string | string | E004 |
| `=` | enum | RValue 必须在声明的枚举值列表中 | E003 |

### 6.5 完整效果示例

```
效果: (好感度+1)                              (* 单个增加 *)
效果: (好感度+3, 金币-10)                     (* 多个操作 *)
效果: (好感度+3, 金币-10, 武器='长剑', 钥匙=true)  (* 混合类型 *)
效果: (角色状态.生命-10)                       (* 字段访问 *)
效果: (日志←'获得了钥匙')                      (* 字符串追加 *)
```

---

## 7. Token 定义

### 7.1 字符集

```ebnf
(* ================================================================
   字符集定义
   ================================================================ *)

Letter
    = "A" | "B" | ... | "Z" | "a" | "b" | ... | "z"
    ;

Digit
    = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
    ;

ChineseChar
    = ? Unicode 码点范围 ?
      U+4E00..U+9FFF       (* CJK 统一表意文字 *)
    | U+3400..U+4DBF       (* CJK 扩展 A *)
    | U+F900..U+FAFF       (* CJK 兼容表意文字 *)
    | U+3000..U+303F       (* CJK 标点符号 *)
    ;

Whitespace
    = " "                  (* U+0020 空格 *)
    | "\t"                 (* U+0009 制表符 *)
    ;

NL                          (* 换行符 *)
    = "\n"                 (* U+000A LF *)
    | "\r\n"               (* U+000D U+000A CRLF *)
    ;
```

### 7.2 标识符

```ebnf
identifier
    = IdentifierStart { IdentifierPart }
    ;

IdentifierStart
    = Letter
    | ChineseChar
    | "_"
    ;

IdentifierPart
    = Letter
    | ChineseChar
    | Digit
    | "_"
    ;

(* 标识符长度: 1-64 个 Unicode 码点 *)
(* 标识符不得与保留字冲突（见 §2.5） *)
```

### 7.3 关键字与保留字

```
(* 作为关键字，大小写敏感 *)
AND     OR     NOT    true    false   none

(* 类型关键字 *)
int     float   bool   string   enum   object

(* Frontmatter 元字段 *)
plotflow   title   author   engine   vars

(* 语法标记 — 以下字符串在特定上下文中是关键字 *)
"节点"   "[选项]"   "条件"   "效果"
```

### 7.4 空白处理规则

```ebnf
(* 行内空白 *)
WS
    = Whitespace { Whitespace }
    ;

(* 行间空白 — 空行 *)
EmptyLine
    = { Whitespace } NL
    ;

(* 缩进 *)
Indent
    = "  "               (* 2 空格 *)
    | "\t"               (* 1 Tab *)
    ;
```

空白处理总则：

1. **行首空白**：Chapter/Node 标题行忽略行首空白，OptionLine 忽略行首空白
2. **行间空白**：相邻语法元素之间允许任意数量的空白字符（空格、Tab），但不能包含换行
3. **空行**：除了 Frontmatter 和 Option 子行之间之外，空行被视为块分隔符
4. **缩进**：条件/效果子行必须有恰好 1 级缩进
5. **行尾空白**：所有行尾空白在解析前被去除（trim）

### 7.5 冒号规范

```ebnf
(* 全角冒号（中文语境） *)
FullWidthColon
    = "："                (* U+FF1A *)
    ;

(* 半角冒号（英文/编程语境） *)
HalfWidthColon
    = ":"                 (* U+003A *)
    ;

(* 节点定义中的冒号 — 规范形式为全角 *)
NodeColon
    = FullWidthColon
    | HalfWidthColon      (* 解析器规范化为全角 *)
    ;

(* 条件/效果子行的冒号 — 规范形式为半角 *)
CondColon
    = HalfWidthColon
    | FullWidthColon      (* 解析器规范化为半角 *)
    ;

EffectColon
    = HalfWidthColon
    | FullWidthColon      (* 解析器规范化为半角 *)
    ;
```

### 7.6 注释

```ebnf
Comment
    = "<!--" { ? 任意字符 ? - "-->" } "-->"
    ;

(* 注释可以出现在任何行之间 *)
(* 注释行在解析前被移除（替换为空行） *)
(* 注释不得跨 Frontmatter 边界 *)
```

### 7.7 Token 优先级（最长匹配）

当多个 Token 模式可能在相同位置匹配时，采用**最长匹配**原则：

1. `[选项]` — 作为完整关键字，不会被拆分为 `[` + `选项` + `]`
2. `->` — 作为完整箭头 Token
3. `==` `!=` `>=` `<=` — 双字符运算符优先于单字符
4. `←` — 单字符操作符（U+2190）
5. `节点：` / `条件:` / `效果:` — 作为完整的子行前缀 Token
6. String literals 优先于 identifier（引号开启即进入字符串模式）

---

## 8. 歧义消解规则

### 8.1 `条件:` 消歧：子行 vs 正文

**问题**：正文中可能出现以 `条件:` 开头的行，与选项子行的 `条件:` 冲突。

**消歧规则**：
```
条件: 子行判定 = 同时满足以下所有条件:
  1. 前一行是 OptionLine 或另一个子行（条件/效果）
  2. 当前行以 Indent 开头，后跟 "条件:" 或 "条件："
  3. 两个条件/效果子行之间无正文行（仅允许空行）

凡不满足上述全部条件的 "条件:" 行，均视为正文。
```

**示例**：
```markdown
[选项] 战斗 -> 节点：战斗结果
  条件: ($力量>=5)           ← 子行（紧跟 OptionLine + 有缩进）

条件: 这是正文中的描述文字     ← 正文（不以缩进开头，或前方无 OptionLine）
```

### 8.2 `效果:` 消歧：子行 vs 正文

**消歧规则**：与 `条件:` 完全相同。

```
效果: 子行判定 = 同时满足以下所有条件:
  1. 前一行是 OptionLine 或另一个子行（条件/效果）
  2. 当前行以 Indent 开头，后跟 "效果:" 或 "效果："
  3. 两个条件/效果子行之间无正文行（仅允许空行）
```

### 8.3 `->` 消歧：目标引用 vs 描述中的箭头

**问题**：OptionText 中可能包含 `->` 字符串（如"从左->右"），与目标引用语法冲突。

**消歧规则**：
```
"->" 作为目标引用 = 同时满足:
  1. 出现在 [选项] 行中
  2. 后跟（可选的空白 +）"节点" + NodeColon + 非空文本

凡不满足上述条件的 "->"，视为 OptionText 的一部分。
```

**优先贪心匹配**：从行尾向前扫描，最后一个满足条件的 `->` 被视为目标引用分隔符。

**示例**：
```
[选项] A -> B 的钥匙 -> 节点：密室
                    ↑
                    这个 -> 是目标引用（后跟 节点：密室）
           ↑
           这个 -> 是描述文本的一部分（后跟 "B 的钥匙"，不是 "节点："）
```

### 8.4 `节点：` 消歧：节点定义 vs 正文中的引用

**问题**：正文中可能写"详见节点：狼穴"。

**消歧规则**：
```
"节点：" 作为 NodeHeading = 同时满足:
  1. 在行首（可含前导空白），前有 "## " 或 "# "
  2. 行的主要结构是 "## 节点：xxx"

"节点：" 作为 TargetRef 的一部分 = 同时满足:
  1. 出现在 OptionLine 中 "->" 之后
  2. 后跟目标节点名

其他位置的 "节点：" = 正文。
```

### 8.5 章节名含 `/` 的消歧

**规则**：章节名（ChapterTitle）不得包含 `/`（U+002F 正斜杠）。

```
合法: # 第一章：村庄
合法: # Chapter 1 - Village
非法: # 第一章/村庄        ← "/" 与跨章节引用语法冲突
```

### 8.6 节点名含特殊字符

**规则**：节点名（NodeName）不得包含以下字符：

```
禁止字符: "/" (U+002F)    ← 与跨章节路径语法冲突
         "\" (U+005C)    ← 与转义语法冲突
```

节点名可以包含中文标点、空格、括号等。

### 8.7 `---` 消歧：Frontmatter 分隔符 vs 节点分隔符 vs 水平分隔线

**位置语义**：
```
位置 0（文件最开头）     → Frontmatter 开始/结束标记
位置 1（两个 NodeBlock 之间） → 节点分隔符（可选，无语法含义）
位置 2（NodeBlock 内部） → 视为正文中的水平分隔线
```

---

## 9. 完整解析示例

### 9.1 源文本

基于 PRD §4.6 的完整示例，进行逐 Token 标注：

```markdown
---
plotflow: "0.1"
title: "暗夜森林·试玩版"
author: "PlotFlow Team"
engine: "godot"
vars:
  好感度: int
  金币: int
  武器: enum[无, 剑, 弓, 杖]
  拥有钥匙: bool
  角色状态: object{生命: int, 魔力: int}
---

# 第一章：村庄

## 节点：森林入口

你站在幽暗森林的边缘，两条小径延伸向前。
夜幕即将降临，你必须做出选择。

[选项] 走向左边的狼嚎声 -> 节点：狼穴
  效果: (好感度+1)

[选项] 探索右边的古井 -> 节点：古井

[选项] 返回村庄 -> 节点：村庄广场

---

## 节点：狼穴

洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。
一头巨狼挡在路前。

[选项] 战斗 -> 节点：战斗结果
  效果: (角色状态.生命-10)

[选项] 投喂食物 -> 节点：驯服狼
  条件: ($金币>=10) AND ($武器!='无')
  效果: (金币-10, 好感度+5)

[选项] 悄悄退后 -> 节点：森林入口

---

## 节点：古井

井口长满青苔，井水清澈见底。
井壁上刻着古老的符文。

[选项] 喝井水 -> 节点：井水效果
  效果: (角色状态.魔力+5)

[选项] 调查符文 -> 节点：符文秘密
  条件: ($角色状态.魔力>=10)
  效果: (拥有钥匙=true)

[选项] 离开 -> 节点：森林入口
```

### 9.2 Token 标注

以下按行号标注每个 Token 对应的语法规则：

```
行 1:  "---"                       → Frontmatter 开始标记
行 2:  "plotflow"                  → PlotFlowVersion.key
       ":"                         → YAML 冒号分隔符
       " "                         → WS
       '"0.1"'                     → StringValue
行 3:  "title"                     → TitleDecl.key
       ":"                         → YAML 冒号
       " "
       '"暗夜森林·试玩版"'          → StringValue
行 4:  "author"                    → AuthorDecl.key
       ":"
       " "
       '"PlotFlow Team"'           → StringValue
行 5:  "engine"                    → EngineDecl.key
       ":"
       " "
       "godot"                     → EngineValue
行 6:  "vars"                      → VariableDeclarations.key
       ":"
行 7:  "  "                        → Indent (Level 1)
       "好感度"                     → VarName (identifier, 中文)
       ":"
       " "
       "int"                       → PrimitiveType
行 8:  "  "                        → Indent (Level 1)
       "金币"                       → VarName
       ":"
       " "
       "int"                       → PrimitiveType
行 9:  "  "                        → Indent (Level 1)
       "武器"                       → VarName
       ":"
       " "
       "enum"                      → EnumType.keyword
       "["                         → EnumType.open
       "无"                         → EnumValue (identifier)
       ","                         → EnumType 分隔符
       " "                         → WS
       "剑"                         → EnumValue
       ","                         → EnumType 分隔符
       " "                         → WS
       "弓"                         → EnumValue
       ","                         → EnumType 分隔符
       " "                         → WS
       "杖"                         → EnumValue
       "]"                         → EnumType.close
行 10: "  "                        → Indent (Level 1)
       "拥有钥匙"                    → VarName
       ":"
       " "
       "bool"                      → PrimitiveType
行 11: "  "                        → Indent (Level 1)
       "角色状态"                    → VarName
       ":"
       " "
       "object"                    → ObjectType.keyword
       "{"                         → ObjectType.open
       "生命"                       → ObjectFieldDecl.VarName
       ":"
       " "
       "int"                       → ObjectFieldDecl.TypeSpec
       ","
       " "
       "魔力"                       → ObjectFieldDecl.VarName
       ":"
       " "
       "int"                       → ObjectFieldDecl.TypeSpec
       "}"                         → ObjectType.close
行 12: "---"                       → Frontmatter 结束标记
行 13: (空行)                       → NL
行 14: "# 第一章：村庄"              → ChapterHeading
       "#"                         → 章节前缀
       " "                         → WS
       "第一章：村庄"                → ChapterTitle
行 15: (空行)                       → NL
行 16: "## 节点：森林入口"           → NodeHeading
       "##"                        → H2 前缀
       " "                         → WS
       "节点"                       → 关键字
       "："                        → NodeColon (全角)
       "森林入口"                    → NodeName
行 17: (空行)                       → NL
行 18: "你站在幽暗森林的边缘，两条小径延伸向前。" → Paragraph (BodyLine)
行 19: "夜幕即将降临，你必须做出选择。"         → Paragraph (BodyLine)
行 20: (空行)                       → NL
行 21: "[选项] 走向左边的狼嚎声 -> 节点：狼穴" → OptionLine
       "[选项]"                     → 选项关键字
       " "                         → WS
       "走向左边的狼嚎声"             → OptionText
       " "                         → WS
       "->"                        → 箭头 Token
       " "                         → WS
       "节点"                       → TargetRef 关键字
       "："                        → NodeColon
       "狼穴"                       → TargetNodeName
行 22: "  效果: (好感度+1)"          → EffectLine
       "  "                        → Indent (2 空格)
       "效果"                       → EffectLine 关键字
       ":"                         → EffectColon (半角)
       " "                         → WS
       "("                         → 效果括号开
       "好感度"                      → LValue (VarName)
       "+"                         → Increment 操作符
       "1"                         → IntLiteral
       ")"                         → 效果括号闭
行 23: (空行)                       → NL
行 24: "[选项] 探索右边的古井 -> 节点：古井" → OptionLine (无子行)
       "[选项]"                     → 选项关键字
       " "                         → WS
       "探索右边的古井"              → OptionText
       " "                         → WS
       "->"                        → 箭头
       " "                         → WS
       "节点"                       → TargetRef 关键字
       "："                        → NodeColon
       "古井"                       → TargetNodeName
行 25: (空行)                       → NL
行 26: "[选项] 返回村庄 -> 节点：村庄广场" → OptionLine (无子行)
       "[选项]"                     → 选项关键字
       " "                         → WS
       "返回村庄"                    → OptionText
       " "                         → WS
       "->"                        → 箭头
       " "                         → WS
       "节点"                       → TargetRef 关键字
       "："                        → NodeColon
       "村庄广场"                    → TargetNodeName

行 27: (空行)                       → NL
行 28: "---"                       → Separator (节点间分隔符)
行 29: (空行)                       → NL
行 30: "## 节点：狼穴"              → NodeHeading
       "##"                        → H2 前缀
       " "                         → WS
       "节点"                       → 关键字
       "："                        → NodeColon
       "狼穴"                       → NodeName

行 31-33: (正文, 略)
行 34: "[选项] 战斗 -> 节点：战斗结果" → OptionLine
行 35: "  效果: (角色状态.生命-10)"   → EffectLine
       "  "                        → Indent
       "效果"                       → 关键字
       ":"                         → EffectColon
       " "                         → WS
       "("                         → 效果括号开
       "角色状态"                     → VarName (LValue 第1段)
       "."                         → FieldAccess 点
       "生命"                        → VarName (LValue 第2段)
       "-"                         → Decrement 操作符
       "10"                        → IntLiteral
       ")"                         → 效果括号闭

行 37-39: "[选项] 投喂食物 -> 节点：驯服狼" → OptionLine
行 38: "  条件: ($金币>=10) AND ($武器!='无')" → ConditionLine
       "  "                        → Indent
       "条件"                       → 关键字
       ":"                         → CondColon
       " "                         → WS
       "("                         → PrimaryExpression 开括号
       "$金币"                       → FieldAccess ($ + VarName)
       ">="                        → CompOp
       "10"                        → IntLiteral
       ")"                         → 闭括号
       " "                         → WS
       "AND"                       → AndExpression 关键字
       " "                         → WS
       "("                         → PrimaryExpression 开括号
       "$武器"                       → FieldAccess
       "!="                        → CompOp
       "'无'"                       → StringLiteral
       ")"                         → 闭括号
行 39: "  效果: (金币-10, 好感度+5)" → EffectLine
       "  "                        → Indent
       "效果"                       → 关键字
       ":"                         → EffectColon
       " "                         → WS
       "("                         → 效果括号开
       "金币"                        → LValue
       "-"                         → Decrement
       "10"                        → IntLiteral
       ","                         → 分隔符
       " "                         → WS
       "好感度"                      → LValue
       "+"                         → Increment
       "5"                         → IntLiteral
       ")"                         → 效果括号闭

行 41: "[选项] 悄悄退后 -> 节点：森林入口" → OptionLine (无子行, 指向已存在节点)
行 44-53: (古井节点, 结构同前, 略)
```

### 9.3 AST 输出

以上解析产生的抽象语法树（简化表示）：

```
Story
├── Meta
│   ├── plotflow: "0.1"
│   ├── title: "暗夜森林·试玩版"
│   ├── author: "PlotFlow Team"
│   ├── engine: "godot"
│   └── variables:
│       ├── 好感度: { type: "int", default: 0 }
│       ├── 金币:   { type: "int", default: 0 }
│       ├── 武器:   { type: "enum", values: ["无","剑","弓","杖"], default: "无" }
│       ├── 拥有钥匙: { type: "bool", default: false }
│       └── 角色状态: {
│             type: "object",
│             fields: [
│               { 生命: { type: "int", default: 0 } },
│               { 魔力: { type: "int", default: 0 } }
│             ]
│           }
│
├── chapters:
│   └── Chapter "第一章：村庄"
│       ├── Node "森林入口" (root)
│       │   ├── body: [
│       │   │   "你站在幽暗森林的边缘，两条小径延伸向前。",
│       │   │   "夜幕即将降临，你必须做出选择。"
│       │   │ ]
│       │   ├── options:
│       │   │   ├── Option[0]
│       │   │   │   ├── text: "走向左边的狼嚎声"
│       │   │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E7%8B%BC%E7%A9%B4"
│       │   │   │   ├── condition: null
│       │   │   │   └── effects: [
│       │   │   │       { var: "好感度", op: "add", value: 1 }
│       │   │   │     ]
│       │   │   ├── Option[1]
│       │   │   │   ├── text: "探索右边的古井"
│       │   │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E5%8F%A4%E4%BA%95"
│       │   │   │   ├── condition: null
│       │   │   │   └── effects: []
│       │   │   └── Option[2]
│       │   │       ├── text: "返回村庄"
│       │   │       ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E6%9D%91%E5%BA%84%E5%B9%BF%E5%9C%BA"
│       │   │       ├── condition: null
│       │   │       └── effects: []
│       │
│       ├── Node "狼穴"
│       │   ├── body: [
│       │   │   "洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。",
│       │   │   "一头巨狼挡在路前。"
│       │   │ ]
│       │   ├── options:
│       │   │   ├── Option[0]
│       │   │   │   ├── text: "战斗"
│       │   │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E6%88%98%E6%96%97%E7%BB%93%E6%9E%9C"
│       │   │   │   ├── condition: null
│       │   │   │   └── effects: [
│       │   │   │       { var: "角色状态", field: "生命", op: "subtract", value: 10 }
│       │   │   │     ]
│       │   │   ├── Option[1]
│       │   │   │   ├── text: "投喂食物"
│       │   │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E9%A9%AF%E6%9C%8D%E7%8B%BC"
│       │   │   │   ├── condition: {
│       │   │   │   │     type: "logical_and",
│       │   │   │   │     left:  { type: "comparison", left: { type: "variable", name: "金币" }, operator: ">=", right: { type: "literal", value: 10 } },
│       │   │   │   │     right: { type: "comparison", left: { type: "variable", name: "武器" }, operator: "!=", right: { type: "literal", value: "无" } }
│       │   │   │   │   }
│       │   │   │   └── effects: [
│       │   │   │       { var: "金币",   op: "subtract", value: 10 },
│       │   │   │       { var: "好感度", op: "add", value: 5 }
│       │   │   │     ]
│       │   │   └── Option[2]
│       │   │       ├── text: "悄悄退后"
│       │   │       ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E6%A3%AE%E6%9E%97%E5%85%A5%E5%8F%A3"
│       │   │       ├── condition: null
│       │   │       └── effects: []
│       │
│       └── Node "古井"
│           ├── body: [
│           │   "井口长满青苔，井水清澈见底。",
│           │   "井壁上刻着古老的符文。"
│           │ ]
│           ├── options:
│           │   ├── Option[0]
│           │   │   ├── text: "喝井水"
│           │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E4%BA%95%E6%B0%B4%E6%95%88%E6%9E%9C"
│           │   │   ├── condition: null
│           │   │   └── effects: [
│           │   │       { var: "角色状态", field: "魔力", op: "add", value: 5 }
│           │   │     ]
│           │   ├── Option[1]
│           │   │   ├── text: "调查符文"
│           │   │   ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E7%AC%A6%E6%96%87%E7%A7%98%E5%AF%86"
│           │   │   ├── condition: {
│           │   │   │     type: "comparison",
│           │   │   │     left: { type: "variable", name: "角色状态.魔力" },
│           │   │   │     operator: ">=", right: { type: "literal", value: 10 }
│           │   │   │   }
│           │   │   └── effects: [
│           │   │       { var: "拥有钥匙", op: "set", value: true }
│           │   │     ]
│           │   └── Option[2]
│           │       ├── text: "离开"
│           │       ├── target: "%E7%AC%AC%E4%B8%80%E7%AB%A0/%E6%A3%AE%E6%9E%97%E5%85%A5%E5%8F%A3"
│           │       ├── condition: null
│           │       └── effects: []
```

---

## 10. 边界情况定义

### 10.1 有效边界情况

| 编号 | 情况 | 预期行为 | AST 状态 |
|------|------|---------|---------|
| BC1 | **空文件**（0 字节） | 解析成功 | `Story { meta: null, chapters: [] }` |
| BC2 | **仅 Frontmatter**（无章节无节点） | 解析成功 | `Story { meta: {...}, chapters: [] }` |
| BC3 | **仅 Frontmatter + 章节标题但无节点** | 解析成功 | Chapter 存在但 nodes 为空数组 |
| BC4 | **仅正文无 Frontmatter**（无变量声明） | 解析成功 | `meta.variables = {}`（空变量集） |
| BC5 | **节点无选项**（死胡同） | 解析成功 + 🟡 W002 | Node 存在，options 为空数组 |
| BC6 | **选项无条件和效果**（默认选项） | 解析成功 | Option 存在，condition=null, effects=[] |
| BC7 | **选项仅有效果无条件** | 解析成功 | condition=null |
| BC8 | **选项仅有条件无效果** | 解析成功 | effects=[] |
| BC9 | **Frontmatter 中无 vars 字段** | 解析成功 | variables 为空 |
| BC10 | **章节标题无 `#` 前缀**（纯文本行） | 视为正文，不属于任何 Chapter | 节点归属于隐式 "default" Chapter |
| BC11 | **多个连续空行** | 折叠为单个空行 | 不影响 AST |
| BC12 | **`### 选项区` H3 标题** | 视为正文（不产生结构） | 属于 Node body 的一部分 |
| BC13 | **Frontmatter 末尾多余空行** | 忽略 | 不影响解析 |

### 10.2 错误边界情况

| 编号 | 情况 | 预期行为 | 错误 |
|------|------|---------|------|
| BC14 | **选项无 `->`（无目标）** | 解析失败 | 🔴 E005 |
| BC15 | **`->` 后无有效目标**（如 `-> 节点：` 后为空） | 解析失败 | 🔴 E005 |
| BC16 | **目标节点不存在**（如指向未定义的节点） | 解析成功但标记错误 | 🔴 E001 |
| BC17 | **条件引用了未声明的变量** | 解析成功但标记错误 | 🔴 E002 |
| BC18 | **效果引用了未声明的变量** | 解析成功但标记错误 | 🔴 E002 |
| BC19 | **枚举赋值非法值** | 解析成功但标记错误 | 🔴 E003 |
| BC20 | **效果类型不匹配**（如 `好感度='abc'`，好感度为 int） | 解析成功但标记错误 | 🔴 E004 |
| BC21 | **Object 嵌套超过 3 层** | 解析失败 | 🔴 E006 |
| BC22 | **两个节点使用相同的 FullID** | 解析成功但标记错误 | 🔴 E007 |
| BC23 | **同一变量在 Frontmatter 中声明两次** | 解析成功但标记错误 | 🔴 E008 |
| BC24 | **条件表达式括号不匹配** | 解析失败 | 🔴 E005 |
| BC25 | **条件/效果子行缩进不正确**（如 4 空格或混合） | 视为正文 | 该子行不被解析 |
| BC26 | **Frontmatter 语法错误**（如 YAML 非法缩进） | 解析失败，整个文件无法加载 | 🔴 E005 |

### 10.3 长度限制

| 元素 | 最大长度 | 超限行为 |
|------|---------|---------|
| 变量名 | 64 个 Unicode 码点 | 🔴 E005 |
| 节点名 | 128 个 Unicode 码点 | 🔴 E005 |
| 章节标题 | 256 个 Unicode 码点 | 🟡 W006（截断） |
| OptionText | 1024 个 Unicode 码点 | 🟡 警告（截断） |
| 条件表达式 | 2048 个 Unicode 码点 | 🔴 E005 |
| Body 单行 | 10000 个 Unicode 码点 | 🟡 警告 |
| Frontmatter 总大小 | 64 KB | 🔴 E005 |
| 单文件节点数 | 无硬限制（建议 ≤ 500） | 性能警告 |

### 10.4 Unicode 规范化

解析器在解析前对源文本执行 **NFC (Normalization Form C)** 规范化。这确保了：

- 组合字符（如 é = e + ́） 与其预组合形式（é = U+00E9）等价
- 中文变体选择器不影响标识符匹配
- 全角/半角字符按 §7.5 规则额外规范化

### 10.5 容错解析策略

解析器采用 **最大努力（best-effort）** 策略：

1. 遇到语法错误时，记录错误但不中断解析
2. 跳过一个 Node 的解析不影响后续 Node
3. 条件表达式解析失败时，该条件被记为 `{ type: "parse_error", raw: "..." }`
4. 效果操作解析失败时，该操作被跳过，其余操作正常解析
5. 只有在 Frontmatter 解析失败时，才整体失败（因为缺少变量类型信息会导致后续类型检查全错）

---

## 附录 A：产生式索引

| 行号 | 产生式 | 定义位置 |
|------|--------|---------|
| 1 | `Story` | §1.1 |
| 2 | `Frontmatter` | §1.1, §2.1 |
| 3 | `ChapterList` | §1.1 |
| 4 | `Chapter` | §1.1 |
| 5 | `NodeList` | §1.1 |
| 6 | `NodeBlock` | §1.1 |
| 7 | `OptionList` | §1.1 |
| 8 | `Option` | §1.1 |
| 9 | `OptionLine` | §4.1 |
| 10 | `TargetRef` | §4.1 |
| 11 | `ConditionLine` | §4.3 |
| 12 | `ConditionExpression` | §5.1 |
| 13 | `OrExpression` | §5.1 |
| 14 | `AndExpression` | §5.1 |
| 15 | `NotExpression` | §5.1 |
| 16 | `PrimaryExpression` | §5.1 |
| 17 | `ComparisonExpression` | §5.1 |
| 18 | `FieldAccess` | §5.1 |
| 19 | `EffectLine` | §4.4 |
| 20 | `EffectList` | §6.1 |
| 21 | `EffectOp` | §6.2 |
| 22 | `Assignment` | §6.2 |
| 23 | `Increment` | §6.2 |
| 24 | `Decrement` | §6.2 |
| 25 | `Append` | §6.2 |
| 26 | `Literal` | §5.3 |
| 27 | `VariableDecl` | §2.2 |
| 28 | `TypeSpec` | §2.2 |
| 29 | `PrimitiveType` | §2.2 |
| 30 | `EnumType` | §2.2 |
| 31 | `ObjectType` | §2.2 |

## 附录 B：错误代码映射

| 错误码 | 名称 | 定义位置 | 级别 |
|--------|------|---------|------|
| E001 | 未定义目标节点 | §3.3, §4.2, §10.2 BC16 | 🔴 Error |
| E002 | 未声明变量 | §5.4, §10.2 BC17-18 | 🔴 Error |
| E003 | 枚举值非法 | §6.4, §10.2 BC19 | 🔴 Error |
| E004 | 类型不匹配 | §6.4, §10.2 BC20 | 🔴 Error |
| E005 | 语法解析失败 | §4.5, §4.6, §5.1, §10.2 BC14-15, BC24-26 | 🔴 Error |
| E006 | 嵌套深度超限 | §2.4, §10.2 BC21 | 🔴 Error |
| E007 | 节点ID重名 | §3.3, §10.2 BC22 | 🔴 Error |
| E008 | 变量重复声明 | §2.5, §10.2 BC23 | 🔴 Error |
| W001 | 孤立节点 | — | 🟡 Warning |
| W002 | 死胡同节点 | §10.1 BC5 | 🟡 Warning |
| W003 | 未使用变量 | — | 🟡 Warning |
| W004 | 重复选项描述 | §4.2 | 🟡 Warning |
| W005 | 空描述节点 | §3.3 | 🟡 Warning |
| W006 | 格式不规范 | §3.3, §10.3 | 🟡 Warning |
| W007 | 可能无限循环 | §12.3 | 🟡 Warning |
| I001 | 可能卡关 | — | 🔵 Info |
| I002 | 描述过短 | — | 🔵 Info |
| I003 | 无章节归属 | §10.1 BC10 | 🔵 Info |

---

---

## 12. V0.3 Flow Exit Addendum

This addendum records the V0.3 node-level flow exit syntax added for Graph Lab flow nodes.

### 12.1 `下一步` node-level exit

```ebnf
NextLine
    = "下一步" NextColon WS TargetRef NL
    ;

NextColon
    = ":"
    | "："
    ;

NextEffectLine
    = Indent "效果" EffectColon WS "(" EffectList ")" NL
    ;
```

Rules:

- `下一步: 节点：目标节点名` is parsed as a node-level default exit, separate from `[选项]`.
- `下一步: 章节/节点：目标节点名` is accepted for cross-chapter targets.
- An immediately adjacent indented `效果:` line belongs to the `下一步` exit.
- A node with at least one `[选项]` treats those options as explicit exits; Graph Lab hides the default node-level handle in that state.
- A malformed `下一步` line is kept as normal body text and produces `E005`; it must not consume a following `效果:` line.

### 12.2 Export compatibility

The canonical `.mdstory` source stores `下一步` as a node-level exit. JSON Schema 0.2 projects `下一步` to a synthetic unconditional option during JSON export:

- `text`: `下一步`
- `index`: after existing options
- `conditions`: `null`
- `sideEffects`: parsed from the adjacent `效果:` line
- `targetChapterId`: explicit chapter ID or `null`
- `targetNodeId`: target node ID or `null`
- `targetFullId`: canonical opaque FullID or `null`

No separate `nextTarget` field is emitted; historical 0.1 readers continue to receive the synthetic option shape they already understand.

### 12.3 W007 closed-cycle warning

`W007` reports a possible infinite loop when the graph contains a closed strongly connected component with no outgoing edge to a node outside the component. The adjacency graph includes both `[选项]` edges and `下一步` edges. Edges with unresolved targets are skipped by W007 so they remain covered by `E001`.

`W002` and `I001` must also treat `下一步` as an exit. A node with no `[选项]` but a valid `下一步` is not a dead end. A node with conditional options plus a valid unconditional `下一步` has a fallback path and should not trigger the “all choices are conditional” suggestion.

### 12.4 Graph Lab chapter projection requirements

These requirements are UI/source projection rules, not additional `.mdstory` syntax:

- Graph Lab must present H1 chapters as visible top-level chapter tabs.
- Creating a chapter in Graph Lab must immediately create a visible, selected tab and a source-backed chapter block.
- Graph Lab Source Drawer edits are chapter slices mapped back to the full `.mdstory` by source offsets; split text mode remains the full-file editor.
- Chapter tab visibility is a release-facing UX requirement and must be covered by screenshot-based E2E assertions, not only DOM existence checks.

*本文档是 PlotFlow V0.1/V0.3 解析器的权威语法参考。任何实现差异以本文档为准。*
