import { test, expect } from '@playwright/test';
import { openPlay } from '../helpers/open-play.js';
import { advancedUpTo, seedProgress } from '../helpers/seed-progress.js';

/**
 * 書く画面の入力欄に SQL を入れて Ctrl+Enter で実行する。
 * 正解の結果ができるまで実行は受け付けられない（上級は5万行を入れ直すので数秒かかる）ので、使えるテーブルが出るのを待つ
 */
async function run(page, sql) {
  await expect(page.getByTestId('table-list')).toContainText('access_logs', { timeout: 30_000 });
  const editor = page.getByTestId('sql-editor');
  await editor.fill(sql);
  await editor.focus();
  await page.keyboard.press('Control+Enter');
}

const judgeStatus = (page) => page.getByTestId('judge-panel');

test('一覧に上級の12問が出て、最後がターニングポイント。中級のターニングポイントを書いてクリアすると開く', async ({
  page,
}) => {
  await seedProgress(page, advancedUpTo(0));
  await page.goto('/');
  const chapter = page.getByRole('region', { name: '上級 セール当日を乗り切る' });
  await expect(chapter.locator('[data-testid^="problem-advanced-"]')).toHaveCount(12);
  await expect(page.getByTestId('problem-advanced-12')).toContainText('ターニングポイント');
  await expect(page.getByTestId('problem-advanced-01')).toBeEnabled();
});

test('インデックスの問題：違う列では不正解、session_id に作るとクリアし、5万行 → 1行の比較が出る', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedProgress(page, advancedUpTo(7));
  await openPlay(page, '4', 'advanced-08');

  await run(page, 'CREATE INDEX ON access_logs (customer_id)');
  await expect(judgeStatus(page)).toHaveAttribute('data-status', 'wrong', { timeout: 30_000 });
  // 関係のない列の索引では、読む行は減らない
  await expect(page.getByTestId('race-after-rows')).toHaveAttribute('data-rows', '50000', {
    timeout: 30_000,
  });

  await run(page, 'CREATE INDEX idx_session ON access_logs (session_id)');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('race-after-rows')).toHaveAttribute('data-rows', '1', {
    timeout: 30_000,
  });
});

test('実行計画の問題：実行すると、書いた SELECT の実行計画の木が出る', async ({ page }) => {
  test.setTimeout(120_000);
  await seedProgress(page, advancedUpTo(6));
  await openPlay(page, '4', 'advanced-07');
  await run(
    page,
    'SELECT c.region, count(*) AS visits FROM access_logs l JOIN customers c ON c.id = l.customer_id GROUP BY c.region ORDER BY visits DESC, c.region',
  );
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('plan-tree')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator('[data-testid="plan-tree-node"]').filter({ hasText: 'access_logs' }).first(),
  ).toContainText('50,000行を返す');
});

test('テーブルを作る問題：列の順が違っても、型と制約が同じならクリア', async ({ page }) => {
  test.setTimeout(120_000);
  await seedProgress(page, advancedUpTo(8));
  await openPlay(page, '4', 'advanced-09');
  await run(
    page,
    'CREATE TABLE coupons (code TEXT PRIMARY KEY, discount INTEGER NOT NULL, expires_on DATE NOT NULL)',
  );
  await expect(judgeStatus(page)).toHaveAttribute('data-status', 'wrong', { timeout: 30_000 });
  await run(
    page,
    'CREATE TABLE coupons (expires_on DATE NOT NULL, code TEXT PRIMARY KEY, discount INTEGER NOT NULL CHECK (discount >= 1 AND discount <= 50))',
  );
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 30_000 });
});

test('ターニングポイント：在庫の条件がないと不正解、あればクリア。タイムラインの「1文で確かめて減らす」で守れる', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seedProgress(page, advancedUpTo(11));
  await openPlay(page, '4', 'advanced-12');
  await run(
    page,
    'UPDATE products p SET stock = p.stock - i.quantity FROM order_items i WHERE i.product_id = p.id AND i.order_id = 19',
  );
  await expect(judgeStatus(page)).toHaveAttribute('data-status', 'wrong', { timeout: 30_000 });
  // タイムラインは、1回実行したあとは出したまま
  const timeline = page.getByTestId('tx-timeline');
  await expect(timeline).toBeVisible();

  await run(
    page,
    'UPDATE products p SET stock = p.stock - i.quantity FROM order_items i WHERE i.product_id = p.id AND i.order_id = 19 AND p.stock >= i.quantity',
  );
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('after-story')).toContainText('同時に来ても割り込まれない');

  await timeline
    .getByRole('button', { name: '1文で確かめて減らす（UPDATE ... AND stock > 0）' })
    .click();
  await timeline.getByRole('button', { name: /両方がほぼ同時に UPDATE する順/ }).click();
  await expect(page.getByTestId('tx-outcome')).toContainText('守れた');
  await expect(page.getByTestId('tx-outcome')).toContainText('UPDATE の WHERE');
});
