import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const PACKAGES_APP = resolve(__dirname, 'packages', 'app');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(PACKAGES_APP, 'src-electron', 'main.ts'),
        formats: ['cjs'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(PACKAGES_APP, 'src-electron', 'preload.ts'),
        formats: ['cjs'],
      },
    },
  },
  renderer: {
    root: PACKAGES_APP,
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        input: resolve(PACKAGES_APP, 'index.html'),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/monaco-editor') || id.includes('node_modules\\monaco-editor')) return 'monaco';
            if (id.includes('node_modules/@xyflow') || id.includes('node_modules\\@xyflow')) return 'react-flow';
            if (id.includes('packages/app/src/theme') || id.includes('packages\\app\\src\\theme')) return 'theme-runtime';
            if (id.includes('node_modules')) return 'vendor';
            return undefined;
          },
        },
      },
    },
  },
});
