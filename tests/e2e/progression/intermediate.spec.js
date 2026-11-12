import { test, expect } from '@playwright/test';
import { openModeSelect, openPlay } from '../helpers/open-play.js';
import { intermediateUpTo, seedProgress } from '../helpers/seed-progress.js';

test('一覧に中級の13問が出て、最後がターニングポイント', async ({ page }) => {
  await page.goto('/');
  const chapter = page.getByRole('region', { name: '中級 月次レポートを任される' });
  await expect(chapter.locator('[data-testid^="problem-intermediate-"]')).toHaveCount(13);
  await expect(page.getByTestId('problem-intermediate-13')).toContainText('ターニングポイント');
});

test('UPDATE の問題：WHERE を付け忘れると不正解、付ければクリア', async ({ page }) => {
  await seedProgress(page, intermediateUpTo(10));
  await openPlay(page, '4', 'intermediate-11');
  await expect(page.getByTestId('table-list')).toContainText('customers');
  const editor = page.getByTestId('sql-editor');

  await editor.fill('UPDATE products SET price = price * 9 / 10');
  await editor.focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('judge-panel')).toHaveAttribute('data-status', 'wrong', {
    timeout: 15_000,
  });

  await editor.fill("UPDATE products SET price = price * 9 / 10 WHERE category = 'kitchen'");
  await editor.focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('after-story')).toContainText('WHERE、大事だな');
});

test('中級の問題の DBの地図：4つのテーブルと3本のつながりの線', async ({ page }) => {
  await seedProgress(page, intermediateUpTo(3));
  await page.goto('/');
  await openModeSelect(page, 'intermediate-04');
  await page.getByTestId('schema-map').getByText('DBの地図を見る').click();
  for (const table of ['customers', 'orders', 'order_items', 'products']) {
    await expect(page.getByTestId(`schema-table-${table}`)).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  // 中級で新しく増えたテーブルには NEW の印
  await expect(page.getByTestId('schema-table-orders')).toHaveAttribute('data-new', 'true');
  await expect(page.getByTestId('schema-table-products')).toHaveAttribute('data-new', 'false');
});
