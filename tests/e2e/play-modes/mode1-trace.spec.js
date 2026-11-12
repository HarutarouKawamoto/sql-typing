import { test, expect } from '@playwright/test';
import { homeProblem, openModeSelect, openPlay } from '../helpers/open-play.js';

/** 一覧から1問目のなぞり書きを始める */
async function startMode1(page) {
  await openPlay(page, '1');
  await expect(page.getByTestId('typing-area')).toBeVisible();
}

const typedCount = (page) =>
  page.locator('[data-testid="typing-area"] [data-state="typed"]').count();

test('小文字で最後まで打つとクリアになり、結果の表が30行になる', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startMode1(page);

  await page.keyboard.type('select *');
  await expect(page.getByTestId('result-table')).toContainText('FROM まで打つと');
  await page.keyboard.type(' from products');

  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('result-table')).toContainText('30行');
  await expect(page.getByTestId('result-table')).toContainText('Mug Cup Blue');
  await expect(page.getByTestId('rank')).toHaveText(/^[SABC]$/);
  expect(errors).toEqual([]);
});

test('打ち間違えると位置が進まず、正しいキーで進む', async ({ page }) => {
  await startMode1(page);
  await page.keyboard.press('x');
  expect(await typedCount(page)).toBe(0);
  await expect(page.getByTestId('meter')).toContainText('正確さ 0%');
  await page.keyboard.press('S');
  expect(await typedCount(page)).toBe(1);
});

test('Shift・Backspace は数えず、改行の代わりに Enter でも区切りを打てる', async ({ page }) => {
  await startMode1(page);
  await page.keyboard.press('Shift');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('SELECT');
  await page.keyboard.press('Enter');
  await page.keyboard.type('*');
  expect(await typedCount(page)).toBe(8);
  await expect(page.getByTestId('meter')).toContainText('正確さ 100%');
});

test('クリアの記録が残り、読み込み直しても一覧の星とモード選択の最高記録に出る', async ({
  page,
}) => {
  await startMode1(page);
  await page.keyboard.type('SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-beginner-01-1')).toHaveAttribute('data-cleared', 'true');
  await page.reload();
  await expect(page.getByTestId('star-beginner-01-1')).toHaveAttribute('data-cleared', 'true');
  await openModeSelect(page);
  await expect(page.getByTestId('best-mode1')).toContainText(/最高：\d+ 文字\/分/);
});

test('結果で R を押すと、もう一度最初から打てる', async ({ page }) => {
  await startMode1(page);
  await page.keyboard.type('SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toHaveCount(0);
  expect(await typedCount(page)).toBe(0);
});

test('日本語入力がオンのキーは数えずに知らせ、長押しの繰り返しは数えない', async ({ page }) => {
  await startMode1(page);
  const dispatch = (init) =>
    page.evaluate((options) => window.dispatchEvent(new KeyboardEvent('keydown', options)), init);

  await dispatch({ key: 'Process' });
  await expect(page.getByRole('alert')).toContainText('日本語入力がオンになっています');
  await dispatch({ key: 'Escape', isComposing: true });
  await expect(page.getByTestId('typing-area')).toBeVisible(); // 変換中の Esc では抜けない

  await dispatch({ key: 'x', repeat: true });
  expect(await typedCount(page)).toBe(0);
  await expect(page.getByTestId('meter')).toContainText('正確さ 100%');

  await page.keyboard.press('S');
  expect(await typedCount(page)).toBe(1);
  await expect(page.getByRole('alert')).toHaveCount(0); // 正しく打てたら知らせを消す
});

test('壊れた学習記録があっても起動し、そのことを知らせる', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('sql-typing:progress', '{broken');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('学習記録を読み込めなかった');
  await expect(homeProblem(page)).toBeEnabled({ timeout: 30_000 });
});

test('打つSQLは合字（>= を ≥ にする描き方）を使わない', async ({ page }) => {
  await startMode1(page);
  const ligatures = await page
    .getByTestId('typing-area')
    .evaluate((element) => getComputedStyle(element).fontVariantLigatures);
  expect(ligatures).toBe('none');
});
