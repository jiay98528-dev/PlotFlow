import { test, expect, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import {
  closeBlackboxApp,
  dismissHomeIfVisible,
  launchBlackboxApp,
  switchToGraphLab,
} from './helpers/electronBlackbox';
import { createBlackboxWorkspace, writeStory } from './helpers/fixtures';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface NodeSnapshot {
  readonly x: number;
  readonly y: number;
}

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Expected visible locator box.');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function blankCanvasPoint(page: Page): Promise<Point> {
  const pane = page.locator('.react-flow__pane');
  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error('Expected a visible React Flow pane.');

  const blockerLocators = page.locator([
    '.react-flow__node',
    '.react-flow__controls',
    '.react-flow__minimap',
    '.wire-drop-menu',
    '.source-drawer__toggle',
    '.source-drawer__body',
  ].join(', '));
  const blockerRects: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let index = 0; index < await blockerLocators.count(); index += 1) {
    const box = await blockerLocators.nth(index).boundingBox();
    if (box) blockerRects.push(box);
  }

  const normalizedCandidates: Point[] = [
    { x: 0.72, y: 0.38 },
    { x: 0.68, y: 0.32 },
    { x: 0.42, y: 0.28 },
    { x: 0.58, y: 0.58 },
    { x: 0.80, y: 0.62 },
  ];
  for (let row = 1; row <= 9; row += 1) {
    for (let column = 1; column <= 13; column += 1) {
      normalizedCandidates.push({ x: column / 14, y: row / 10 });
    }
  }

  const margin = 24;
  for (const candidate of normalizedCandidates) {
    const local = { x: paneBox.width * candidate.x, y: paneBox.height * candidate.y };
    const point = { x: paneBox.x + local.x, y: paneBox.y + local.y };
    const isBlocked = blockerRects.some((rect) =>
      point.x >= rect.x - margin && point.x <= rect.x + rect.width + margin &&
      point.y >= rect.y - margin && point.y <= rect.y + rect.height + margin,
    );
    if (isBlocked) continue;
    try {
      // trial verifies that the pane itself receives the pointer at this coordinate.
      await pane.click({ position: local, trial: true, timeout: 750 });
      return point;
    } catch {
      // Theme chrome or another overlay intercepted this candidate; continue scanning.
    }
  }
  throw new Error('No real blank React Flow pane point found after scanning the visible canvas grid.');
}

async function dragFromHandleTo(page: Page, target: Point): Promise<void> {
  const handle = page.locator('.story-node-connect-handle, .official-node-port--source').first();
  await handle.waitFor({ state: 'visible', timeout: 20_000 });
  const start = await centerOf(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 8, { steps: 4 });
  await expect(page.getByTestId('graph-live-wire-preview')).toBeVisible({ timeout: 5_000 });
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
}

async function snapshotFirstNodes(page: Page, count: number): Promise<NodeSnapshot[]> {
  const nodes = page.locator('.react-flow__node');
  const snapshots: NodeSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await nodes.nth(index).boundingBox();
    if (!box) continue;
    snapshots.push({ x: box.x, y: box.y });
  }
  return snapshots;
}

function maxNodeDrift(before: NodeSnapshot[], after: NodeSnapshot[]): number {
  const length = Math.min(before.length, after.length);
  let max = 0;
  for (let index = 0; index < length; index += 1) {
    const previous = before[index];
    const next = after[index];
    if (!previous || !next) continue;
    max = Math.max(max, Math.hypot(next.x - previous.x, next.y - previous.y));
  }
  return max;
}

test.describe('blackbox Graph Lab high-risk GUI behavior', () => {
  test('wire drop menu closes, live wire is visible, Source Dock does not trap the workspace, and layout stays stable @journey', async () => {
    const workspace = await createBlackboxWorkspace('graph-lab-risk');
    const storyPath = join(workspace.storiesDir, 'graph-lab-risk.mdstory');
    await writeStory(storyPath, 4, 'Graph Lab Risk Story');

    const launched = await launchBlackboxApp({ storyPath });
    try {
      const page = launched.page;
      await dismissHomeIfVisible(page);
      await switchToGraphLab(page);

      await expect(page.getByTestId('toolbar-graph-view-toggle')).toHaveCount(0);
      await expect(page.getByText(/并列|缩略图|最小化/)).toHaveCount(0);

      await page.getByTestId('graph-lab-source-toggle').click();
      await expect(page.getByTestId('graph-lab-source-drawer')).toHaveClass(/source-drawer--open/);
      const drawerBox = await page.getByTestId('graph-lab-source-drawer').boundingBox();
      const inspectorBox = await page.getByTestId('graph-lab-inspector').boundingBox();
      if (!drawerBox || !inspectorBox) {
        throw new Error('Expected Source Dock and Inspector boxes.');
      }
      expect(drawerBox.y).toBeGreaterThan(inspectorBox.y);
      await page.getByTestId('graph-lab-source-toggle').click();
      await expect(page.getByTestId('graph-lab-source-drawer')).not.toHaveClass(/source-drawer--open/);

      const initialNodeCount = await page.locator('.react-flow__node').count();
      expect(initialNodeCount).toBeGreaterThan(1);
      const before = await snapshotFirstNodes(page, Math.min(initialNodeCount, 3));

      await dragFromHandleTo(page, await blankCanvasPoint(page));
      await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);

      await dragFromHandleTo(page, await blankCanvasPoint(page));
      await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 5_000 });
      const dismissPoint = await blankCanvasPoint(page);
      await page.mouse.click(dismissPoint.x, dismissPoint.y);
      await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);

      await dragFromHandleTo(page, await blankCanvasPoint(page));
      await expect(page.getByTestId('wire-drop-menu')).toBeVisible({ timeout: 5_000 });
      await page.getByTestId('wire-drop-create-node').click();
      await expect.poll(async () => page.locator('.react-flow__node').count()).toBeGreaterThan(initialNodeCount);
      await expect(page.getByTestId('wire-drop-menu')).toHaveCount(0);

      const after = await snapshotFirstNodes(page, before.length);
      expect(maxNodeDrift(before, after)).toBeLessThanOrEqual(24);
    } finally {
      await closeBlackboxApp(launched.app);
    }
  });
});
