import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = __dirname;
const FORBIDDEN = [
  '__test_store__',
  'window.plotflow',
  'ipcMain.handle',
  'ipcMain.removeHandler',
  'localStorage.setItem',
  'localStorage.removeItem',
  '.evaluate(',
];

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

test('blackbox suite does not use internal test bridges or IPC mocks @edge', async () => {
  const files = (await collectFiles(ROOT)).filter((file) => !file.endsWith('blackbox-contract.spec.ts'));
  const violations: string[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    for (const token of FORBIDDEN) {
      if (content.includes(token)) {
        violations.push(`${file}: ${token}`);
      }
    }
  }
  expect(violations).toEqual([]);
});
