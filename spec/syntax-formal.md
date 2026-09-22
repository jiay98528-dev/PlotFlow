# .mdstory 源文本语法

> 文档导航：[故事数据与引擎索引](../doc/indexes/data.md) · [总索引](../doc/INDEX.md)

适用于当前 [@plotflow/core 解析器](../packages/core/src/parser/parser.ts)。源格式版本为 0.1；软件版本和 JSON Schema 版本分别维护。本文件描述当前可写入的语法，不把早期 EBNF 草案当作另一套解析实现。

## 1. 文件结构

### 1.1 Story

文件由可选 YAML Frontmatter、章节标题、节点正文、选项及其条件/效果组成。解析器允许空文件、仅 Frontmatter 或未完成的故事，以便用户继续编辑；“能解析”不等于“能导出”。结构不足会由诊断与导出检查指出。

### 1.2 编码与行号

使用 UTF-8，扩展名为小写 .mdstory。解析与编辑支持 LF/CRLF；写回时保留既有换行风格。诊断使用从 1 开始的源文件行列，不能把章节切片行号当成全文行号。

## 2. YAML Frontmatter

文件开头的 Frontmatter 用独立的 --- 行包围。正文中的后续 --- 不是新的 Frontmatter。没有 Frontmatter 时可继续解析，元信息与变量使用现有恢复默认值。

~~~yaml
---
plotflow: "0.1"
title: "山路"
author: "作者"
engine: "godot"
vars:
  金币: int
  拥有钥匙: bool
  路线: enum[山路, 河道]
  警戒值:
    type: int
    default: 0
    scope: chapter
    chapter: 第一章
---
~~~

### 2.1 元信息

plotflow 为系统管理的源格式版本。title、author 是故事元信息；engine 允许 generic、godot、unity、unreal。JSON 导出将 generic 映射为 none。

### 2.2 变量

vars 支持 int、float、bool、string、enum、object。可用简写类型或包含 type/default/description 的结构化声明；enum 结构使用 values，object 结构使用 fields。字段结构与解析细节见 [frontmatter.ts](../packages/core/src/parser/frontmatter.ts)。

章节变量使用 scope: chapter 和 chapter: 真实章节名。global 或省略 scope 时不能携带 chapter；嵌套字段继承顶层作用域，不能单独声明作用域。

### 2.3 图布局

可选 layout.graph 包含 version: 1 和 nodes 数组，每项为 id、x、y。id 使用规范 FullID。布局仅控制画布坐标，不改变剧情语义；旧布局读取迁移规则见 [ADR-013](../doc/adr/ADR-013-fullid-schema-02.md)。打开文件本身不能静默重写它。

## 3. 章节与节点

章节使用一级标题，例如“# 第一章”；# 与标题之间必须有空格或 Tab。标题内容就是章节名，不需要加“章节：”前缀。

节点使用二级标题，例如“## 节点：起点”，中文或英文冒号均可。标题不能为空，节点名不能包含路径分隔符 / 或反斜杠。显式章节不能使用内部保留名 _anonymous。

没有显式章节的节点进入匿名章节。节点重复、目标不明等由诊断指出；原始文本和可恢复的内容必须保留。命名章节 FullID 使用编码后的章节和节点组件，以单个斜杠连接，禁止沿用旧的连字符拼接。

节点正文保留为文本行。节点级“下一步”写法如下，紧邻的缩进效果行属于该出口：

~~~text
下一步: 第二章/节点：终点
  效果: (金币+1)
~~~

## 4. 选项语法

~~~text
[选项] 进入山洞 -> 节点：洞口
  条件: $拥有钥匙 == true
  效果: (金币-1)
[选项] 乘船离开 -> 第二章/节点：河岸
~~~

[选项] 与描述之间需要空格或 Tab。目标用 -> 引出；同章目标为“节点：名称”，跨章为“章节名/节点：名称”。目标暂缺时可以继续编辑，诊断决定是否满足导出条件。

条件和效果子行必须缩进，支持中文或英文冒号，二者顺序可互换。深缩进不表示无限层级选项树；实际解析与恢复规则见 [options.ts](../packages/core/src/parser/options.ts)。

## 5. 条件表达式

- 变量引用使用 $名称，对象字段使用 $对象.字段。
- 比较操作符为 ==、!=、>、<、>=、<=。
- 用 AND、OR、NOT 和括号组合；NOT 高于 AND，AND 高于 OR。
- 两侧均保留明确的变量/字面量身份，不假定变量只能出现在左侧。
- 字符串使用引号，布尔值使用 true/false，数字按变量类型检查。

语法与词法边界见 [conditions.ts](../packages/core/src/parser/conditions.ts)，JSON AST 形状见 [JSON 合同](json-schema.md)。

## 6. 变量操作（效果）

### 6.1 操作与分隔

多个操作用逗号分隔，效果列表可包在一对外括号中。操作符 =、+、-、← 分别映射为 set、add、subtract、append。效果的变量前缀 $ 可省略；对象字段仍用点路径。

### 6.2 LValue 与类型

操作目标必须是已声明变量或有效对象字段，右侧值必须与类型兼容。字符串内的标点不应被误拆成多个操作；实际处理见 [effects.ts](../packages/core/src/parser/effects.ts)。

## 7. 当前输入限制

| 输入 | 当前限制与处理 |
|---|---|
| Frontmatter | 64 KiB UTF-8 字节，不包含故事正文 |
| object 字段 | 最多三层嵌套 |
| 条件表达式 | 2048 个 Unicode 码点，逻辑嵌套最多三层 |
| 效果表达式 | 2048 个 Unicode 码点 |
| 选项描述 | 1024 个 Unicode 码点，过长给出诊断并截断解析值 |

限制变化以对应解析器常量和回归用例为依据，不能只改 UI 提示或本表。

## 8. 解析与诊断边界

Parser 负责语法与可恢复 AST，Validator 负责引用、变量和结构约束。当前代码定义 E001—E009、W001—W007、I001—I003，详见 [diagnostic.ts](../packages/core/src/types/diagnostic.ts)。Error 级诊断阻止导出；提示数量不能代替实际故事内容检查。

Graph Lab GUI、Source Drawer 与 Split 共同遵循同一语法。保存、导出、模式切换和故事替换需先协调未提交草稿；语法恢复不能静默丢弃原文。

## 9. 完整示例

使用 [Godot 示例故事](../templates/godot-example/story.mdstory) 或 [测试 fixtures](../tests/fixtures)。示例中的模板变量在创建故事时替换；引擎加载方式见 [Godot 示例说明](../templates/godot-example/README.md)。

## 10. 维护范围

修改语法时同时检查 parser、validator、图形编辑文本写回、Monaco tokenizer、导出与引擎消费。只修改文档不改变软件语法。本轮整理不新增语法，也不把历史设计中的未实现能力描述为现有功能。
