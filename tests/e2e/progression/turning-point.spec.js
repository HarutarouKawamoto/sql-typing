import { test, expect } from '@playwright/test';
import { BEFORE_TURNING_POINT, seedProgress } from '../helpers/seed-progress.js';

const turningPoint = (page) => page.getByTestId('problem-beginner-09');

test('8問目までクリアすると、ターニングポイントが開く。印とモード選択の説明が出る', async ({
  page,
}) => {
  await seedProgress(page, BEFORE_TURNING_POINT);
  await page.goto('/');
  await expect(turningPoint(page)).toBeEnabled();
  await expect(turningPoint(page)).toContainText('ターニングポイント');
  await turningPoint(page).click();
  await expect(page.getByRole('heading', { name: 'セール前夜のリスト' })).toBeVisible();
  await expect(page.getByText('モード3・4でクリアすると、次の章が開きます')).toBeVisible();
});

test('7問目までだと、ターニングポイントはまだ開いていない', async ({ page }) => {
  await seedProgress(page, BEFORE_TURNING_POINT.slice(0, 7));
  await page.goto('/');
  await expect(page.getByTestId('problem-beginner-08')).toBeEnabled();
  await expect(turningPoint(page)).toBeDisabled();
});

test('ターニングポイントの会話は11行あり、モード1でクリアすると反応の会話が出る（次の章はまだないので Enter・J は何もしない）', async ({
  page,
}) => {
  await seedProgress(page, BEFORE_TURNING_POINT);
  await page.goto('/');
  await turningPoint(page).click();
  await expect(page.getByTestId('mode-1')).toBeEnabled({ timeout: 30_000 });
  await page.keyboard.press('1');
  const panel = page.getByTestId('story-panel');
  // 会話は問題を読み込んでから出る。出る前の Enter は届かないので、1行目が出るのを待つ
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  for (let shown = 2; shown <= 11; shown += 1) {
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('listitem')).toHaveCount(shown);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('typing-area')).toBeVisible();

  // 表示用SQLは句ごとの改行。区切りは Space でも Enter でも打てる
  await page.keyboard.type(
    "SELECT name AS item, category, price FROM products WHERE stock > 0 AND supplier IS NOT NULL AND category IN ('kitchen', 'interior') AND price BETWEEN 1000 AND 5000 ORDER BY price DESC LIMIT 5",
  );
  const after = page.getByTestId('after-story');
  await expect(after).toContainText('一発で出た');
  await expect(page.getByTestId('result-table')).toContainText('5行');
  await expect(after.getByRole('button', { name: '次の問題はまだありません' })).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.keyboard.press('j');
  await expect(after).toBeVisible();
  await expect(page.getByTestId('typing-area')).toBeVisible();
});
