import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'out', 'packages/app/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/core/src/**/*.ts'],
    },
  },
});
