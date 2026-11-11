import { test, expect } from '@playwright/test';
import { openModeSelect, openPlay } from '../helpers/open-play.js';

/** 一覧から1問目の打って選ぶを始める */
async function startMode2(page) {
  await openPlay(page, '2');
  await expect(page.getByTestId('typing-area')).toBeVisible();
}

const choice = (page, text) =>
  page.getByTestId('choice-list').getByRole('listitem').filter({ hasText: text });

test('空欄は「？」で隠れ、空欄に来ると選択肢が出る。正解を打ち切るとクリアになり、記録が残る', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startMode2(page);

  // 空欄の答えは見えない
  await expect(page.getByTestId('typing-area')).not.toContainText('FROM');
  await expect(page.getByTestId('blank-box')).toBeVisible();
  await expect(page.getByTestId('choice-list')).toHaveCount(0);

  await page.keyboard.type('select * ');
  await expect(page.getByTestId('blank-box')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('choice-list').getByRole('listitem')).toHaveCount(3);

  await page.keyboard.type('from products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('typing-area')).toContainText('SELECT * FROM products');
  await expect(page.getByTestId('result-wrong-choices')).toHaveText('0 回');
  await expect(page.getByTestId('rank')).toHaveText(/^[SABC]$/);
  await expect(page.getByTestId('result-table')).toContainText('30行');

  await page.keyboard.press('Escape');
  await openModeSelect(page);
  await expect(page.getByTestId('best-mode2')).toContainText('文字/分');
  expect(errors).toEqual([]);
});

test('打った文字に合う候補だけが光り、どれにも合わないキーは進まない', async ({ page }) => {
  await startMode2(page);
  await page.keyboard.type('SELECT * ');
  await page.keyboard.press('J');
  await expect(choice(page, 'JOIN products')).toHaveAttribute('data-state', 'candidate');
  await expect(choice(page, 'FROM products')).toHaveAttribute('data-state', 'out');
  await page.keyboard.press('x');
  await expect(page.getByTestId('meter')).not.toContainText('正確さ 100%');
  await expect(choice(page, 'JOIN products')).toHaveAttribute('data-state', 'candidate');
});

test('間違いを打ち切ると理由が出て打ち消し線になり、空欄を最初からやり直して正解できる', async ({
  page,
}) => {
  await startMode2(page);
  await page.keyboard.type('SELECT * INTO products');
  await expect(page.getByTestId('choice-why')).toContainText('INTO は INSERT');
  await expect(choice(page, 'INTO products')).toHaveAttribute('data-state', 'rejected');
  // 選んだ間違いはもう選べない
  await expect(page.getByTestId('blank-box')).toHaveAttribute('data-active', 'true');

  await page.keyboard.type('FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('result-wrong-choices')).toHaveText('1 回');
});

test('クリアのあとステップ再生を見られ、R でもう一度（空欄はまた隠れる）', async ({ page }) => {
  await startMode2(page);
  await page.keyboard.type('SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  await expect(page.getByTestId('step-player')).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.getByTestId('blank-box')).toBeVisible();
  await expect(page.getByTestId('meter')).toContainText('0.0秒');
});
