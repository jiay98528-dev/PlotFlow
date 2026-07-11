import { test, expect } from '@playwright/test';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  getBlackboxTarget,
  launchBlackboxApp,
  switchToSplit,
  waitForGraphNode,
} from './helpers/electronBlackbox';
import {
  createBlackboxWorkspace,
  writeGraphFirstDiagnosticStory,
  writeStory,
} from './helpers/fixtures';
import { completeNativeFileDialog } from './helpers/nativeDialog';

async function continueFromHome(page: import('@playwright/test').Page): Promise<void> {
  const home = page.getByTestId('home-surface');
  await expect(home).toBeVisible();
  await home.getByRole('button', { name: /继续编辑|Continue editing/i }).click();
  await expect(home).toBeHidden();
}

async function expectGraphFirstWorkspace(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('graph-lab-workspace')).toBeVisible();
  await expect(page.locator('.split-workspace')).toHaveCount(0);
  await expect(page.getByTestId('workspace-mode-graph-lab')).toHaveAttribute('aria-pressed', 'true');
}

async function expectValidSchema02Export(exported: unknown): Promise<void> {
  const schemaPath = join(__dirname, '..', '..', 'core', 'schema', '0.2', 'story.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf-8')) as Record<string, unknown>;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addFormat('date-time', {
    type: 'string',
    validate: (value: string) => Number.isFinite(Date.parse(value)),
  });
  const validate = ajv.compile(schema);
  expect(validate(exported), JSON.stringify(validate.errors, null, 2)).toBe(true);
}

