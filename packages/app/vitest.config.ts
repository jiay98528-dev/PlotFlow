import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'monaco-editor': path.resolve(__dirname, 'node_modules/monaco-editor/esm/vs/editor/editor.api.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src-electron/**/*.test.ts'],
    exclude: ['e2e', 'node_modules'],
  },
});
