# Windows 构建与发行检查

> 文档导航：[状态、验证与部署索引](../doc/indexes/delivery.md) · [总索引](../doc/INDEX.md)

## 适用范围

日常修改只运行与改动相关的检查，不要求创建发行候选、外审材料或长期证据链。本文件区分软件构建、运行验证和明确的发行声明；实际执行结果只维护在 [开发状态](progress.md)。

## 检查层次

| 层次 | 命令与对象 | 能说明什么 |
|---|---|---|
| 本地应用集成 | pnpm.cmd --filter @plotflow/app test:e2e:background，源码构建 | 使用独立隐藏桌面的 CDP 集成测试，允许测试桥 |
| CI 应用集成 | pnpm.cmd --filter @plotflow/app test:e2e | 在隔离 runner 中验证应用交互与视觉 |
| 源码黑盒 | test:e2e:blackbox，out/main/main.js | 不通过 store/IPC 捷径的可见用户路径 |
| 解包态黑盒 | test:e2e:unpacked，明确指定目录中的 Fablevia.exe | 验证真实二进制、资源及原生打开/保存/导出 |
| 安装态黑盒 | test:e2e:installed，明确安装路径 | 验证实际安装、系统关联及启动路径 |

本地不得用前台 GUI E2E 抢占用户桌面。后台入口只运行应用集成套件；包含 UIAutomation、系统鼠标键盘或原生对话框的黑盒放在专用机器或 CI，不把隐藏终端当成桌面隔离。

## 开发包

普通 Windows 构建使用 pnpm.cmd package:win，可通过 PLOTFLOW_RELEASE_OUTPUT 指定输出。网络下载不可用且 node_modules/electron/dist 已包含对应版本时，可追加 --config.electronDist=node_modules/electron/dist。

release/baseline 保留当前开发安装器、win-unpacked、源码快照与 baseline.json。它不进入 Git，不等于已公开发行；源码快照中的提交与文件校验值用于区分新旧产物。文档-only 提交刷新源码快照即可，不因文档变化重复 GUI 回归或重打无变化的 EXE。

## 明确发行候选

只有当前任务确实涉及候选时才运行 release:candidate:create。它从干净提交创建 release/candidates/<version>/<commit>/<utc-run>，并输出本次目录与二进制路径。随后使用相同目录进行 verify 与黑盒，不能拿旧的 release 根目录冒充新候选。

运行解包黑盒前，将 PLOTFLOW_BLACKBOX_RELEASE_ROOT 和 PLOTFLOW_BLACKBOX_UNPACKED_EXE 设置为同一候选的目录和 win-unpacked/Fablevia.exe。运行安装态黑盒前，将 PLOTFLOW_INSTALLED_EXE 设置为本次真实安装的 EXE。

当前发行层次约定：未签名开发候选验证源码与解包路径；明确 RC 再验证同一候选的安装态；公共 Windows 正式发行再处理有效 Authenticode 签名和签名后文件校验值。人工检查只覆盖自动化未覆盖的实际高风险路径，不叠加固定时长巡检。

## 黑盒边界

黑盒只通过可见 UI、真实文件、命令行打开和必要的系统接口验证，不直接读取/修改 renderer store，不调用内部测试桥，不替换 IPC handler。主路径以 Graph Lab 创建、编辑、保存、重开、修复诊断和导出为中心；Split 作为独立辅助路径保留。

测试实现位于 [e2e-blackbox](../packages/app/e2e-blackbox)，覆盖文件对话框、Graph 主旅程、资源打包、主题执行边界、窗口布局和大图场景。用例数量可能变化，不在本文件硬编码。

## CI 与可选外审

PR/push 行为检查以 [ci.yml](../.github/workflows/ci.yml) 为准；候选打包与受保护安装态任务见 [release-validation.yml](../.github/workflows/release-validation.yml)。工作流文件本身不代表某次远程运行成功。

[独立外审工具](external-review/README.md) 仅在用户明确要求时使用，不阻碍普通开发和常规 RC。
