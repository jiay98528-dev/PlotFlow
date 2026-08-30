import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const coreRoot = resolve(workspaceRoot, 'packages/core');
const appRoot = resolve(workspaceRoot, 'packages/app');

export default defineConfig({
  test: {
    projects: [
      {
        root: coreRoot,
        test: {
          name: 'core',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['node_modules', 'dist', 'out'],
        },
      },
      {
        root: appRoot,
        resolve: {
          alias: [
            {
              find: /^monaco-editor$/,
              replacement: resolve(
                appRoot,
                'node_modules/monaco-editor/esm/vs/editor/editor.api.js',
              ),
            },
          ],
        },
        test: {
          name: 'app',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src-electron/**/*.test.ts'],
          exclude: ['node_modules', 'dist', 'out', 'e2e', 'e2e-blackbox'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [resolve(coreRoot, 'src/**/*.ts')],
    },
  },
});
