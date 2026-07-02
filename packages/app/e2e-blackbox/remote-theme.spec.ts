import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { closeBlackboxApp, closeThemeCenterIfVisible, dismissHomeIfVisible, launchBlackboxApp, switchToGraphLab } from './helpers/electronBlackbox';
import { createBlackboxWorkspace, copyRemoteThemeZip, writeStory } from './helpers/fixtures';
import { startOfficialThemeServer, type OfficialThemeServer } from './helpers/officialThemeServer';

test.describe('blackbox official remote themes', () => {
  let server: OfficialThemeServer | null = null;

  test.afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  test('downloads and applies an official remote ZIP theme through visible Theme Center UI @journey', async () => {
    const workspace = await createBlackboxWorkspace('remote-theme');
    const storyPath = join(workspace.storiesDir, 'remote-theme-story.mdstory');
    await writeStory(storyPath, 3, 'Remote Theme Story');
    const zipPath = await copyRemoteThemeZip(workspace.root);
    server = await startOfficialThemeServer(zipPath);

    const launched = await launchBlackboxApp({
      storyPath,
      env: {
        PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL: server.registryUrl,
      },
    });
    try {
      await dismissHomeIfVisible(launched.page);
      await launched.page.getByTestId('toolbar-theme-center').click();
      await expect(launched.page.getByTestId('theme-center')).toBeVisible();
      await expect(launched.page.getByTestId('official-remote-theme-card').filter({ hasText: /免费主题|Free/ })).toBeVisible();
      await launched.page.getByTestId('theme-center-remote-action').first().click();
      await expect(launched.page.locator('[data-theme-card-id="plotflow-neon-dossier"]')).toBeVisible({ timeout: 20_000 });
      await launched.page.locator('[data-theme-card-id="plotflow-neon-dossier"]').getByTestId('theme-center-apply').click();
      await expect(launched.page.locator('html[data-theme-id="plotflow-neon-dossier"]')).toHaveCount(1);

      await closeThemeCenterIfVisible(launched.page);
      await switchToGraphLab(launched.page);
      await expect(launched.page.locator('[data-theme-surface="neon-dossier-graph-lab-shell"]')).toBeVisible();
      await expect(launched.page.locator('[data-remote-slot="neon-dossier-node"]').first()).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('keeps builtin theme active when remote ZIP hash does not match @edge', async () => {
    const workspace = await createBlackboxWorkspace('remote-theme-hash');
    const storyPath = join(workspace.storiesDir, 'remote-theme-hash-story.mdstory');
    await writeStory(storyPath, 2, 'Remote Theme Hash Story');
    const zipPath = await copyRemoteThemeZip(workspace.root);
    server = await startOfficialThemeServer(zipPath, { hashMismatch: true });

    const launched = await launchBlackboxApp({
      storyPath,
      env: {
        PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL: server.registryUrl,
      },
    });
    try {
      await dismissHomeIfVisible(launched.page);
      await launched.page.getByTestId('toolbar-theme-center').click();
      await expect(launched.page.getByTestId('theme-center')).toBeVisible();
      const remoteAction = launched.page.getByTestId('theme-center-remote-action').first();
      await expect(remoteAction).toBeEnabled({ timeout: 20_000 });
      await remoteAction.click();
      await expect(launched.page.locator('html[data-theme-id="plotflow-narrative-workbench"]')).toHaveCount(1);
      await expect(launched.page.locator('[data-theme-card-id="plotflow-narrative-workbench"]')).toBeVisible();
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
