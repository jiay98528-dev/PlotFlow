# Fablevia Website

> 文档导航：[状态、验证与部署索引](../doc/indexes/delivery.md) · [总索引](../doc/INDEX.md)

独立的 Fablevia 落地页与使用说明网站。它可独立构建和部署，不进入桌面软件安装包。

## Commands

```bash
pnpm --dir website install
pnpm --dir website sync:data
pnpm --dir website dev
pnpm --dir website lint
pnpm --dir website typecheck
pnpm --dir website test
pnpm --dir website build
pnpm --dir website serve:dist
```

React/Vite 是主要实现，静态降级路线用于不依赖前端构建工具的部署：

```bash
node website/scripts/sync-project-status.mjs
node website/scripts/build-static.mjs
node website/scripts/verify-static.mjs
```

生成结果位于 `website/dist-static/`，可直接部署为静态降级站点。

## Boundaries

- `website/` 不加入根 `pnpm-workspace.yaml`。
- `website/` 不跟随 Electron `electron-builder` 打包。
- 开发页数据由 `scripts/sync-project-status.mjs` 直接从 spec/progress.md 和根 package.json 生成，避免手写进度数字腐败。
- 首版中英双语为人工维护内容，不接入复杂 i18n 框架。
- React/Vite 源码接口保留在 `website/src/`；当前静态降级版本保留同一个 `public/data/project-status.json` 数据接口。
