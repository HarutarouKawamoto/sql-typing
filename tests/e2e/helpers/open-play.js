import { expect } from '@playwright/test';

/**
 * 一覧から問題を選び、モードを選んで、依頼の会話を飛ばし、遊ぶ画面を開く。
 * 1問目以外は、先に seed-progress.js で開いた状態にしておく。
 * @param {import('@playwright/test').Page} page
 * @param {'1' | '2' | '3' | '4'} mode
 * @param {string} [problemId]
 */
export async function openPlay(page, mode, problemId = 'beginner-01') {
  await page.goto('/');
  await openModeSelect(page, problemId);
  const button = page.getByTestId(`mode-${mode}`);
  // データベースの準備ができるまで、モードは選べない
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await page.getByRole('button', { name: 'スキップ' }).click();
}

/**
 * 一覧（今いるページ）から問題のモード選択を開く。
 * @param {import('@playwright/test').Page} page
 * @param {string} [problemId]
 */
export async function openModeSelect(page, problemId = 'beginner-01') {
  const problem = page.getByTestId(`problem-${problemId}`);
  await expect(problem).toBeEnabled();
  await problem.click();
  await expect(page.getByTestId('mode-1')).toBeVisible();
}

/**
 * ステップ再生の前の予想クイズ（見える化D。設定の既定で出る）を、予想しないで飛ばす。
 * @param {import('@playwright/test').Page} page
 */
export async function skipPrediction(page) {
  await page.getByRole('button', { name: '予想しないで再生する' }).click({ timeout: 15_000 });
}

/** 一覧が出ているか（遊ぶ画面から Esc でもどったあとなど） */
export const homeProblem = (page) => page.getByTestId('problem-beginner-01');
