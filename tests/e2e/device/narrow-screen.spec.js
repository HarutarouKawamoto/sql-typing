import { test, expect } from '@playwright/test';
import { openModeSelect } from '../helpers/open-play.js';

test.use({ viewport: { width: 375, height: 812 } });

test('幅375pxでは遊べず「PCで遊んでください」が出る。依頼の会話は読める', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('準備完了', { timeout: 30_000 });
  await openModeSelect(page);
  await expect(page.getByTestId('narrow-notice')).toContainText('PCで遊んでください');
  for (const mode of ['1', '2', '3', '4']) {
    await expect(page.getByTestId(`mode-${mode}`)).toBeDisabled();
  }
  // キーでも選べない
  await page.keyboard.press('1');
  await expect(page.getByTestId('story-panel')).toHaveCount(0);

  await page.getByRole('button', { name: '依頼の会話を読む' }).click();
  await expect(page.getByTestId('story-panel')).toContainText('木村');
});

test('会話のあいだに幅が狭くなったら、遊ぶ画面へ進まずモード選択で知らせる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await openModeSelect(page);
  await page.getByTestId('mode-1').click({ timeout: 30_000 });
  await expect(page.getByTestId('story-panel')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByTestId('narrow-notice')).toBeVisible();
  await expect(page.getByTestId('typing-area')).toHaveCount(0);
});
