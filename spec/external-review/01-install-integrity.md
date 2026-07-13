# 证据包 1：安装完整性

你是安装版黑盒验收工程师。只验证安装系统，不进入故事编辑深测。

1. 从当前 Windows 11 真机开始，记录 Windows/机器/显示/语言，校验 installer SHA256 与 `SHA256SUMS.txt`。首次运行验证前必须确认 PlotFlow 已卸载且用户配置不存在。
2. 用正式安装器安装，记录 UAC、安装路径、文件版本、EXE SHA256、Authenticode、HKLM/HKCU 卸载条目和 `.mdstory` 文件关联。
3. 启动一次，确认 Home 可见后正常退出且无残留 PlotFlow 进程。
4. 使用注册表声明的静默卸载命令卸载，确认 EXE、卸载项和文件关联清除。
5. 将同一 installer 原位重装，复核 installed EXE hash 等于 manifest 中的 unpacked EXE hash。

停止点：任何 hash 不一致、安装路径位于源码工作区、注册项缺失或录屏中断，立即结束本包。hash/安装合同实际偏离为 `FAIL`；权限、机器环境或录屏问题为 `BLOCKED`。`NotSigned` 单独记录为发行阻断，不否定其他安装完整性。
