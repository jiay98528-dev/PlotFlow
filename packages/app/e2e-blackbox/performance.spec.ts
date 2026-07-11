import { test, expect, type Page } from '@playwright/test';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  launchBlackboxApp,
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

/**
 * Large graphs must remain an opaque canvas workload. Prism glass belongs to
 * the structural shell only, never to each React Flow node or route.
 */
async function assertPrismLargeGraphAvoidsFilters(page: Page): Promise<void> {
  const audit = await page.evaluate(() => {
    const effectsOf = (element: Element | null) => {
      if (!element) return null;
      const styles = window.getComputedStyle(element);
      return {
        filter: styles.filter,
        backdropFilter: styles.backdropFilter,
      };
    };
    const hasEffects = (effects: { filter: string; backdropFilter: string } | null): boolean =>
      effects !== null && (effects.filter !== 'none' || effects.backdropFilter !== 'none');
    const canvas = document.querySelector('[data-testid="graph-lab-workspace"] .graph-lab__canvas');
    const nodes = Array.from(document.querySelectorAll('[data-official-node-theme="plotflow-prism-foundry"]'));
    const edgePaths = Array.from(document.querySelectorAll(
      '[data-official-edge-theme="plotflow-prism-foundry"] .official-graph-edge__path',
    ));

    return {
      canvas: effectsOf(canvas),
      nodeCount: nodes.length,
      edgeCount: edgePaths.length,
      nodeViolations: nodes
        .map((node, index) => ({ index, effects: effectsOf(node) }))
        .filter((entry) => hasEffects(entry.effects)),
      edgeViolations: edgePaths
        .map((edge, index) => ({ index, effects: effectsOf(edge) }))
        .filter((entry) => hasEffects(entry.effects)),
    };
  });

  expect(audit.canvas).not.toBeNull();
  expect(audit.canvas).toEqual({ filter: 'none', backdropFilter: 'none' });
  expect(audit.nodeCount).toBeGreaterThanOrEqual(200);
  // React Flow can cull off-screen routes. Every route that is actually rendered
  // must still stay filter-free, including when no route is presently in view.
  expect(audit.nodeViolations).toEqual([]);
  expect(audit.edgeViolations).toEqual([]);
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
        if (item.count >= 500) {
          await expect(launched.page.locator('[data-official-node-theme="plotflow-prism-foundry"]').first()).toBeVisible();
          await assertPrismLargeGraphAvoidsFilters(launched.page);
        }
        expect(runtimeErrors.filter((message) => /RangeError|Maximum call stack/i.test(message))).toEqual([]);
      } finally {
        await closeBlackboxApp(launched.app);
      }
    }
  });
});
