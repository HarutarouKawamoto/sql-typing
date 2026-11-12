import { test, expect } from '@playwright/test';

/** @param {import('@playwright/test').Page} page */
async function openDemo(page) {
  await page.goto('/?demo');
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: '上級：トランザクション（在庫1個に2人が注文）' }).click();
  await expect(page.getByTestId('tx-timeline')).toBeVisible({ timeout: 30_000 });
}

test('鍵なし：ボタンで1つずつ進め、両方が先に在庫を読むと売りすぎになる', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDemo(page);
  const stepA = page.getByTestId('tx-step-A');
  const stepB = page.getByTestId('tx-step-B');

  // BEGIN・在庫を読む（A・B 交互）→ A の UPDATE で鍵 → B の UPDATE は待つ
  for (const step of [stepA, stepB, stepA, stepB, stepA, stepB]) await step.click();
  const events = page.getByTestId('tx-event');
  await expect(events).toHaveCount(6);
  await expect(events.nth(2)).toContainText('在庫 1 が見えた');
  await expect(events.nth(3)).toContainText('在庫 1 が見えた');
  await expect(events.nth(5)).toHaveAttribute('data-kind', 'wait');
  await expect(events.nth(5)).toContainText('待っている');
  await expect(stepB).toBeDisabled();
  await expect(page.getByTestId('tx-lock')).toHaveText('A（Aiko） が持っている');
  // A が終わると B の UPDATE が進み、B も終わると在庫 -1・注文2つ
  await stepA.click();
  await stepA.click();
  await expect(events.last()).toHaveAttribute('data-kind', 'resume');
  await expect(page.getByTestId('tx-stock')).toHaveText('0');
  await stepB.click();
  await stepB.click();
  await expect(page.getByTestId('tx-stock')).toHaveText('-1');
  await expect(page.getByTestId('tx-orders')).toHaveText('2');
  await expect(page.getByTestId('tx-outcome')).toContainText('売りすぎ');
  await expect(page.getByRole('status')).toContainText('売りすぎ');
  await expect(stepA).toBeDisabled();
  expect(errors).toEqual([]);
});

test('FOR UPDATE：同じ順でも、後から読む方は待ち、在庫 0 を見て注文をやめる', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '鍵あり（SELECT ... FOR UPDATE）' }).click();
  await expect(
    page.getByRole('button', { name: '鍵あり（SELECT ... FOR UPDATE）' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /両方が先に在庫を読む順/ }).click();
  const events = page.getByTestId('tx-event');
  const waitRow = events.and(page.locator('[data-kind="wait"]'));
  await expect(waitRow).toHaveCount(1);
  await expect(waitRow).toHaveAttribute('data-step', 'read');
  await expect(waitRow).toContainText('FOR UPDATE');
  await expect(page.getByTestId('tx-stock')).toHaveText('0');
  await expect(page.getByTestId('tx-orders')).toHaveText('1');
  await expect(page.getByTestId('tx-outcome')).toContainText('守れた');
  await expect(page.getByTestId('tx-outcome')).toContainText(
    'B（Ben） は在庫 0 を見て注文をやめました',
  );

  // やり直すと最初にもどる（場面はそのまま）
  await page.getByRole('button', { name: 'やり直す' }).click();
  await expect(events).toHaveCount(0);
  await expect(page.getByText('まだ何も実行していません')).toBeVisible();
  await expect(page.getByTestId('tx-step-A')).toBeEnabled();
});

test('キーボード：ボタンには次の SQL・待っている理由が説明として付き、押せなくなるともう片方へフォーカスが移る。幅375pxで横にはみ出さない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openDemo(page);
  const stepA = page.getByTestId('tx-step-A');
  const stepB = page.getByTestId('tx-step-B');
  await expect(stepA).toHaveAccessibleDescription('BEGIN');
  for (const step of [stepA, stepB, stepA, stepB, stepA]) {
    await step.focus();
    await page.keyboard.press('Enter');
  }
  // B の UPDATE は待つ → B のボタンは押せなくなり、フォーカスは A へ
  await stepB.focus();
  await page.keyboard.press('Enter');
  await expect(stepB).toBeDisabled();
  await expect(stepB).toHaveAccessibleDescription(/待っている/);
  await expect(stepA).toBeFocused();
  await expect(page.getByRole('status')).toContainText('待っている（A が行の鍵を持っている）');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
