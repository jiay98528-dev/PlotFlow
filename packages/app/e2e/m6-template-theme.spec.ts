import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('creates a story from the M6 template dialog', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'PlotFlow V0.1' })).toBeVisible();
  await page.getByRole('button', { name: '新建' }).click();

  const dialog = page.getByRole('dialog', { name: '新建文件' });
  await expect(dialog).toBeVisible();
  await page.getByLabel('标题').fill('E2E Story');
  await dialog.locator('.template-card').filter({ hasText: '解谜逃脱' }).click();
  await expect(page.getByLabel('预览')).toContainText('## 节点：醒来');

  await page.screenshot({
    path: 'test-results/m6-template-dialog-e2e.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: '创建' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.status-bar')).toContainText('新建: E2E Story');
  await expect(page.locator('.monaco-editor')).toBeVisible();
});

test('switches theme and language from the toolbar', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '亮色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByLabel('语言').selectOption('en-US');
  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  await expect(page.locator('.app-subtitle')).toHaveText('M6 Templates & Theme');
});
