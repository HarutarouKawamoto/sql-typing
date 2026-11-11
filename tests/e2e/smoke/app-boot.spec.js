import { test, expect } from '@playwright/test';

test('トップページを開くとタイトルが見え、画面のエラーが起きない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'SQL Typing' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ビルドしたものの上で PGlite が Worker の中で起動し、初級の初期データが入る', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('データベース：準備完了（products 30行）', {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});
