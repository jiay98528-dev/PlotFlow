# PlotFlow 外审 GUI 黑盒总控提示词

本文件只负责编排，不再手写 Git revision 或 SHA256。权威构建身份来自当前证据目录中的 `environment.json`、release `SHA256SUMS.txt` 和最终 `pack-manifest.json`；三者不一致时立即标记 `BLOCKED`。

## 执行规则

1. 在当前 Windows 11 真机环境执行；记录机器、显示、语言和账号信息。安装完整性与首次运行包开始前，必须确认 PlotFlow 已卸载且用户配置不存在。
2. 先运行 `scripts/external-review/collect-windows-evidence.ps1`。预检不是 `PASS` 时停止，不得把环境问题写成产品缺陷。
3. 使用 OBS 全屏录制；Playwright 自动化同时保留 video、trace 和失败截图。
4. 按下列顺序分别开启五个任务/上下文，每包独立录制、独立报告、独立重试：
   - `spec/external-review/01-install-integrity.md`
   - `spec/external-review/02-graph-main-journey.md`
   - `spec/external-review/03-keyboard-a11y.md`
   - `spec/external-review/04-responsive-visual.md`
   - `spec/external-review/05-performance-recovery.md`
5. 每包只能使用 `PASS | FAIL | BLOCKED | NOT_RUN`：
   - `FAIL` 必须包含完成前置后的稳定复现产品缺陷。
   - 工具停止、录屏缺失、环境不干净、权限不足均为 `BLOCKED`。
   - 未开始或未覆盖为 `NOT_RUN`。
6. 每包结束填写 `result.json`，运行 `pnpm external-review:finalize -- --evidence-dir <目录>`；没有视频或 revision 不一致时不得生成通过证据。
7. 五包全部 `PASS` 才能说 GUI 外审门禁通过。installed blackbox、真实引擎 smoke、30 分钟巡检和 Authenticode 仍分别控制 RC/正式发行。

## 产品缺陷最低证据

缺陷必须同时包含：前置条件成功、逐步复现、明确预期、实际偏离、至少一次复现、视频时间点、截图、输入/输出文件和最小复测范围。缺少任一关键证据时，记录为观察或阻断，不得升级为产品 FAIL。
