import { test, expect } from '@playwright/test';
import { openModeSelect, openPlay } from '../helpers/open-play.js';

/** 「DBの地図を見る」を開く */
async function openMap(page) {
  const map = page.getByTestId('schema-map');
  await map.getByText('DBの地図を見る').click();
  await expect(page.getByTestId('schema-table-products')).toBeVisible({ timeout: 30_000 });
  return map;
}

test('モード選択から地図を開くと、products の箱に列と型が出る。押すと先頭20行と全部の行数', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await openModeSelect(page);
  await openMap(page);

  const box = page.getByTestId('schema-table-products');
  for (const column of ['id', 'name', 'category', 'price', 'stock', 'supplier', 'released_on']) {
    await expect(box).toContainText(column);
  }
  await expect(box).toContainText('PK');
  await expect(box).toContainText('date');
  // 初級で新しく増えたテーブル。モード選択では光らせない（モード4の答えのヒントにしない）
  await expect(box).toHaveAttribute('data-new', 'true');
  await expect(box).toHaveAttribute('data-touched', 'false');

  await box.click();
  const preview = page.getByTestId('schema-preview');
  await expect(preview).toContainText('全30行のうち先頭20行');
  await expect(preview.getByTestId('result-table')).toContainText('20行');
  await expect(preview).toContainText('Mug Cup Blue');
  expect(errors).toEqual([]);
});

test('「中身を見る」のボタンでも中身が出る。そのあとモードを選んで遊べる', async ({ page }) => {
  await page.goto('/');
  await openModeSelect(page);
  await openMap(page);
  await page.getByTestId('schema-open-products').click();
  await expect(page.getByTestId('schema-open-products')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('schema-preview')).toContainText('products');

  // 地図を読むために DB を準備し直しても、遊ぶ画面はふつうに始まる
  await page.getByTestId('mode-1').click();
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByTestId('typing-area')).toBeVisible();
});

test('モード1：地図を開くと、表示用SQLが使う products が光っている', async ({ page }) => {
  await openPlay(page, '1');
  await openMap(page);
  await expect(page.getByTestId('schema-table-products')).toHaveAttribute('data-touched', 'true');
  await expect(page.getByTestId('schema-map')).toContainText('このSQLが使っているテーブル');
});

test('モード4：書く前は光らず、FROM products を書くと光り、消すとまた消える', async ({ page }) => {
  await openPlay(page, '4');
  await expect(page.getByTestId('table-list')).toContainText('products');
  await openMap(page);
  const box = page.getByTestId('schema-table-products');
  await expect(box).toHaveAttribute('data-touched', 'false');
  await page.getByTestId('sql-editor').fill('SELECT * FROM products');
  await expect(box).toHaveAttribute('data-touched', 'true');
  await expect(box).toContainText('使用中');
  await page.getByTestId('sql-editor').fill('');
  await expect(box).toHaveAttribute('data-touched', 'false');
});

test('モード1：地図を開いて箱を押したあとも、そのまま打てる（地図がキーを奪わない）', async ({
  page,
}) => {
  await openPlay(page, '1');
  await openMap(page);
  const box = page.getByTestId('schema-table-products');
  await box.click();
  await expect(page.getByTestId('schema-preview')).toContainText('products');
  // Backspace・矢印・Delete は打つキーではないが、地図の箱を消したり動かしたりしない
  await page.keyboard.type('SELECT');
  for (const key of ['Backspace', 'ArrowLeft', 'ArrowDown', 'Delete']) {
    await page.keyboard.press(key);
  }
  await page.keyboard.type(' * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(box).toBeVisible();
});

test('モード2：空欄の答えにあるテーブルは光らせない（1問目は FROM products が空欄）', async ({
  page,
}) => {
  await openPlay(page, '2');
  await openMap(page);
  await expect(page.getByTestId('schema-table-products')).toHaveAttribute('data-touched', 'false');
});

test.describe('幅375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('遊べない画面でも、モード選択から地図と中身を見られる', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('準備完了', { timeout: 30_000 });
    await openModeSelect(page);
    await expect(page.getByTestId('narrow-notice')).toBeVisible();
    await openMap(page);
    await page.getByTestId('schema-open-products').click();
    await expect(page.getByTestId('schema-preview')).toContainText('全30行');
  });
});
