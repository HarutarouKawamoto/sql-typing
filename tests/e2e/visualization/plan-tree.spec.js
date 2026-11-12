import { test, expect } from '@playwright/test';

test('見本のページ：実行計画の木。テーブルを読む節が下、集計・並べ替えが上。5万行の線は10行の線より太い', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?demo');
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: '上級：実行計画の木（JOIN と集計）' }).click();

  const tree = page.getByTestId('plan-tree');
  await expect(tree).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('plan-tree-rows-read')).toHaveText('50,010行');

  // 根（結果）は一番上、access_logs を読む Seq Scan はそれより下
  const root = page.getByTestId('plan-tree-node').first();
  const logs = page.getByTestId('plan-tree-node').filter({ hasText: 'access_logs' }).first();
  await expect(logs).toContainText('Seq Scan');
  await expect(logs).toContainText('50,000行を返す');
  const rootBox = await root.boundingBox();
  const logsBox = await logs.boundingBox();
  expect(rootBox && logsBox && rootBox.y < logsBox.y).toBe(true);

  // 線の太さ：5万行の線が一番太い
  const widths = await page.getByTestId('plan-tree-edge').evaluateAll((edges) =>
    edges.map((g) => ({
      rows: Number(g.getAttribute('data-rows')),
      width: Number(g.querySelector('path')?.getAttribute('stroke-width')),
    })),
  );
  const big = widths.find((w) => w.rows === 50000);
  const small = widths.find((w) => w.rows === 10);
  expect(big && small && big.width > small.width).toBe(true);

  // 読み上げ用の一覧も同じ中身
  await expect(page.getByRole('list', { name: '実行計画の木（上が結果）' })).toContainText(
    'Seq Scan（全部の行を、上から順に読む）、access_logs l：50,000行を返す',
  );
  expect(errors).toEqual([]);
});

test('見本のページ：実行されなかった節は点線の箱で「実行されなかった」と書き、副問い合わせの線は点線', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?demo');
  await page.getByRole('button', { name: '上級：実行計画の木（実行されなかった節）' }).click();
  await expect(page.getByTestId('plan-tree')).toBeVisible({ timeout: 30_000 });
  const idle = page.locator('[data-testid="plan-tree-node"][data-loops="0"]');
  await expect(idle).toHaveCount(2);
  await expect(idle.first()).toContainText('実行されなかった');
  const dash = (locator) =>
    locator.locator('rect').evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(await dash(idle.first())).not.toBe('none');
  const ran = page.locator('[data-testid="plan-tree-node"][data-loops="1"]').first();
  expect(await dash(ran)).toBe('none');
  // 「実行されなかった」の文字は薄くしない（読めるように）
  const textOpacity = await idle
    .first()
    .locator('text')
    .last()
    .evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(textOpacity).toBe(1);
  // 副問い合わせの線は点線で、「副問い合わせ」と書く
  const sub = page.locator('[data-testid="plan-tree-edge"][data-subplan="true"]');
  await expect(sub).toHaveCount(1);
  await expect(sub).toContainText('副問い合わせ');
  expect(await sub.locator('path').evaluate((el) => getComputedStyle(el).strokeDasharray)).not.toBe(
    'none',
  );
  await expect(page.getByRole('status')).toHaveText(/テーブルから 0 行を読みました/);
  expect(errors).toEqual([]);
});
