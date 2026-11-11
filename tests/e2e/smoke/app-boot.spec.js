import { test, expect } from '@playwright/test';

test('トップページを開くとタイトルが見え、画面のエラーが起きない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'SQL Typing' })).toBeVisible();
  expect(errors).toEqual([]);
});
