import { test, expect } from '@playwright/test';
import { homeProblem, openPlay, skipPrediction } from '../helpers/open-play.js';

/** 1問目をなぞり書きでクリアして、ステップ再生を開く */
async function openReplay(page) {
  await openPlay(page, '1');
  // 問題を読み込み終えて入力エリアが出てから打つ（読み込み中のキーは捨てられる）
  await expect(page.getByTestId('typing-area')).toBeVisible();
  await page.keyboard.type('SELECT * FROM products');
  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  await skipPrediction(page);
  await expect(page.getByTestId('step-player')).toBeVisible();
}

test('クリアの結果からステップ再生を開き、実行順に FROM → SELECT と進む', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openReplay(page);

  // 自動再生で最後の段階まで進んで止まる
  await expect(page.getByTestId('step-title')).toContainText('段階 2/2：SELECT', {
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: '▶ 再生' })).toBeVisible();

  // ← で FROM に戻ると、全30行・全部の列
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('step-title')).toContainText('段階 1/2：FROM');
  await expect(page.getByTestId('step-table')).toContainText('30行');
  await expect(page.getByTestId('step-table')).toContainText('released_on');

  // 実行順の番号：FROM が 1、SELECT が 2。今の句（FROM）が光る
  await expect(page.locator('[data-active="true"]')).toContainText('FROM products');
  await expect(page.locator('[data-active="true"]')).toContainText('1');

  // ボタンでも進める
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByTestId('step-title')).toContainText('段階 2/2：SELECT');
  await expect(page.locator('[data-active="true"]')).toContainText('SELECT *');
  expect(errors).toEqual([]);
});

test('最後の段階まで見たことが学習記録に残る', async ({ page }) => {
  await openReplay(page);
  await expect(page.getByTestId('step-title')).toContainText('段階 2/2', { timeout: 10_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('sql-typing:progress') ?? '{}').problems?.['beginner-01']
            ?.stepReplayFinished,
      ),
    )
    .toBe(true);
});

test('ボタンにフォーカスして Enter を押すと、そのボタンが押される（もう一度にならない）', async ({
  page,
}) => {
  await openPlay(page, '1');
  await expect(page.getByTestId('typing-area')).toBeVisible();
  await page.keyboard.type('SELECT * FROM products');

  await page.getByRole('button', { name: /ステップ再生を見る/ }).focus();
  await page.keyboard.press('Enter');
  // 予想クイズが出て、最初の選択肢にフォーカスが移る。「予想しないで再生する」も Enter で押す
  await page.getByRole('button', { name: '予想しないで再生する' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-player')).toBeVisible();
  await expect(page.getByTestId('step-title')).toContainText('段階 2/2', { timeout: 10_000 });

  await page.getByRole('button', { name: '戻る' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-title')).toContainText('段階 1/2');
  await expect(page.getByTestId('step-player')).toBeVisible();
});

test('ステップ再生を開いても、R でもう一度・Esc でもどるは効く', async ({ page }) => {
  await openReplay(page);
  await page.keyboard.press('r');
  await expect(page.getByTestId('step-player')).toHaveCount(0);
  await expect(page.getByTestId('result-table')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});
