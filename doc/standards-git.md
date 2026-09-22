# Git 与提交规范

> 文档导航：[工程规则与架构索引](indexes/engineering.md) · [总索引](INDEX.md)

## 分支与同步

当前主线是 master。新建分支默认使用 codex/ 前缀；不要求先建立 dev 分支或按旧里程碑命名。隔离修改可用 worktree，已有用户改动不得被覆盖。

推送、创建 PR 和合并遵循用户本次授权。检查实际 diff 后提交；不要把“源码已提交”“远程 CI 已通过”“安装包已发布”混为同一状态。仓库中的工作流配置不能证明远程分支保护或本机 Hooks 已启用。

## Commit 格式

使用 Conventional Commits：type(scope): subject。scope 推荐填写；当前 commitlint 对空 scope 给出 warning，subject 上限 72 字符。

| type | 用途 |
|---|---|
| feat / fix | 功能与缺陷修复 |
| docs / style | 文档与无行为变化的格式调整 |
| refactor / perf / test | 重构、性能和测试 |
| chore / ci / revert | 工具维护、CI 和回退 |

格式以 [commitlint.config.js](../commitlint.config.js) 为准。正文解释必要的原因、影响和已执行验证，不复制聊天历史。

## 检查与 Hooks

[.husky/pre-commit](../.husky/pre-commit) 定义 lint-staged，[.husky/commit-msg](../.husky/commit-msg) 定义 commitlint。是否执行取决于当前安装环境与 Git hooksPath；不得凭文件存在宣称已经运行。

局部修改使用定向检查；CI 的实际命令以 [.github/workflows/ci.yml](../.github/workflows/ci.yml) 为准。现有 no-console warning 不等于编译失败，不把文档形式检查提升为新的合并前置条件。

## 文件与版本

- 源码、维护文档、回归 fixtures 和视觉基线进入 Git。
- node_modules、构建输出、运行日志、临时导出和本地安装包由 .gitignore 排除。
- 历史过程记录从 Git 查询，不在源码目录保存副本。
- 软件版本以根 package.json 为准；只有明确版本发布或基线需要时才打标签，不自动按每个旧里程碑打标签。
- 不擅自强推、重写共享历史、删除远程分支或清理用户数据。
