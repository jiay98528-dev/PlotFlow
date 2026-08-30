import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  launchBlackboxApp,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';

interface RequestProbe {
  readonly registryUrl: string;
  readonly requests: string[];
  readonly close: () => Promise<void>;
}

async function startRequestProbe(): Promise<RequestProbe> {
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    requests.push(request.url ?? '/');
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ themes: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Request probe did not bind a port.');
  return {
    registryUrl: `http://127.0.0.1:${address.port}/data/official-themes.json`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function expectNoRequestsDuringQuietPeriod(probe: RequestProbe): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 750));
  expect(probe.requests).toEqual([]);
}

async function openBuiltinOnlyThemeCenter(page: Parameters<typeof dismissHomeIfVisible>[0]) {
  await dismissHomeIfVisible(page);
  await page.getByTestId('toolbar-theme-center').click();
  const themeCenter = page.getByTestId('theme-center');
  await expect(themeCenter).toBeVisible();
  await expect(themeCenter.locator('.official-theme-card')).toHaveCount(3);
  await expect(themeCenter.getByTestId('official-remote-theme-card')).toHaveCount(0);
  await expect(themeCenter.getByTestId('theme-center-remote-action')).toHaveCount(0);
  await expect(themeCenter.getByTestId('theme-center-refresh-remote')).toHaveCount(0);
}

test.describe('blackbox remote-theme execution boundary', () => {
  let probe: RequestProbe | null = null;

  test.afterEach(async () => {
    await probe?.close();
    probe = null;
  });

  test('does not request a configured remote registry and exposes only builtin themes @journey', async () => {
    const workspace = await createBlackboxWorkspace('remote-theme-disabled');
    const storyPath = join(workspace.storiesDir, 'builtin-only-story.mdstory');
    await writeStory(storyPath, 3, 'Builtin Theme Story');
    probe = await startRequestProbe();

    const launched = await launchBlackboxApp({
      storyPath,
      env: { PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL: probe.registryUrl },
    });
    try {
      await openBuiltinOnlyThemeCenter(launched.page);
      await expectNoRequestsDuringQuietPeriod(probe);
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('preserves but never executes a preinstalled remote index.mjs @edge', async () => {
    const workspace = await createBlackboxWorkspace('remote-theme-preinstalled');
    const userDataDir = join(workspace.root, 'user-data');
    const storyPath = join(workspace.storiesDir, 'preinstalled-theme-story.mdstory');
    await writeStory(storyPath, 2, 'Preinstalled Theme Story');
    const themeRoot = join(userDataDir, 'official-themes', 'plotflow-neon-dossier');
    const versionRoot = join(themeRoot, '1.0.0');
    await mkdir(versionRoot, { recursive: true });
    await writeFile(
      join(versionRoot, 'index.mjs'),
      "document.documentElement.setAttribute('data-remote-theme-executed', 'true');\nexport const createTheme = () => ({});\n",
      'utf8',
    );
    await writeFile(
      join(themeRoot, 'install.json'),
      `${JSON.stringify(
        {
          id: 'plotflow-neon-dossier',
          version: '1.0.0',
          name: { 'zh-CN': '恶意预置主题', 'en-US': 'Malicious Preinstalled Theme' },
          priceLabel: 'Free',
          installedAt: 1,
          runtime: {
            moduleUrl: 'plotflow-theme://plotflow-neon-dossier/1.0.0/index.mjs',
            styleUrls: [],
            assetBaseUrl: 'plotflow-theme://plotflow-neon-dossier/1.0.0/',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    probe = await startRequestProbe();

    const launched = await launchBlackboxApp({
      storyPath,
      userDataDir,
      env: { PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL: probe.registryUrl },
    });
    try {
      await openBuiltinOnlyThemeCenter(launched.page);
      await expect(launched.page.locator('[data-remote-theme-executed="true"]')).toHaveCount(0);
      await expect(launched.page.locator('html')).toHaveAttribute(
        'data-theme-id',
        /plotflow-(?:prism-foundry|narrative-workbench|engine-telemetry)/u,
      );
      await expectNoRequestsDuringQuietPeriod(probe);
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
