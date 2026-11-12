import { test, expect } from '@playwright/test';
import { openPlay, skipPrediction } from '../helpers/open-play.js';
import { seedProgress } from '../helpers/seed-progress.js';

test('モード1：打つSQLの WHERE にカーソルを当てると説明が出て、キーを押すと消える', async ({
  page,
}) => {
  await seedProgress(page, [
    { problemId: 'beginner-01', mode: '1' },
    { problemId: 'beginner-02', mode: '1' },
  ]);
  await openPlay(page, '1', 'beginner-03');
  const tip = page.getByTestId('keyword-tip');
  await expect(tip).toHaveCount(0);

  await page.getByTestId('typing-area').locator('[data-keyword="WHERE"]').first().hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('WHERE');
  await expect(tip).toContainText('条件に合う行だけを残す');

  // 打ち始めたら消える（タイピング中に出たままにしない）
  await page.keyboard.press('s');
  await expect(tip).toHaveCount(0);
  await expect(page.getByTestId('typing-area').locator('[data-state="typed"]')).toHaveCount(1);
});

test('マウスを WHERE に置いたまま打ち、間違えても、説明は勝手にもどらない。マウスを動かすとまた出る', async ({
  page,
}) => {
  await seedProgress(page, [
    { problemId: 'beginner-01', mode: '1' },
    { problemId: 'beginner-02', mode: '1' },
  ]);
  await openPlay(page, '1', 'beginner-03');
  const tip = page.getByTestId('keyword-tip');
  const where = page.getByTestId('typing-area').locator('[data-keyword="WHERE"]').first();
  await where.hover();
  await expect(tip).toBeVisible();

  // 打つ・間違える（間違えると文字の要素が作り直され、ブラウザが「当てた」をもう一度送ってくる）
  await page.keyboard.press('s');
  await page.keyboard.press('x');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  await expect(tip).toHaveCount(0);

  // マウスを実際に動かすと、また出る
  const box = await where.boundingBox();
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
  await expect(tip).toBeVisible();
});

test('マウスのクリックでは、出ている説明を消さない', async ({ page }) => {
  await openPlay(page, '1');
  const select = page.getByTestId('typing-area').locator('[data-keyword="SELECT"]').first();
  await select.hover();
  const tip = page.getByTestId('keyword-tip');
  await expect(tip).toBeVisible();
  await select.click();
  await expect(tip).toBeVisible();
});

test('モード2：埋まっていない空欄があるあいだは、打つSQLで説明を出さない（例から答えがわからないように）', async ({
  page,
}) => {
  await openPlay(page, '2');
  const area = page.getByTestId('typing-area');
  await expect(area).toContainText('SELECT');
  await expect(area.locator('[data-keyword]')).toHaveCount(0);
  await area.getByText('S', { exact: true }).first().hover();
  await expect(page.getByTestId('keyword-tip')).toHaveCount(0);
});

test('ステップ再生のSQLでも、キーワードにカーソルを当てると説明が出る', async ({ page }) => {
  await openPlay(page, '4');
  await expect(page.getByTestId('table-list')).toContainText('products');
  const editor = page.getByTestId('sql-editor');
  await editor.fill('SELECT name FROM products WHERE price > 1000');
  await editor.focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('judge-panel')).toHaveAttribute('data-status', 'wrong');
  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  await skipPrediction(page);

  await page.getByTestId('step-player').locator('[data-keyword="FROM"]').hover();
  const tip = page.getByTestId('keyword-tip');
  await expect(tip).toContainText('どのテーブルから読むか');
  // 離れたら消える
  await page.getByRole('heading', { name: /ステップ再生/ }).hover();
  await expect(tip).toHaveCount(0);

  // キーボードで語に移っても出る（説明は語の aria-describedby で結ぶ）
  const where = page.getByTestId('step-player').locator('[data-keyword="WHERE"]');
  // キーボードを使っているときのフォーカス（:focus-visible）にするため、先にキーを押す
  await page.keyboard.press('Shift');
  await where.focus();
  await expect(tip).toContainText('条件に合う行だけを残す');
  await expect(where).toHaveAttribute('aria-describedby', 'keyword-tip');
});
