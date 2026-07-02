import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { closeBlackboxApp, closeThemeCenterIfVisible, dismissHomeIfVisible, launchBlackboxApp, switchToSplit } from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeRaw, writeStory } from './helpers/fixtures';

test.describe('blackbox edge conditions', () => {
  test('opens Unicode path and empty/frontmatter-only stories without blank screen @edge', async () => {
    const workspace = await createBlackboxWorkspace('edge-unicode');
    const unicodePath = join(workspace.storiesDir, '中文-emoji-剧情-🧪.mdstory');
    await writeRaw(unicodePath, '---\ntitle: 空白边界\nauthor: QA\n---\n');

    const launched = await launchBlackboxApp({ storyPath: unicodePath });
    try {
      await dismissHomeIfVisible(launched.page);
      await switchToSplit(launched.page);
      await expect(launched.page.locator('.monaco-editor')).toBeVisible();
      await expect(launched.page.locator('.app-shell')).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('handles rapid workspace and theme-center switching without white screen @edge', async () => {
    const workspace = await createBlackboxWorkspace('edge-switching');
    const storyPath = join(workspace.storiesDir, 'switching.mdstory');
    await writeStory(storyPath, 8, 'Switching Story');

    const launched = await launchBlackboxApp({ storyPath });
    try {
      await dismissHomeIfVisible(launched.page);
      for (let index = 0; index < 5; index += 1) {
        await launched.page.getByTestId('workspace-mode-graph-lab').click();
        await expect(launched.page.getByTestId('graph-lab-workspace')).toBeVisible();
        await launched.page.getByTestId('workspace-mode-split').click();
        await expect(launched.page.locator('.split-workspace')).toBeVisible();
        await launched.page.getByTestId('toolbar-theme-center').click();
        await expect(launched.page.getByTestId('theme-center')).toBeVisible();
        await closeThemeCenterIfVisible(launched.page);
      }
      await expect(launched.page.locator('.app-shell')).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
