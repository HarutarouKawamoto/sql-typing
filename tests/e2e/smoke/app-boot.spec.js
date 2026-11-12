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

test('公開する HTML には Content Security Policy が入り、見本のページ（Worker・WebAssembly・図）でも違反が起きない', async ({
  page,
}) => {
  // 違反はコンソールに出ない環境もあるので、ページの中の securitypolicyviolation の知らせを集める
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await page.goto('/?demo');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /^JOIN：/ }).click();
  await expect(page.getByTestId('step-title')).toContainText('段階 1/', { timeout: 30_000 });
  await page.getByRole('button', { name: '上級：実行計画の木（JOIN と集計）' }).click();
  await expect(page.getByTestId('plan-tree')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});
