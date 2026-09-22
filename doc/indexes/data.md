# 故事数据与引擎索引

> 第二级索引 · [返回总索引](../INDEX.md)

查看时机：修改语法、数据结构、导出、节点身份或引擎接入时。下表全部条目为第三级正文；仅按本次任务读取。

| 第三级文档 | 唯一维护职责 | 具体查看时机 |
|---|---|---|
| [当前 .mdstory 语法](../../spec/syntax-formal.md) | 当前 .mdstory 语法 | 修改 parser、tokenizer、文本写回或语法帮助 |
| [JSON 0.2 导出合同](../../spec/json-schema.md) | JSON 0.2 导出合同 | 修改序列化、校验器或引擎消费者 |
| [FullID、章节变量与兼容决策](../../doc/adr/ADR-013-fullid-schema-02.md) | FullID、章节变量与兼容决策 | 修改标识、布局迁移或变量作用域 |
| [Godot 加载示例边界](../../templates/godot-example/README.md) | Godot 加载示例边界 | 使用模板或制作真实引擎演示 |
| [Unreal 蓝图接口设计参考](../../plugins/unreal/BPI_PlotFlowReader.uasset.md) | Unreal 蓝图接口设计参考 | 在 Unreal 项目中创建接口或接入数据 |

维护本分类时同步文件路径与查阅时机。实际版本、运行结果不在索引复制，分别以 package.json 和 spec/progress.md 为准。
