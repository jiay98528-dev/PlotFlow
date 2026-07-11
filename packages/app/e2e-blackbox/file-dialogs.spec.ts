import { test, expect } from '@playwright/test';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  getBlackboxTarget,
  launchBlackboxApp,
  PROJECT_ROOT,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';
import { completeNativeFileDialog } from './helpers/nativeDialog';

test.describe('blackbox native file dialog journeys', () => {
  test.skip(process.platform !== 'win32', 'Native file dialog automation is Windows-only.');

  test('exports JSON through the real save dialog and verifies disk output @journey', async () => {
    test.skip(getBlackboxTarget() === 'devBuild', 'Native save dialog is a packaged-app blackbox gate.');
    const workspace = await createBlackboxWorkspace('native-export');
    const storyPath = join(workspace.storiesDir, 'native-export.mdstory');
    const exportPath = join(workspace.exportsDir, 'native-export.json');
    await copyFile(join(PROJECT_ROOT, 'templates', 'rpg-dialogue.mdstory'), storyPath);

    const launched = await launchBlackboxApp({ storyPath });
    try {
      const page = launched.page;
      await dismissHomeIfVisible(page);
      await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
      await expect(page.locator('.split-workspace')).toHaveCount(0);
      await page.getByTestId('toolbar-export').click();
      await expect(page.locator('.export-dialog__overlay')).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('export-dialog-submit').click({ noWaitAfter: true });
      await completeNativeFileDialog({ filePath: exportPath, timeoutMs: 20_000 });

      await expect.poll(async () => (await stat(exportPath).catch(() => null))?.size ?? 0).toBeGreaterThan(20);
      const exported = await readFile(exportPath, 'utf-8');
      expect(exported).toContain('nodes');
      expect(exported).toContain('村口');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('opens an existing story from Home and lands in Graph Lab through the real open dialog @journey', async () => {
    test.skip(getBlackboxTarget() === 'devBuild', 'Native open dialog is a packaged-app blackbox gate.');
    const workspace = await createBlackboxWorkspace('native-open-graph-first');
    const storyPath = join(workspace.storiesDir, 'native-open-graph-first.mdstory');
    await writeStory(storyPath, 3, 'Native Open Graph First');

    const launched = await launchBlackboxApp();
    try {
      const page = launched.page;
      const home = page.getByTestId('home-surface');
      await expect(home).toBeVisible();
      await home.getByRole('button', { name: /打开文件|Open file/i }).click({ noWaitAfter: true });
      await completeNativeFileDialog({
        filePath: storyPath,
        mode: 'open',
        buttonPattern: 'Open|OK|打开|確定',
        timeoutMs: 20_000,
      });

      await expect(home).toBeHidden({ timeout: 20_000 });
      await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
      await expect(page.locator('.split-workspace')).toHaveCount(0);
      await page.getByTestId('graph-inspector-tab-story').click();
      await expect(page.getByTestId('graph-inspector-meta-title')).toHaveValue('Native Open Graph First');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
