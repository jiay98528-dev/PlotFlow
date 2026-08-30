# 证据包 2：Graph-first 连续主旅程

在同一段录制中，仅使用已安装 PlotFlow 的可见 GUI 和 Windows 原生文件对话框：

1. 首次启动，新建故事并确认默认进入 Graph Lab，Split 与 Graph Lab 顶栏同级。
2. 创建两章、六节点、同名跨章节点、普通/跨章选项、节点级下一步、六类变量、chapter scope、三层 object、AND/OR/NOT 与 literal-left 条件。
3. 制造 Error，验证 JSON/HTML/TXT 均阻断且不弹保存框；仅用 GUI 修复。
4. 保存 `.mdstory`，关闭、重启、Continue；确认内容完整且历史为空。
5. 新编辑后验证 Undo/Redo，再导出 JSON/HTML/TXT。
6. 磁盘 JSON 必须通过 Schema 0.2；TXT 重新打开完整。HTML 只确认生成，本包不切换浏览器。

停止点：保存失败、数据丢失、诊断绕过、Schema 不合法或被迫进入 Split 均为 `FAIL`。原生对话框、录屏、Computer Use 中断为 `BLOCKED`，在 `resumeFrom` 写最后完成步骤。
