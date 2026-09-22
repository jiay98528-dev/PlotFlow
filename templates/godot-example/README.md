# Godot 故事加载示例

> 文档导航：[故事数据与引擎索引](../../doc/indexes/data.md) · [总索引](../../doc/INDEX.md)

这个目录包含一个最小 Godot 项目、story.mdstory 和 scripts/story_player.gd。当前脚本只展示读取 JSON 到 Dictionary 的入口，不包含完整对话 UI、选项点击、存档或可直接试玩的场景。

## 使用

1. 在 Fablevia 中打开 [story.mdstory](story.mdstory)，填写模板中的 title/author，导出 JSON。
2. 用 Godot 打开 [project.godot](project.godot)，创建自己的 Node 场景并挂载 [story_player.gd](scripts/story_player.gd)。
3. 将导出 JSON 加入 Godot 项目，设置脚本的 story_json_path，再运行该场景。

需要遍历节点、检查条件和应用变量效果时，使用仓库的 [Godot 运行时](../../addons/plotflow/runtime/StoryLoader.gd)，并遵循 [JSON 合同](../../spec/json-schema.md)。这里只维护加载示例，不把后续完整引擎演示描述为已实现。
