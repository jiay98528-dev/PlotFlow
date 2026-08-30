import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const mainEntry = resolve(__dirname, '../../../out/main/main.js');
const packagedExecutable = process.env['PLOTFLOW_E2E_EXECUTABLE'];

async function openFeedbackFromNativeHelpMenu(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('help-feedback');
    if (!item?.click) throw new Error('Native Help menu item "help-feedback" is unavailable');
    item.click(
      item,
      BrowserWindow.getFocusedWindow() ?? undefined,
      { triggeredByAccelerator: false } as Electron.KeyboardEvent,
    );
  });
}

test('反馈仅从 Help 菜单打开，并遵循 modal 焦点合同', async () => {
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch(
      packagedExecutable
        ? { executablePath: packagedExecutable, args: [], env: { ...process.env, NODE_ENV: 'test' } }
        : { args: [mainEntry], env: { ...process.env, NODE_ENV: 'test' } },
    );
    const page: Page = await app.firstWindow();
    const home = page.getByTestId('home-surface');
    await expect(home).toBeVisible();
    await expect(page.getByTestId('feedback-trigger')).toHaveCount(0);

    const opener = home.locator('button').first();
    await opener.focus();
    await openFeedbackFromNativeHelpMenu(app);
    const dialog = page.getByRole('dialog', { name: /BUG 反馈|Submit bug feedback/u });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('textarea')).toBeFocused();

    const close = dialog.getByRole('button', { name: /关闭反馈窗口|Close feedback dialog/u });
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: /发送反馈|Send feedback/u })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await home.locator('.button--primary').first().click();
    await expect(page.getByTestId('feedback-trigger')).toHaveCount(0);
    await openFeedbackFromNativeHelpMenu(app);
    await expect(dialog).toBeVisible();
  } finally {
    await app?.close();
  }
});
