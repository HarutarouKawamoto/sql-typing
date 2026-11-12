import { test, expect } from '@playwright/test';
import { homeProblem, openPlay } from '../helpers/open-play.js';
import { seedProgress } from '../helpers/seed-progress.js';

/** localStorage の学習記録（なければ null） */
const storedProgress = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('sql-typing:progress') ?? 'null'));

/** 一覧から設定画面を開く */
async function openSettings(page) {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
}

test('一覧の「設定」から開き、Esc で一覧へもどる', async ({ page }) => {
  await openSettings(page);
  await expect(page.getByTestId('setting-reorder')).toBeChecked();
  await expect(page.getByTestId('setting-prediction')).toBeChecked();
  await expect(page.getByTestId('setting-speed-1')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});

test('ステップ再生の速さと見える化B を変えるとすぐ保存され、読み込み直しても残る', async ({
  page,
}) => {
  await openSettings(page);
  await page.getByTestId('setting-speed-2').check();
  await page.getByTestId('setting-reorder').uncheck();
  expect((await storedProgress(page)).settings).toEqual({
    reorderAnimation: false,
    replaySpeed: 2,
    predictionQuiz: true,
  });
  await page.reload();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('setting-speed-2')).toBeChecked();
  await expect(page.getByTestId('setting-reorder')).not.toBeChecked();
});

test('学習記録を消すときは確かめる。やめる・Esc では消えず、消すと星が消えて設定は残る', async ({
  page,
}) => {
  await seedProgress(page, [{ problemId: 'beginner-01', mode: '1' }], { replaySpeed: 2 });
  await page.goto('/');
  await expect(page.getByTestId('star-beginner-01-1')).toHaveAttribute('data-cleared', 'true');
  await page.getByTestId('open-settings').click();

  // やめる
  await page.getByTestId('clear-progress').click();
  await expect(page.getByTestId('clear-confirm')).toBeVisible();
  await expect(page.getByTestId('clear-no')).toBeFocused();
  await page.getByTestId('clear-no').click();
  await expect(page.getByTestId('clear-confirm')).toHaveCount(0);
  // 閉じたら、押したボタンの代わりに「学習記録を消す」へフォーカスがもどる
  await expect(page.getByTestId('clear-progress')).toBeFocused();

  // Esc は確かめを閉じるだけ（設定画面にいる）
  await page.getByTestId('clear-progress').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('clear-confirm')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
  expect(Object.keys((await storedProgress(page)).problems)).toEqual(['beginner-01']);

  // 消す
  await page.getByTestId('clear-progress').click();
  await page.getByTestId('clear-yes').click();
  await expect(page.getByRole('status').filter({ hasText: '学習記録を消しました' })).toBeVisible();
  await expect(page.getByTestId('clear-progress')).toBeFocused();
  const stored = await storedProgress(page);
  expect(stored.problems).toEqual({});
  expect(stored.settings).toEqual({ reorderAnimation: true, replaySpeed: 2, predictionQuiz: true });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-beginner-01-1')).toHaveAttribute('data-cleared', 'false');
  await expect(page.getByTestId('problem-beginner-02')).toBeDisabled();
});

test('見える化B を off にすると、実行しても句の入れ替わりは流れない', async ({ page }) => {
  await seedProgress(page, [], { reorderAnimation: false });
  await openPlay(page, '4');
  await expect(page.getByTestId('table-list')).toContainText('products');
  // 一瞬でも出たら気づけるように、ページの中で見張る
  await page.evaluate(() => {
    window.__reorderSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="reorder-intro"]')) window.__reorderSeen = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const editor = page.getByTestId('sql-editor');
  await editor.fill('SELECT name FROM products');
  await editor.focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('judge-panel')).toHaveAttribute('data-status', 'wrong');
  expect(await page.evaluate(() => window.__reorderSeen)).toBe(false);
});
