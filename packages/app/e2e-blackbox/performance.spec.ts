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
  test('opens 100/500 node stories and switches Graph Lab within desktop thresholds @perf', async ({ browserName: _browserName }, testInfo) => {
    const workspace = await createBlackboxWorkspace('perf-open');
    const reportPath = testInfo.outputPath('blackbox-performance.jsonl');
    const cases = [
      { count: 100, thresholdMs: 3_000 },
      { count: 500, thresholdMs: 8_000 },
    ];

    for (const item of cases) {
      const storyPath = join(workspace.storiesDir, `story-${item.count}.mdstory`);
      await writeStory(storyPath, item.count, `Perf ${item.count}`);

      const start = Date.now();
      const launched = await launchBlackboxApp({ storyPath });
      try {
        await dismissHomeIfVisible(launched.page);
        await switchToSplit(launched.page);
        await ensureSplitGraphVisible(launched.page);
        await expect(launched.page.locator('.official-graph-node').first()).toBeVisible();
        const openDuration = Date.now() - start;
        await recordSample(reportPath, {
          name: `open-${item.count}`,
          durationMs: openDuration,
          thresholdMs: item.thresholdMs,
        });
        expect(openDuration).toBeLessThanOrEqual(item.thresholdMs);

        const graphLabStart = Date.now();
        await switchToGraphLab(launched.page);
        const graphLabDuration = Date.now() - graphLabStart;
        await recordSample(reportPath, {
          name: `graph-lab-switch-${item.count}`,
          durationMs: graphLabDuration,
          thresholdMs: 3_000,
        });
        expect(graphLabDuration).toBeLessThanOrEqual(3_000);
      } finally {
        await closeBlackboxApp(launched.app);
      }
    }
  });
});