test.describe('blackbox Graph-first user journeys', () => {
  test('uses Graph Lab for a fresh profile and preserves a later explicit Split preference @journey', async () => {
    const workspace = await createBlackboxWorkspace('workspace-preference');
    const storyPath = join(workspace.storiesDir, 'workspace-preference.mdstory');
    await writeStory(storyPath, 3, 'Workspace Preference Story');

    let launched = await launchBlackboxApp({ storyPath });
    const userDataDir = launched.userDataDir;
    try {
      await expectGraphFirstWorkspace(launched.page);
      await launched.page.getByTestId('toolbar-home').click();
      await continueFromHome(launched.page);
      await expectGraphFirstWorkspace(launched.page);

      await switchToSplit(launched.page);
      await expect(launched.page.getByTestId('workspace-mode-split')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await closeBlackboxApp(launched.app);
    }

    launched = await launchBlackboxApp({ storyPath, userDataDir });
    try {
      await expect(launched.page.locator('.split-workspace')).toBeVisible();
      await expect(launched.page.getByTestId('graph-lab-workspace')).toHaveCount(0);
      await expect(launched.page.getByTestId('workspace-mode-split')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('creates a new story from Home into Graph Lab without exposing Split @journey', async () => {
    const launched = await launchBlackboxApp();
    try {
      const home = launched.page.getByTestId('home-surface');
      await expect(home).toBeVisible();
      await home.getByRole('button', { name: /新建故事|New story/i }).click();

      const dialog = launched.page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByLabel(/标题|Title/i).fill('Graph First New Story');
      await dialog.getByRole('button', { name: /^创建$|^Create$/i }).click();

      await expect(dialog).toBeHidden();
      await expectGraphFirstWorkspace(launched.page);
      await launched.page.getByTestId('graph-inspector-tab-story').click();
      await expect(launched.page.getByTestId('graph-inspector-meta-title')).toHaveValue('Graph First New Story');
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('edits, undoes, redoes, saves, and reopens a real file entirely through visible Graph Lab controls @journey', async () => {
    const workspace = await createBlackboxWorkspace('journey-graph-first-save');
    const storyPath = join(workspace.storiesDir, 'graph-first-save.mdstory');
    await writeStory(storyPath, 3, 'Graph First Save Story');

    let launched = await launchBlackboxApp({ storyPath });
    const userDataDir = launched.userDataDir;
    try {
      const page = launched.page;
      await expectGraphFirstWorkspace(page);

      const nodeCountBefore = await page.locator('.react-flow__node').count();
      await page.getByTestId('graph-lab-create-node').click();
      await expect.poll(async () => page.locator('.react-flow__node').count()).toBeGreaterThan(nodeCountBefore);

      const createdOutlineNode = page.getByTestId('graph-lab-outline-node').last();
      await createdOutlineNode.click();

      const titleField = page.getByTestId('graph-inspector-node-title');
      const bodyField = page.getByTestId('graph-inspector-node-body');
      await expect(titleField).toBeVisible();
      const initialBody = await bodyField.inputValue();
      await titleField.fill('BlackboxGraphNode');
      await titleField.press('Enter');
      await waitForGraphNode(page, 'BlackboxGraphNode');

      await bodyField.fill('Written and persisted through visible Graph Lab Inspector controls.');
      await titleField.click();
      await expect(bodyField).toHaveValue('Written and persisted through visible Graph Lab Inspector controls.');
      await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain(
        'Written and persisted through visible Graph Lab Inspector controls.',
      );

      const undo = page.getByTestId('graph-lab-undo');
      const redo = page.getByTestId('graph-lab-redo');
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect(redo).toBeEnabled();
      await expect(bodyField).toHaveValue(initialBody);
      await redo.click();
      await expect(bodyField).toHaveValue('Written and persisted through visible Graph Lab Inspector controls.');

      await page.keyboard.press('Control+S');
      await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain('BlackboxGraphNode');
      await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain('Written and persisted through visible Graph Lab Inspector controls.');
    } finally {
      await closeBlackboxApp(launched.app);
    }

    launched = await launchBlackboxApp({ storyPath, userDataDir });
    try {
      const page = launched.page;
      await expectGraphFirstWorkspace(page);
      await waitForGraphNode(page, 'BlackboxGraphNode');
      await page.getByTestId('graph-lab-outline-node').filter({ hasText: 'BlackboxGraphNode' }).click();
      await expect(page.getByTestId('graph-inspector-node-body')).toHaveValue(
        'Written and persisted through visible Graph Lab Inspector controls.',
      );
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });

  test('completes the packaged Graph-first native open to Schema 0.2 export journey without Split or bridges @journey', async () => {
    test.skip(process.platform !== 'win32', 'Native open/save dialog automation is Windows-only.');
    test.skip(getBlackboxTarget() === 'devBuild', 'The strict native-dialog journey is a packaged-app gate.');

    const workspace = await createBlackboxWorkspace('strict-graph-first-native');
    const storyPath = join(workspace.storiesDir, 'strict-graph-first-native.mdstory');
    const exportPath = join(workspace.exportsDir, 'strict-graph-first-native.json');
    await writeGraphFirstDiagnosticStory(storyPath);

    const repairedBody = 'Edited, repaired, and persisted entirely through Graph Lab GUI controls.';
    let launched = await launchBlackboxApp();
    const userDataDir = launched.userDataDir;

    try {
      const page = launched.page;
      const home = page.getByTestId('home-surface');
      await expect(home).toBeVisible();
      await expectGraphFirstWorkspace(page);

      await home.getByRole('button', { name: /打开文件|Open file/i }).click({ noWaitAfter: true });
      await completeNativeFileDialog({
        filePath: storyPath,
        mode: 'open',
        buttonPattern: 'Open|OK|打开|確定',
        timeoutMs: 20_000,
      });

      await expect(home).toBeHidden({ timeout: 20_000 });
      await expectGraphFirstWorkspace(page);

      // Prove the known E001 is visible and navigate through the user-facing
      // diagnostic surface before repairing it in the Inspector.
      await page.getByTestId('graph-lab-diagnostics-button').click();
      const missingTargetDiagnostic = page.getByTestId('problem-panel-item-E001').first();
      await expect(missingTargetDiagnostic).toBeVisible({ timeout: 10_000 });
      await missingTargetDiagnostic.click();
      await expect(page.getByTestId('graph-inspector-node-title')).toHaveValue('入口');

      await page.getByTestId('graph-inspector-tab-routes').click();
      const targetSelect = page.getByTestId('graph-inspector-option-target-0');
      const exitOption = targetSelect.locator('option').filter({ hasText: '第一章 / 出口' });
      await expect(exitOption).toHaveCount(1);
      const exitFullId = await exitOption.getAttribute('value');
      expect(exitFullId).toBeTruthy();
      await targetSelect.selectOption(exitFullId!);
      await expect(page.getByTestId('problem-panel-item-E001')).toHaveCount(0, { timeout: 10_000 });
      await expectGraphFirstWorkspace(page);

      await page.getByTestId('graph-inspector-tab-node').click();
      const bodyField = page.getByTestId('graph-inspector-node-body');
      const initialBody = await bodyField.inputValue();
      await bodyField.fill(repairedBody);
      await bodyField.press('Control+Enter');
      await expect(bodyField).toHaveValue(repairedBody);

      const undo = page.getByTestId('graph-lab-undo');
      const redo = page.getByTestId('graph-lab-redo');
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect(bodyField).toHaveValue(initialBody);
      await expect(redo).toBeEnabled();
      await redo.click();
      await expect(bodyField).toHaveValue(repairedBody);
      await expectGraphFirstWorkspace(page);

      await page.keyboard.press('Control+S');
      await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain(repairedBody);
      await expect.poll(async () => readFile(storyPath, 'utf-8')).toContain(
        '[选项] 前往出口 -> 第一章/节点：出口',
      );
    } finally {
      await closeBlackboxApp(launched.app);
    }

    // Restart the same profile without a command-line file. Continue editing
    // must reopen the saved story, while Graph history starts as a new session.
    launched = await launchBlackboxApp({ userDataDir });
    try {
      const page = launched.page;
      await expectGraphFirstWorkspace(page);
      await continueFromHome(page);
      await expectGraphFirstWorkspace(page);
      await waitForGraphNode(page, '入口');
      await page.getByTestId('graph-lab-outline-node').filter({ hasText: '入口' }).click();
      await page.getByTestId('graph-inspector-tab-node').click();
      await expect(page.getByTestId('graph-inspector-node-body')).toHaveValue(repairedBody);
      await expect(page.getByTestId('graph-lab-undo')).toBeDisabled();
      await expect(page.getByTestId('graph-lab-redo')).toBeDisabled();

      await page.getByTestId('toolbar-export').click();
      await expect(page.locator('.export-dialog__overlay')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('export-dialog-submit').click({ noWaitAfter: true });
      await completeNativeFileDialog({ filePath: exportPath, timeoutMs: 20_000 });

      await expect.poll(async () => (await stat(exportPath).catch(() => null))?.size ?? 0).toBeGreaterThan(20);
      const exported = JSON.parse(await readFile(exportPath, 'utf-8')) as {
        readonly $schema?: string;
        readonly chapters?: ReadonlyArray<{
          readonly nodes?: ReadonlyArray<{
            readonly title?: string;
            readonly options?: ReadonlyArray<{ readonly targetFullId?: string | null }>;
          }>;
        }>;
      };
      expect(exported.$schema).toBe('https://plotflow.dev/schema/0.2/story.json');
      const entry = exported.chapters?.[0]?.nodes?.find((node) => node.title === '入口');
      expect(entry?.options?.[0]?.targetFullId).toBe(
        `${encodeURIComponent('第一章')}/${encodeURIComponent('出口')}`,
      );
      await expectValidSchema02Export(exported);
      await expectGraphFirstWorkspace(page);
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
