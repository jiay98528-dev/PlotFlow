# 可选独立外审工具

> 文档导航：[状态、验证与部署索引](../../doc/indexes/delivery.md) · [总索引](../../doc/INDEX.md)

这些工具只在用户明确要求正式独立外审时使用。普通开发、基线整理与常规 RC 不需要五包外审、录像或独立 reviewer；实际发行要求见 [发行检查](../release-blackbox-gate.md)。

## 当前合同来源

| 范围 | 机器定义 |
|---|---|
| 安装与卸载 | [install-integrity.json](cases/install-integrity.json) |
| Graph-first 用户旅程 | [graph-main-journey.json](cases/graph-main-journey.json) |
| 键盘与辅助功能 | [keyboard-a11y.json](cases/keyboard-a11y.json) |
| 响应式与视觉 | [responsive-visual.json](cases/responsive-visual.json) |
| 性能与恢复 | [performance-recovery.json](cases/performance-recovery.json) |

具体字段、步骤、结果枚举与一致性校验以 [review-contract.mjs](../../scripts/external-review/review-contract.mjs) 为准；不维护第二份可复制但已过时的报告 JSON。

## 工具入口

- external-review:finalize 为一次明确外审整理原始结果，不代替执行用例。
- external-review:verify 校验对应候选与结果材料；远程 artifact 校验需要该工具实际要求的 GitHub 访问权限。
- scripts/external-review/install-release-candidate.ps1 供受保护的安装态工作流使用。
- 案例定义和可复用脚本保留在仓库；逐轮报告、录屏与临时输出不作为日常源码基线的一部分。

外审不能擅自卸载用户现有软件、删除用户配置或在当前桌面执行全局输入。安装与系统对话框测试使用专用机器或隔离 CI，并遵循用户授权范围。
