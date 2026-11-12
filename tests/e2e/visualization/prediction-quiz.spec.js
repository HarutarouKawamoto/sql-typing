import { test, expect } from '@playwright/test';
import { openPlay } from '../helpers/open-play.js';
import { seedProgress } from '../helpers/seed-progress.js';

/** 予想クイズを出す見本のページで、WHERE の見本（30行 → 21行）を開く */
async function openWhereSample(page) {
  await page.goto('/?demo&predict');
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /^WHERE：/ }).click();
  await expect(page.getByTestId('prediction-quiz')).toBeVisible({ timeout: 30_000 });
}

test('見本のページ：結果の行の数を4択で予想し、当たると「当たり！」と段階ごとの行の数が出て、再生が始まる', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWhereSample(page);
  const quiz = page.getByTestId('prediction-quiz');
  await expect(quiz).toContainText('このSQLの結果は何行になる？');
  // 紛らわしい選択肢に、WHERE で減る前の全部の行（30行）が入る
  await expect(quiz.getByRole('button', { name: /行$/ })).toHaveCount(4);
  await expect(page.getByTestId('prediction-choice-30')).toBeVisible();
  // 段階の中で一番多い30行を超える数（正解の倍など）は選択肢にしない
  await expect(page.getByTestId('prediction-choice-42')).toHaveCount(0);
  // 答えるまで再生しない。出たら最初の選択肢にフォーカス
  await expect(page.getByTestId('step-player')).toHaveCount(0);
  await expect(quiz.getByRole('button', { name: /行$/ }).first()).toBeFocused();

  await page.getByTestId('prediction-choice-21').click();
  const result = page.getByTestId('prediction-result');
  await expect(result).toHaveAttribute('data-hit', 'true');
  // 選択肢が消えたら、フォーカスは再生・一時停止のボタンへ
  await expect(page.getByRole('button', { name: /一時停止|再生/ })).toBeFocused();
  await expect(result).toContainText('当たり！ 結果は 21 行');
  await expect(page.getByTestId('prediction-flow')).toHaveText(
    'FROM 30行 → WHERE 21行 → SELECT 21行',
  );
  await expect(page.getByRole('status').filter({ hasText: '当たり' })).toHaveCount(1);
  await expect(page.getByTestId('prediction-quiz')).toHaveCount(0);
  await expect(page.getByTestId('step-player')).toBeVisible();
  expect(errors).toEqual([]);
});

test('見本のページ：外すと「おしい！」と正解・自分の予想。予想しないで再生することもできる', async ({
  page,
}) => {
  await openWhereSample(page);
  await page.getByTestId('prediction-choice-30').click();
  const result = page.getByTestId('prediction-result');
  await expect(result).toHaveAttribute('data-hit', 'false');
  await expect(result).toContainText('おしい！ 結果は 21 行（あなたの予想：30 行）');
  await expect(page.getByTestId('step-player')).toBeVisible();

  // 別の見本に移ると、また予想から
  await page.getByRole('button', { name: /^AS：/ }).click();
  await expect(page.getByTestId('prediction-quiz')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '予想しないで再生する' }).click();
  await expect(page.getByTestId('step-player')).toBeVisible();
  await expect(page.getByTestId('prediction-result')).toHaveCount(0);
});

test('設定で予想クイズを止めると、書く画面のステップ再生にクイズが出ない', async ({ page }) => {
  await seedProgress(page, [], { predictionQuiz: false });
  await openPlay(page, '3');
  const editor = page.getByTestId('sql-editor');
  await expect(page.getByTestId('table-list')).toContainText('products');
  await editor.fill('SELECT * FROM products');
  await editor.focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  await expect(page.getByTestId('step-player')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('prediction-quiz')).toHaveCount(0);
});

test('設定の画面で予想クイズを切り替えると、すぐ保存される', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  const toggle = page.getByTestId('setting-prediction');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sql-typing:progress') ?? 'null'),
  );
  expect(stored.settings.predictionQuiz).toBe(false);
  await page.reload();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('setting-prediction')).not.toBeChecked();
});

test('モード1：キーボードだけで予想して答え合わせができ、続けて Enter を押しても次の問題へ進まない', async ({
  page,
}) => {
  await openPlay(page, '1');
  await expect(page.getByTestId('typing-area')).toBeVisible();
  await page.keyboard.type('SELECT * FROM products');
  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  const quiz = page.getByTestId('prediction-quiz');
  await expect(quiz).toBeVisible({ timeout: 15_000 });
  // 最初の選択肢にフォーカスがあるので、Tab で次へ移って Enter で答える
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const result = page.getByTestId('prediction-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('結果は 30 行');
  await expect(page.getByTestId('prediction-flow')).toHaveText('FROM 30行 → SELECT 30行');
  // フォーカスは再生・一時停止のボタン。Enter はそのボタンを押す（次の問題へは進まない）
  const play = page.getByRole('button', { name: /一時停止|再生/ });
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-player')).toBeVisible();
  await expect(result).toBeVisible();
});
