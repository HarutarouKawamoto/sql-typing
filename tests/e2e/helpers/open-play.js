import { expect } from '@playwright/test';

/**
 * 一覧から1問目を選び、モードを選んで、依頼の会話を飛ばし、遊ぶ画面を開く。
 * @param {import('@playwright/test').Page} page
 * @param {'1' | '2' | '3' | '4'} mode
 */
export async function openPlay(page, mode) {
  await page.goto('/');
  await openModeSelect(page);
  const button = page.getByTestId(`mode-${mode}`);
  // データベースの準備ができるまで、モードは選べない
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await page.getByRole('button', { name: 'スキップ' }).click();
}

/**
 * 一覧（今いるページ）から1問目のモード選択を開く。
 * @param {import('@playwright/test').Page} page
 */
export async function openModeSelect(page) {
  const problem = page.getByTestId('problem-beginner-01');
  await expect(problem).toBeEnabled();
  await problem.click();
  await expect(page.getByTestId('mode-1')).toBeVisible();
}

/** 一覧が出ているか（遊ぶ画面から Esc でもどったあとなど） */
export const homeProblem = (page) => page.getByTestId('problem-beginner-01');
