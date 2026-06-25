# PlotFlow Website

独立的 PlotFlow 落地页与使用说明网站。它是发行附加内容，后续直接部署到服务器，不进入桌面软件安装包。

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

网络依赖不可用时，使用静态降级路线：

```bash
node website/scripts/sync-project-status.mjs
node website/scripts/build-static.mjs
node website/scripts/verify-static.mjs
```

生成结果位于 `website/dist-static/`，可直接部署为静态降级站点。

## Boundaries

- `website/` 不加入根 `pnpm-workspace.yaml`。
- `website/` 不跟随 Electron `electron-builder` 打包。
- 开发页数据由 `scripts/sync-project-status.mjs` 从项目进度数据生成，避免手写进度数字腐败。
- 首版中英双语为人工维护内容，不接入复杂 i18n 框架。
- React/Vite 源码接口保留在 `website/src/`；当前静态降级版本保留同一个 `public/data/project-status.json` 数据接口。
