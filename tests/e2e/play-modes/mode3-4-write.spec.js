import { test, expect } from '@playwright/test';
import { homeProblem, openModeSelect, openPlay } from '../helpers/open-play.js';

/**
 * 一覧から1問目を書くモードで始める。
 * @param {import('@playwright/test').Page} page
 * @param {'ヒントありで書く' | 'ヒントなしで書く'} name
 */
async function startWrite(page, name) {
  await openPlay(page, name === 'ヒントありで書く' ? '3' : '4');
  const editor = page.getByTestId('sql-editor');
  await expect(editor).toBeFocused();
  // 正解の結果ができるまで実行ボタンは押せない
  await expect(page.getByTestId('table-list')).toContainText('products');
  return editor;
}

/** 入力欄に書いて Ctrl+Enter で実行する（前の中身は消す） */
async function write(page, sql) {
  const editor = page.getByTestId('sql-editor');
  await editor.fill(sql);
  await editor.focus();
  await page.keyboard.press('Control+Enter');
}

test('モード3：ヒントを開き、間違えてから正解するとクリアになり、記録が残る', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startWrite(page, 'ヒントありで書く');

  await page.getByRole('button', { name: 'ヒントを開く（0/3）' }).click();
  await expect(page.getByTestId('hint-panel')).toContainText('SELECT と FROM');
  await expect(page.getByTestId('meter')).toContainText('ヒント 1/3');

  await write(page, 'SELECT name FROM products');
  const panel = page.getByTestId('judge-panel');
  await expect(panel).toHaveAttribute('data-status', 'wrong');
  await expect(panel).toHaveAttribute('data-reason', 'columnCount');
  await expect(page.getByTestId('result-table')).toContainText('30行');

  await write(page, 'SELECT *\nFROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('result-runs')).toHaveText('2 回');
  await expect(page.getByTestId('result-hints')).toHaveText('1 個');
  await expect(page.getByTestId('sql-editor')).toHaveAttribute('readonly', '');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('star-beginner-01-3')).toHaveAttribute('data-cleared', 'true');
  await openModeSelect(page);
  await expect(page.getByTestId('best-mode3')).toContainText('実行 2 回・ヒント 1 個');
  await page.reload();
  await openModeSelect(page);
  await expect(page.getByTestId('best-mode3')).toContainText('実行 2 回');
  expect(errors).toEqual([]);
});

test('モード3：ヒントは3つまで開ける', async ({ page }) => {
  await startWrite(page, 'ヒントありで書く');
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: `ヒントを開く（${i}/3）` }).click();
  }
  await expect(page.getByRole('button', { name: /ヒントは全部開きました/ })).toBeDisabled();
  await expect(page.getByTestId('hint-panel')).toContainText('SELECT ??? FROM ???');
});

test('モード4：ヒントが出ない。正解でクリアになり、ヒントの数は出ない', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await expect(page.getByTestId('hint-panel')).toHaveCount(0);
  await expect(page.getByTestId('meter')).not.toContainText('ヒント');
  await write(page, 'select * from products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('result-runs')).toHaveText('1 回');
  await expect(page.getByTestId('result-hints')).toHaveCount(0);
});

test('エラーは和訳と原因が出て、英語の原文を開ける', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await write(page, 'SELECT * FROM product');
  const panel = page.getByTestId('judge-panel');
  await expect(panel).toHaveAttribute('data-status', 'error');
  await expect(panel).toContainText('そのテーブルはありません');
  await expect(panel).toContainText('つづり間違い');
  await expect(panel.getByText('relation "product" does not exist')).toBeHidden();
  await panel.getByText('PostgreSQL のメッセージ（英語）').click();
  await expect(panel.getByText(/relation "product" does not exist/)).toBeVisible();
  await expect(page.getByTestId('result-table')).toContainText('結果の表はありません');
});

