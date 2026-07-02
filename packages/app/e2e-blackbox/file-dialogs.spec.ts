import { test, expect } from '@playwright/test';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  getBlackboxTarget,
  launchBlackboxApp,
  PROJECT_ROOT,
  switchToSplit,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace } from './helpers/fixtures';
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
      await switchToSplit(page);
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
});
