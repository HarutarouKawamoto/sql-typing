import { test, expect } from '@playwright/test';
import { openPlay } from '../helpers/open-play.js';
import { BEFORE_TURNING_POINT, seedProgress } from '../helpers/seed-progress.js';

/*
 * 打っている途中に入力欄の大きさが変わらない（本人の指摘。2026-11-12）。
 * 改行の区切りが今の位置のとき、次の行が前の行の後ろに付いて形が変わっていた。
 */

const sizeOf = async (page) => {
  const box = await page.getByTestId('typing-area').boundingBox();
  return `${Math.round(box.width)}x${Math.round(box.height)}`;
};

test('モード1：改行のある問題（7問目）を1文字ずつ打っても、入力欄の大きさが変わらない', async ({
  page,
}) => {
  await seedProgress(page, BEFORE_TURNING_POINT.slice(0, 6));
  await openPlay(page, '1', 'beginner-07');
  await expect(page.getByTestId('typing-area')).toBeVisible();
  const sizes = new Set([await sizeOf(page)]);
  for (const key of 'SELECT name, price FROM products ORDER BY price DESC LIMIT 5') {
    await page.keyboard.press(key === ' ' ? 'Space' : key);
    sizes.add(await sizeOf(page));
  }
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  expect([...sizes]).toHaveLength(1);
});

test('モード2：空欄（4問目）が埋まっても、入力欄の大きさが変わらない', async ({ page }) => {
  await seedProgress(page, BEFORE_TURNING_POINT.slice(0, 3));
  await openPlay(page, '2', 'beginner-04');
  await expect(page.getByTestId('typing-area')).toBeVisible();
  const before = await sizeOf(page);
  await page.keyboard.type(
    "SELECT name, stock FROM products WHERE category = 'kitchen' AND stock < 5",
  );
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  expect(await sizeOf(page)).toBe(before);
});

test('打っている途中に依頼の会話を開いて見られ、開いたまま打ち続けられる（Space で閉じない）', async ({
  page,
}) => {
  await openPlay(page, '1');
  const request = page.getByTestId('request-story');
  await expect(request).not.toHaveAttribute('open');
  await request.getByText('依頼の会話を見る').click();
  await expect(request).toHaveAttribute('open');
  await expect(request).toContainText('商品の一覧を全部見せてくれる？');
  await page.keyboard.type('SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(request).toHaveAttribute('open');
});

test('今の位置の印：空白の区切りは背景の色だけ（重ねる印なし）、改行の区切りには重ねる印が出る', async ({
  page,
}) => {
  await seedProgress(page, BEFORE_TURNING_POINT.slice(0, 6));
  await openPlay(page, '1', 'beginner-07');
  const area = page.getByTestId('typing-area');
  await expect(area).toBeVisible();
  const currentMarker = () =>
    area.locator('[data-state="current"]').evaluate((element) => ({
      text: element.textContent,
      marker: getComputedStyle(element, '::after').content,
    }));

  await page.keyboard.type('SELECT');
  expect(await currentMarker()).toEqual({ text: ' ', marker: 'none' });
  // 「SELECT name, price」の行の終わり（次は改行）
  await page.keyboard.type(' name, price');
  expect(await currentMarker()).toEqual({ text: '\n', marker: '""' });
});
