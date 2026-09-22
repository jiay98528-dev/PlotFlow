# Fablevia 维护要点

> 文档导航：[工程规则与架构索引](../doc/indexes/engineering.md) · [总索引](../doc/INDEX.md)

只保留当前代码需要遵循的缺陷教训，历史逐轮报告从 Git 查询。具体回归以相邻测试为准。

- 保存与异步打开回调必须绑定 storySessionId、路径和内容 revision，旧会话结果不能覆盖新故事。
- Source Drawer 隐藏不等于丢弃草稿；保存、导出、模式切换和故事替换先经过 sourceDraftCoordinator。
- Inspector 提交前若草稿刷新改变 AST，应按稳定 FullID / 选项身份重新解析目标；拒绝提交时保留用户输入。
- Graph 拖拽和连线结束必须先释放交互租约再提交故事事务，避免合法修改被当成并发交互拒绝。
- 条件弹窗、下拉菜单和节点菜单共用键盘焦点域，不能让背景删除/撤销快捷键穿透。
- 导出须取得同一故事快照，并验证真实写入结果；用户取消或空文件不能显示成功。
- 解析异常应清除过期投影而保留文本；所有格式导出共用 Error 诊断检查。
- 主题只编译内置；不要重新加入下载 JavaScript、主题协议和 renderer 动态执行。
- Electron GUI 测试使用独立 profile，Graph Lab 每条测试创建新应用，避免前一条的窗口、草稿与焦点状态残留。
- 开发状态从 spec/progress.md 生成，不能在官网脚本、测试断言或 fallback 中写死历史 PASS 数字。
