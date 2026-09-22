# 当前架构决策

更新：2026-09-22。此文件只维护仍生效的决策；早期过程与被替代方案可从 Git 历史查询。

| 决策 | 当前合同 |
|---|---|
| 文件即数据源 | .mdstory 是唯一磁盘真相源，GUI 与源码是同一故事的双投影 |
| 离线优先 | 创作、补全、保存、导出均不要求网络；反馈由用户主动提交 |
| ADR-012 | Graph Lab 为主要且默认入口，Split 为并列完整源码投影，见 doc/adr/ADR-012-graph-lab-default-workspace.md |
| ADR-013 | canonical FullID、Schema 0.2 与章节作用域变量，见 doc/adr/ADR-013-fullid-schema-02.md |
| ADR-014 | 会话草稿守卫、本地化、响应式与键盘工作流，见 doc/adr/ADR-014-graph-lab-p2-hardening.md |
| ADR-015 | Fablevia（维叙）品牌与 plotflow 技术兼容标识，见 doc/adr/ADR-015-fablevia-brand.md |
| ADR-016 | 0.1.1 只交付三套编译内置主题，暂停可执行远程主题，见下文 |

## ADR-016：暂停可执行远程主题

2026-08-02 确认。旧方案由同一来源提供 ZIP、哈希与可执行 JavaScript；完整性哈希不能建立独立的发布者信任边界。

- 只注册棱镜铸造台、叙事工作台、引擎遥测台，默认为棱镜铸造台。
- 不请求 registry、不扫描已安装主题目录、不动态 import 磁盘模块。
- 删除主题下载、安装、商店 IPC 与 preload API，不注册 plotflow-theme 协议。
- 旧远程或未知主题 ID 回退并持久化为默认内置主题；旧目录保留但忽略。
- 官网远程 registry 返回空列表。
- 将来恢复远程主题必须采用声明式、不可执行 JavaScript 的数据格式与独立签名，并重新定义资源权限。

完整主题合同见 ../doc/standards-theme-development.md。当前版本不恢复旧的 ZIP 代码运行时。
