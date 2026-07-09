import { test, expect } from '@playwright/test';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  ensureSplitGraphVisible,
  launchBlackboxApp,
  switchToGraphLab,
  switchToSplit,
  waitForAnyGraphNode,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';

interface PerfSample {
  readonly name: string;
  readonly durationMs: number;
  readonly thresholdMs: number;
}

async function recordSample(reportPath: string, sample: PerfSample): Promise<void> {
  await appendFile(reportPath, `${JSON.stringify({ ...sample, passed: sample.durationMs <= sample.thresholdMs })}\n`, 'utf-8');
}

test.describe('blackbox performance baseline', () => {
  test('opens 100/500/1000 node stories and switches Graph Lab within desktop thresholds @perf', async ({ browserName: _browserName }, testInfo) => {
    const workspace = await createBlackboxWorkspace('perf-open');
    const reportPath = testInfo.outputPath('blackbox-performance.jsonl');
    const cases = [
      { count: 100, openThresholdMs: 3_000, graphLabThresholdMs: 3_000 },
      { count: 500, openThresholdMs: 8_000, graphLabThresholdMs: 3_000 },
      { count: 1000, openThresholdMs: 12_000, graphLabThresholdMs: 5_000 },
    ];

    for (const item of cases) {
      const storyPath = join(workspace.storiesDir, `story-${item.count}.mdstory`);
      await writeStory(storyPath, item.count, `Perf ${item.count}`);

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
        await switchToSplit(launched.page);
        await ensureSplitGraphVisible(launched.page);
        await expect(launched.page.locator('.official-graph-node').first()).toBeVisible();
        const openDuration = Date.now() - start;
        await recordSample(reportPath, {
          name: `open-${item.count}`,
          durationMs: openDuration,
          thresholdMs: item.openThresholdMs,
        });
        expect(openDuration).toBeLessThanOrEqual(item.openThresholdMs);

        const graphLabStart = Date.now();
        await switchToGraphLab(launched.page);
        await waitForAnyGraphNode(launched.page);
        const graphLabDuration = Date.now() - graphLabStart;
        await recordSample(reportPath, {
          name: `graph-lab-switch-${item.count}`,
          durationMs: graphLabDuration,
          thresholdMs: item.graphLabThresholdMs,
        });
        expect(graphLabDuration).toBeLessThanOrEqual(item.graphLabThresholdMs);
        expect(runtimeErrors.filter((message) => /RangeError|Maximum call stack/i.test(message))).toEqual([]);
      } finally {
        await closeBlackboxApp(launched.app);
      }
    }
  });
});
