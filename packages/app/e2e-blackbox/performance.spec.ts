import { test, expect } from '@playwright/test';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  launchBlackboxApp,
  waitForAnyGraphNode,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, sha256, writeStory } from './helpers/fixtures';

interface PerfSample {
  readonly name: string;
  readonly durationMs: number;
  readonly thresholdMs: number;
}

async function recordSample(reportPath: string, sample: PerfSample): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify({ ...sample, passed: sample.durationMs <= sample.thresholdMs })}\n`, 'utf-8');
}

test.describe('blackbox performance baseline', () => {
  test('opens 100/500/1000 node stories directly into the default Graph Lab within desktop thresholds @perf', async ({ browserName: _browserName }, testInfo) => {
    const workspace = await createBlackboxWorkspace('perf-open');
    const reportPath = testInfo.outputPath('blackbox-performance.jsonl');
    const cases = [
      { count: 100, openThresholdMs: 3_000 },
      { count: 500, openThresholdMs: 8_000 },
      { count: 1000, openThresholdMs: 12_000 },
    ];

    for (const item of cases) {
      const storyPath = join(workspace.storiesDir, `story-${item.count}.mdstory`);
      await writeStory(storyPath, item.count, `Perf ${item.count}`);
      const storyHashBefore = sha256(await readFile(storyPath));

      const start = Date.now();
      const launched = await launchBlackboxApp({ storyPath });
      const runtimeErrors: string[] = [];
      launched.page.on('pageerror', (error) => {
        runtimeErrors.push(error.message);
      });
      launched.page.on('console', (message) => {
        if (message.type() === 'error') {
          runtimeErrors.push(message.text());
        }
      });
      try {
        await dismissHomeIfVisible(launched.page);
        await expect(launched.page.locator('html')).toHaveAttribute('data-theme-id', 'plotflow-prism-foundry');
        await expect(launched.page.getByTestId('graph-lab-workspace')).toBeVisible();
        await expect(launched.page.locator('.split-workspace')).toHaveCount(0);
        await waitForAnyGraphNode(launched.page);
        const openDuration = Date.now() - start;
        await recordSample(reportPath, {
          name: `open-graph-lab-${item.count}`,
          durationMs: openDuration,
          thresholdMs: item.openThresholdMs,
        });
        expect(openDuration).toBeLessThanOrEqual(item.openThresholdMs);
        await launched.page.getByTestId('graph-node-search-trigger').click();
        const search = launched.page.getByTestId('graph-node-search-popover');
        await search.getByRole('combobox').fill(String(item.count));
        await expect(search.getByRole('option').first()).toBeVisible();
        await search.getByRole('combobox').press('Enter');
        await expect(search).toBeHidden();
        await launched.page.locator('.react-flow__controls-zoomin').click();
        await launched.page.locator('.react-flow__controls-zoomout').click();
        await expect(launched.page.getByTestId('toolbar-export')).toBeEnabled();
        expect(sha256(await readFile(storyPath))).toBe(storyHashBefore);
        expect(runtimeErrors.filter((message) => /RangeError|Maximum call stack/i.test(message))).toEqual([]);
      } finally {
        await closeBlackboxApp(launched.app);
      }
    }
  });
});
