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
      rollupOptions: {
        input: resolve(PACKAGES_APP, 'index.html'),
      },
    },
  },
});
