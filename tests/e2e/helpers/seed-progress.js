/**
 * 学習記録を localStorage に入れてからページを開く（何問もクリアした状態から始めるため）。
 * 形は src/schema/progress-schema.js（version 1）。最初の1回だけ入れ、読み込み直しでは上書きしない。
 * @param {import('@playwright/test').Page} page
 * @param {{ problemId: string, mode: '1' | '2' | '3' | '4' }[]} clears - クリア済みにする問題とモード
 * @param {{ reorderAnimation?: boolean, replaySpeed?: 0.5 | 1 | 2 }} [settings] - 既定から変える設定
 */
export async function seedProgress(page, clears, settings = {}) {
  const problems = {};
  for (const { problemId, mode } of clears) {
    problems[problemId] ??= { modes: {}, stepReplayFinished: false };
    problems[problemId].modes[mode] = { cleared: true, plays: 1, best: { timeMs: 60_000 } };
  }
  const progress = {
    version: 1,
    problems,
    mistakes: {},
    typed: {},
    days: {},
    settings: { reorderAnimation: true, replaySpeed: 1, ...settings },
  };
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('progress-seeded')) return;
    localStorage.setItem('sql-typing:progress', value);
    sessionStorage.setItem('progress-seeded', '1');
  }, JSON.stringify(progress));
}

/** 初級の1〜8問目（ターニングポイントの手前まで）をモード1でクリアした状態 */
export const BEFORE_TURNING_POINT = ['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => ({
  problemId: `beginner-${n}`,
  mode: /** @type {const} */ ('1'),
}));