test('DROP TABLE のあとでも DB は初期状態に戻り、正しいSQLで正解になる', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await write(page, 'DROP TABLE products');
  await expect(page.getByTestId('judge-panel')).toHaveAttribute('data-status', 'wrong');
  await write(page, 'SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
});

test('Tab でスペース2つ、Enter だけでは実行せず改行になる', async ({ page }) => {
  const editor = await startWrite(page, 'ヒントなしで書く');
  await page.keyboard.type('SELECT *');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('FROM products');
  await expect(editor).toHaveValue('SELECT *\n  FROM products');
  await expect(editor).toBeFocused();
  await expect(page.getByTestId('meter')).toContainText('実行 0回');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
});

test('間違えたSQLのステップ再生を見られ、入力欄の矢印キーはステップ再生を動かさない', async ({
  page,
}) => {
  await startWrite(page, 'ヒントなしで書く');
  await write(page, 'SELECT name FROM products');
  await expect(page.getByTestId('judge-panel')).toHaveAttribute('data-status', 'wrong');

  await page.getByRole('button', { name: /ステップ再生を見る/ }).click();
  await expect(page.getByTestId('step-player')).toBeVisible();
  await page.getByRole('button', { name: '一時停止' }).click();
  await page.getByRole('button', { name: '最初から' }).click();
  await expect(page.getByTestId('step-title')).toContainText('段階 1/2');

  // 入力欄の ← はカーソル移動。ステップ再生は動かない
  const editor = page.getByTestId('sql-editor');
  await editor.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('段階 1/2');

  // 実行し直すと表に戻る
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('step-player')).toHaveCount(0);
  await expect(page.getByTestId('result-table')).toContainText('30行');
});

test('書きかけがあるときの Esc は確かめる。ほかのキーで続け、もう一度 Esc でもどる', async ({
  page,
}) => {
  await startWrite(page, 'ヒントなしで書く');
  await page.keyboard.type('SELECT');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exit-confirm')).toBeVisible();
  await expect(page.getByTestId('sql-editor')).toHaveValue('SELECT');

  // ほかのキーで続ける（確かめは消え、書いたSQLは残る）
  await page.keyboard.type(' *');
  await expect(page.getByTestId('exit-confirm')).toHaveCount(0);
  await expect(page.getByTestId('sql-editor')).toHaveValue('SELECT *');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exit-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});

test('書きかけがなければ、Esc ですぐもどる', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await page.keyboard.press('Escape');
  await expect(homeProblem(page)).toBeVisible();
});

test('クリアの直後に Ctrl+Enter をもう一度押しても、やり直しにならない', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await write(page, 'SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeFocused();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeVisible();
  await expect(page.getByTestId('sql-editor')).toHaveValue('SELECT * FROM products');
});

test('クリアのあとの R でもう一度（書いたSQLも時計も最初から）', async ({ page }) => {
  await startWrite(page, 'ヒントなしで書く');
  await write(page, 'SELECT * FROM products');
  await expect(page.getByRole('heading', { name: 'クリア！' })).toBeFocused();
  await page.keyboard.press('r');
  const editor = page.getByTestId('sql-editor');
  await expect(editor).toHaveValue('');
  await expect(editor).toBeFocused();
  await expect(page.getByTestId('meter')).toContainText('実行 0回');
});

test('ヒント③の骨組みと入力欄は、合字（>= を ≥ にする描き方）を使わない', async ({ page }) => {
  const editor = await startWrite(page, 'ヒントありで書く');
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: `ヒントを開く（${i}/3）` }).click();
  }
  const skeleton = page.getByTestId('hint-panel').getByText('SELECT ??? FROM ???');
  const styleOf = (locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.fontVariantLigatures, style.fontFeatureSettings];
    });
  for (const locator of [skeleton, editor]) {
    const [ligatures, features] = await styleOf(locator);
    expect(ligatures).toBe('none');
    expect(features).toContain('"calt" 0');
  }
});
