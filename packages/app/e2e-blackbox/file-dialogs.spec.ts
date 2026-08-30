import { test, expect, chromium } from '@playwright/test';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  getBlackboxTarget,
  launchBlackboxApp,
  PROJECT_ROOT,
  waitForStoryOpenObservation,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';
import { completeNativeFileDialog } from './helpers/nativeDialog';

test.describe('blackbox native file dialog journeys', () => {
  test.skip(process.platform !== 'win32', 'Native file dialog automation is Windows-only.');

  test('exports JSON through the real save dialog and verifies disk output @journey @packaged', async () => {
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
      await completeNativeFileDialog({
        filePath: exportPath,
        ownerProcessId: launched.app.process().pid,
        timeoutMs: 20_000,
      });

      await expect.poll(async () => (await stat(exportPath).catch(() => null))?.size ?? 0).toBeGreaterThan(20);
      const exported = await readFile(exportPath, 'utf-8');
      expect(exported).toContain('nodes');
      expect(exported).toContain('村口');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('opens through the real dialog with three fresh profiles and one reused profile @journey @packaged', async () => {
    test.skip(getBlackboxTarget() === 'devBuild', 'Native open dialog is a packaged-app blackbox gate.');
    const workspace = await createBlackboxWorkspace('native-open-graph-first');
    const storyPath = join(workspace.storiesDir, 'native-open-graph-first.mdstory');
    await writeStory(storyPath, 3, 'Native Open Graph First');

    const reusedUserDataDir = join(workspace.root, 'reused-user-data');
    const attempts = [undefined, undefined, reusedUserDataDir, reusedUserDataDir];
    for (const userDataDir of attempts) {
      const launched = await launchBlackboxApp({ userDataDir });
      try {
        const page = launched.page;
        const home = page.getByTestId('home-surface');
        await expect(home).toBeVisible();
        await home.getByRole('button', { name: /打开文件|Open file/i }).click({ noWaitAfter: true });
        const dialogResult = await completeNativeFileDialog({
          filePath: storyPath,
          ownerProcessId: launched.app.process().pid,
          mode: 'open',
          timeoutMs: 20_000,
        });
        expect(dialogResult).toMatchObject({ status: 'submitted', valueVerified: true, dialogClosed: true });

        const observation = await waitForStoryOpenObservation(page, basename(storyPath));
        expect(observation.status, observation.detail).toBe('opened');
        await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
        await expect(page.locator('.split-workspace')).toHaveCount(0);
        await page.getByTestId('graph-global-editor-tab-story').click();
        await expect(page.getByTestId('graph-inspector-meta-title')).toHaveValue('Native Open Graph First');
      } finally {
        await closeBlackboxApp(launched.app);
      }
    }
  });

  test('runs the exported playable HTML in system Edge and follows a branch @journey @packaged', async () => {
    test.skip(getBlackboxTarget() === 'devBuild', 'HTML runtime is a packaged-app blackbox gate.');
    const workspace = await createBlackboxWorkspace('native-html-runtime');
    const storyPath = join(workspace.storiesDir, 'native-html-runtime.mdstory');
    const exportPath = join(workspace.exportsDir, 'native-html-runtime.html');
    await copyFile(join(PROJECT_ROOT, 'templates', 'rpg-dialogue.mdstory'), storyPath);

    const launched = await launchBlackboxApp({ storyPath });
    try {
      const page = launched.page;
      await dismissHomeIfVisible(page);
      await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
      await page.getByTestId('toolbar-export').click();
      await page.locator('input[name="export-format"][value="html"]').check({ force: true });
      await page.getByTestId('export-dialog-submit').click({ noWaitAfter: true });
      await completeNativeFileDialog({
        filePath: exportPath,
        ownerProcessId: launched.app.process().pid,
        timeoutMs: 20_000,
      });
      await expect.poll(async () => (await stat(exportPath).catch(() => null))?.size ?? 0).toBeGreaterThan(100);
    } finally {
      await closeBlackboxApp(launched.app);
    }

    const browser = await chromium.launch({ channel: 'msedge', headless: false });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(exportPath).href);
      await expect(page.locator('body')).toContainText('村口');
      const branchButton = page.getByRole('button').first();
      await expect(branchButton).toBeVisible();
      const before = await page.locator('body').innerText();
      await branchButton.click();
      await expect.poll(async () => page.locator('body').innerText()).not.toBe(before);
    } finally {
      await browser.close();
    }
  });
});
