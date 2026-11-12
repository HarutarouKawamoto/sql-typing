import { test, expect } from '@playwright/test';
import { homeProblem } from '../helpers/open-play.js';

/** 一覧から用語辞典を開く */
async function openDictionary(page) {
  await page.goto('/');
  await page.getByTestId('open-dictionary').click();
  await expect(page.getByRole('heading', { name: '用語辞典' })).toBeVisible();
  await expect(page.getByTestId('dict-SELECT')).toBeVisible();
}

test('一覧から開くと初級の16語・中級の20語・上級の10語が並び、初めて出てくる問題からモード選択へ行ける', async ({
  page,
}) => {
  await openDictionary(page);
  await expect(page.getByRole('heading', { name: '初級（16語）' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: '初級（16語）' }).locator('article[data-testid^="dict-"]'),
  ).toHaveCount(16);
  await expect(page.getByRole('heading', { name: '中級（20語）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '上級（10語）' })).toBeVisible();
  await expect(page.getByTestId('dict-FOR-UPDATE')).toContainText('在庫を読むときに鍵をかける');

  const where = page.getByTestId('dict-WHERE');
  await expect(where).toContainText('〜のところで');
  await expect(where).toContainText('条件に合う行だけを残す');
  await expect(where).toContainText('1000円以上の商品（まだ開いていません）');
  await expect(page.getByTestId('dict-IS-NOT-NULL')).toContainText('セール前夜のリスト');
  await expect(page.getByTestId('dict-ASC')).toContainText('問題にはまだ出てきません');

  await page.getByTestId('dict-SELECT').getByRole('button', { name: '在庫表を見せて' }).click();
  await expect(page.getByTestId('mode-1')).toBeVisible();
  await expect(page.getByRole('heading', { name: '在庫表を見せて' })).toBeVisible();
});

test('Esc で一覧へもどる', async ({ page }) => {
  await openDictionary(page);
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});

test.describe('幅375px（タッチ）', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('用語辞典を見られ、例のキーワードをタップすると説明が出る。もう一度タップで消える', async ({
    page,
  }) => {
    await openDictionary(page);
    const keyword = page.getByTestId('dict-WHERE').locator('[data-keyword="WHERE"]');
    await keyword.tap();
    const tip = page.getByTestId('keyword-tip');
    await expect(tip).toContainText('条件に合う行だけを残す');
    await keyword.tap();
    await expect(tip).toHaveCount(0);
  });
});
