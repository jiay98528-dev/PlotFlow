# Website Dependency Resources

`website/` 当前有两条路线：

1. **静态降级路线（当前可用）**：无需新增 npm 依赖，运行 `node website/scripts/build-static.mjs` 生成 `website/dist-static/`。
2. **React/Vite 路线（保留接口）**：`website/src/`、`vite.config.ts`、`package.json` 已保留，依赖下载恢复后可用。

## 本轮安装状态

首次 `pnpm.cmd --dir website install --ignore-workspace` 因 registry 下载长期卡住而中止；后续短超时在线重试成功拉取依赖。pnpm 11 拦截了 `esbuild@0.25.12` 的 postinstall，已通过 `website/pnpm-workspace.yaml` 最小白名单放行：

```yaml
allowBuilds:
  esbuild: true
```

当前可用命令：

```bash
pnpm.cmd --dir website install
pnpm.cmd --dir website run lint
pnpm.cmd --dir website run typecheck
pnpm.cmd --dir website run test
pnpm.cmd --dir website run build
```

曾观察到的慢/失败资源包括：

- `https://registry.npmjs.org/vite`
- `https://registry.npmjs.org/@typescript-eslint%2Feslint-plugin`
- `https://registry.npmjs.org/@typescript-eslint%2Fparser`
- `https://registry.npmjs.org/react-dom`
- `https://registry.npmjs.org/@testing-library/react/-/react-16.3.2.tgz`
- `https://registry.npmjs.org/@testing-library/jest-dom/-/jest-dom-6.9.1.tgz`

## 直接依赖清单

生产依赖：

- `@vitejs/plugin-react@5.2.0`
- `lucide-react@1.18.0`
- `react@18.2.0`
- `react-dom@18.2.0`
- `vite@6.4.3`

开发依赖：

- `@testing-library/jest-dom@6.9.1`
- `@testing-library/react@16.3.0`
- `@types/node@20.0.0`
- `@types/react@18.2.0`
- `@types/react-dom@18.2.0`
- `@typescript-eslint/eslint-plugin@7.0.0`
- `@typescript-eslint/parser@7.0.0`
- `eslint@8.57.1`
- `jsdom@29.1.1`
- `typescript@5.3.0`
- `vitest@3.2.6`

## 手动下载目录

如需手动准备 npm tarball，可放入：

```text
website/vendor/npm-cache/
```

推荐恢复命令：

```bash
pnpm.cmd --dir website install
```

若你已经把 tarball 加入 pnpm store，可再尝试：

```bash
pnpm.cmd --dir website install --ignore-workspace --offline
```
