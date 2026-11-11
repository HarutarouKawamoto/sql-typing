import { test, expect } from '@playwright/test';
import { homeProblem, openModeSelect } from '../helpers/open-play.js';

test('一覧に章と問題、星4つが出る。最初は星がない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: /初級/ })).toBeVisible();
  await expect(homeProblem(page)).toContainText('在庫表を見せて');
  for (const mode of ['1', '2', '3', '4']) {
    await expect(page.getByTestId(`star-beginner-01-${mode}`)).toHaveAttribute(
      'data-cleared',
      'false',
    );
  }
  expect(errors).toEqual([]);
});

test('問題を選ぶとモード選択。キーの 1 で選ぶと依頼の会話を Enter で1行ずつ送り、最後に遊ぶ画面になる', async ({
  page,
}) => {
  await page.goto('/');
  await openModeSelect(page);
  await expect(page.getByTestId('mode-1')).toBeEnabled({ timeout: 30_000 });
  await page.keyboard.press('1');

  const panel = page.getByTestId('story-panel');
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  await expect(panel).toContainText('木村');
  for (let shown = 2; shown <= 5; shown += 1) {
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('listitem')).toHaveCount(shown);
  }
  await expect(page.getByRole('button', { name: '始める（Enter）' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('typing-area')).toBeVisible();
});

test('会話はクリックでも送れ、スキップで飛ばせる。Esc で一覧へ', async ({ page }) => {
  await page.goto('/');
  await openModeSelect(page);
  await page.getByTestId('mode-2').click({ timeout: 30_000 });
  const panel = page.getByTestId('story-panel');
  await panel.getByRole('listitem').first().click();
  await expect(panel.getByRole('listitem')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();

  await openModeSelect(page);
  await page.getByTestId('mode-2').click();
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByTestId('typing-area')).toBeVisible();
});

test('モードを選ばずに依頼の会話を読み返すと、終えたらモード選択にもどる', async ({ page }) => {
  await page.goto('/');
  await openModeSelect(page);
  await page.getByRole('button', { name: '依頼の会話を読む' }).click();
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByTestId('mode-1')).toBeVisible();
});

test('クリアすると反応の会話が出る。次の問題がないときは押せず Enter・J は何もしない、R でもう一度、一覧へで星が付いている', async ({
  page,
}) => {
  await page.goto('/');
  await openModeSelect(page);
  await page.getByTestId('mode-1').click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByTestId('typing-area')).toBeVisible();
  await page.keyboard.type('SELECT * FROM products');

  const after = page.getByTestId('after-story');
  await expect(after).toContainText('もう全部出たの');
  // 初級は今1問だけなので、次の問題はまだない
  await expect(after.getByRole('button', { name: '次の問題はまだありません' })).toBeDisabled();

  await page.keyboard.press('Enter');
  await page.keyboard.press('j');
  await expect(after).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.getByTestId('after-story')).toHaveCount(0);
  await page.keyboard.type('SELECT * FROM products');
  await page.getByTestId('after-story').getByRole('button', { name: '一覧へ（Esc）' }).click();
  await expect(page.getByTestId('star-beginner-01-1')).toHaveAttribute('data-cleared', 'true');
});

test('モード選択の Esc で一覧へもどる', async ({ page }) => {
  await page.goto('/');
  await openModeSelect(page);
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});
