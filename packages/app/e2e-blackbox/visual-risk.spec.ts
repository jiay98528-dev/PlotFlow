import { test, expect, type Page } from '@playwright/test';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  launchBlackboxApp,
  PROJECT_ROOT,
  switchToGraphLab,
  switchToSplit,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace } from './helpers/fixtures';

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1280x720', width: 1280, height: 720 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;

async function capture(page: Page, testInfo: { outputPath: (path: string) => string }, name: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test.describe('blackbox visual and theme risk checks', () => {
  test('captures key viewports and verifies official theme renderers actually change @edge', async ({ browserName: _browserName }, testInfo) => {
    const workspace = await createBlackboxWorkspace('visual-risk');
    const storyPath = join(workspace.storiesDir, 'visual-risk.mdstory');
    await copyFile(join(PROJECT_ROOT, 'templates', 'rpg-dialogue.mdstory'), storyPath);

    const launched = await launchBlackboxApp({ storyPath });
    try {
      const page = launched.page;
      await dismissHomeIfVisible(page);

      await switchToSplit(page);
      await expect(page.locator('.split-workspace')).toBeVisible();
      await capture(page, testInfo, 'split-default');

      await switchToGraphLab(page);
      await expect(page.locator('[data-official-node-theme="plotflow-narrative-workbench"]').first()).toBeVisible();
      await expect(page.locator('[data-official-edge-theme="plotflow-narrative-workbench"]').first()).toBeVisible();
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
        await capture(page, testInfo, `graph-lab-narrative-${viewport.name}`);
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByTestId('toolbar-theme-center').click();
      await expect(page.getByTestId('theme-center')).toBeVisible();
      await capture(page, testInfo, 'theme-center');

      const telemetryCard = page.locator('[data-theme-card-id="plotflow-engine-telemetry"]');
      if (await telemetryCard.count() > 0) {
        await telemetryCard.getByTestId('theme-center-apply').click();
        await expect(page.locator('html[data-theme-id="plotflow-engine-telemetry"]')).toHaveCount(1);
        await expect(page.locator('[data-official-node-theme="plotflow-engine-telemetry"]').first()).toBeVisible();
        await expect(page.locator('[data-official-edge-theme="plotflow-engine-telemetry"]').first()).toBeVisible();
        await expect(page.locator('[data-official-node-theme="plotflow-narrative-workbench"]')).toHaveCount(0);
        await capture(page, testInfo, 'graph-lab-engine-telemetry');
      }
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
