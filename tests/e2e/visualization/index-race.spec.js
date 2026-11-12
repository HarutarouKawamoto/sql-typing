import { test, expect } from '@playwright/test';

test('見本のページ：インデックスなしは5万行を全部読み、ありは1行。カウンターが増えて、読み方の一言が出る', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?demo');
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /^上級：インデックス/ }).click();

  const before = page.getByTestId('race-before');
  const after = page.getByTestId('race-after');
  await expect(before).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('race-before-rows')).toHaveAttribute('data-rows', '50000');
  await expect(page.getByTestId('race-after-rows')).toHaveAttribute('data-rows', '1');
  // カウンターは 1.2 秒で最後の数になる
  await expect(page.getByTestId('race-before-rows')).toHaveText('50,000');
  await expect(before).toContainText('Seq Scan');
  await expect(before).toContainText('全部の行を、上から順に読む');
  await expect(after).toContainText('索引');
  await expect(page.getByTestId('index-race')).toContainText('50,000 → 1 行');
  expect(errors).toEqual([]);
});
