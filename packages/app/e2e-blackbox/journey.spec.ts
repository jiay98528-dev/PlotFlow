import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  ensureSplitGraphVisible,
  focusMonaco,
  launchBlackboxApp,
  switchToGraphLab,
  switchToSplit,
  waitForAnyGraphNode,
  waitForGraphNode,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';

test.describe('blackbox closed user journeys', () => {
  test('opens an existing story from command line, edits through GUI, saves, and reopens @journey', async () => {
    const workspace = await createBlackboxWorkspace('journey-existing');
    const storyPath = join(workspace.storiesDir, 'valid-story.mdstory');
    await writeStory(storyPath, 5, 'Existing Blackbox Story');

    let launched = await launchBlackboxApp({ storyPath });
    try {
      await dismissHomeIfVisible(launched.page);
      await switchToSplit(launched.page);
      await ensureSplitGraphVisible(launched.page);
      await waitForAnyGraphNode(launched.page);

      await focusMonaco(launched.page);
      await launched.page.keyboard.press('Control+End');
      await launched.page.keyboard.type('\n## 节点：BlackboxSave\nWritten through visible Monaco editor.\n', { delay: 1 });
      await waitForGraphNode(launched.page, 'BlackboxSave');
      await launched.page.keyboard.press('Control+S');
      await expect(launched.page.locator('body')).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }

    await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain('BlackboxSave');

    launched = await launchBlackboxApp({ storyPath });
    try {
      await dismissHomeIfVisible(launched.page);
      await switchToSplit(launched.page);
      await ensureSplitGraphVisible(launched.page);
      await waitForGraphNode(launched.page, 'BlackboxSave');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('uses Graph Lab visible controls and keeps the app responsive @journey', async () => {
    const workspace = await createBlackboxWorkspace('journey-graph-lab');
    const storyPath = join(workspace.storiesDir, 'graph-lab-story.mdstory');
    await writeStory(storyPath, 3, 'Graph Lab Blackbox Story');

    const launched = await launchBlackboxApp({ storyPath });
    try {
      await dismissHomeIfVisible(launched.page);
      await switchToGraphLab(launched.page);
      const nodeCountBefore = await launched.page.locator('.react-flow__node').count();
      await launched.page.getByTestId('graph-lab-create-node').click();
      await expect.poll(async () => launched.page.locator('.react-flow__node').count()).toBeGreaterThan(nodeCountBefore);
      await launched.page.getByTestId('graph-lab-source-toggle').click();
      await launched.page.getByTestId('graph-lab-source-drawer').waitFor({ state: 'visible' });
      await launched.page.getByTestId('workspace-mode-split').click();
      await switchToGraphLab(launched.page);
      await expect(launched.page.getByTestId('graph-lab-workspace')).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
