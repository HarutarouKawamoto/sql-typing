import { test, expect } from '@playwright/test';
import { homeProblem } from '../helpers/open-play.js';

/*
 * ステップ再生の印（消える行・消える列・まとまる行）を、見本のページ（/?demo）で確かめる。
 * speed=0.05 で印の場面を長く（数秒）して、印の数を数える。
 */

/** 見本のページを開き、サンプルを選ぶ */
async function openSample(page, title, speed = 0.05) {
  await page.goto(`/?demo&speed=${speed}`);
  await expect(page.getByRole('heading', { name: 'ステップ再生の見本' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByTestId('step-title')).toContainText('段階 1/');
}

const marks = (page, mark) => page.locator(`[data-mark="${mark}"]`);

test('WHERE：消える9行に赤い印が付き、そのあと消えて21行になる', async ({ page }) => {
  await openSample(page, /^WHERE：/, 0.5);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('WHERE');
  await expect(marks(page, 'removing')).toHaveCount(9);
  // 印の場面（0.5倍速で3.6秒）が終わると行が消える
  await expect(marks(page, 'removing')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId('step-table')).toContainText('30行 → 21行');
  await expect(page.locator('[data-testid="step-table"] tbody tr')).toHaveCount(21);
});

test('SELECT：使わない5列に印が付き、AS の列は「元 → 新」になる', async ({ page }) => {
  // 印の場面（0.5倍速で3秒）のあとに「元 → 新」が出るのを待つので、0.5倍速にする
  await openSample(page, /^AS：/, 0.5);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('SELECT');
  await expect(marks(page, 'removing-column')).toHaveCount(5);
  await expect(page.locator('th[data-renamed="true"]')).toContainText('name → item', {
    timeout: 15_000,
  });
});

test('DISTINCT：まとまって消える26行と、残る4行に印が付く', async ({ page }) => {
  await openSample(page, /^DISTINCT：/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('DISTINCT');
  await expect(marks(page, 'merging')).toHaveCount(26);
  await expect(marks(page, 'merging-keep')).toHaveCount(4);
});

test('LIMIT：上位5行のあとの25行に印が付く', async ({ page }) => {
  await openSample(page, /^ORDER BY と LIMIT：/);
  await page.keyboard.press('ArrowRight'); // SELECT
  await page.keyboard.press('ArrowRight'); // ORDER BY
  await page.keyboard.press('ArrowRight'); // LIMIT
  await expect(page.getByTestId('step-title')).toContainText('LIMIT');
  await expect(marks(page, 'removing')).toHaveCount(25);
});

test('入口へもどると、見本のページを抜ける', async ({ page }) => {
  await openSample(page, /^WHERE：/);
  await page.getByRole('button', { name: '入口へもどる' }).click();
  await expect(homeProblem(page)).toBeVisible();
  await expect(page).not.toHaveURL(/demo/);
});

test('GROUP BY：30行がグループの色で塗られ、SELECT で1グループ1行にまとまる', async ({ page }) => {
  await openSample(page, /^GROUP BY：/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('GROUP BY');
  const rows = page.locator('[data-testid="step-table"] tbody tr');
  await expect(rows).toHaveCount(30);
  await expect(page.locator('[data-testid="step-table"] tbody tr[data-group]')).toHaveCount(30);
  // supplier は NULL を入れて5グループ
  const groups = await page
    .locator('[data-testid="step-table"] tbody tr[data-group]')
    .evaluateAll((trs) => new Set(trs.map((tr) => tr.dataset.group)).size);
  expect(groups).toBe(5);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('SELECT');
  await expect(page.getByTestId('step-player')).toContainText('1つのグループが1行にまとまり');
  await expect(marks(page, 'merging-keep')).toHaveCount(5);
  await expect(marks(page, 'merging')).toHaveCount(25);
});

test('HAVING：条件に合わないグループの行に、消える印が付く', async ({ page }) => {
  await openSample(page, /^HAVING：/);
  // HAVING の段階まで進める（段階の数が変わっても壊れないように、題が HAVING になるまで押す）
  await expect(async () => {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('step-title')).toContainText('HAVING', { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByTestId('step-player')).toContainText('条件に合わないグループ');
  const removing = marks(page, 'removing');
  await expect(removing.first()).toBeVisible();
  // 消える行はすべて、同じグループの行ごと消える（消える行のグループの行は全部印が付いている）
  const check = await page
    .locator('[data-testid="step-table"] tbody tr[data-group]')
    .evaluateAll((trs) => {
      const removedGroups = new Set(
        trs.filter((tr) => tr.dataset.mark === 'removing').map((tr) => tr.dataset.group),
      );
      return trs.every(
        (tr) => (tr.dataset.mark === 'removing') === removedGroups.has(tr.dataset.group),
      );
    });
  expect(check).toBe(true);
});

test('JOIN：注文（左）と顧客（右）が並び、つながる行が同じ色。注文のない2人の顧客は薄い。そのあと合体する', async ({
  page,
}) => {
  await openSample(page, /^JOIN：/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('JOIN');
  await expect(page.getByTestId('step-player')).toContainText('1行に合体する');
  const table = page.getByTestId('step-table');
  await expect(table.locator('tbody tr[data-side="right"]')).toHaveCount(10);
  await expect(table.locator('tbody tr:not([data-side])[data-pair]')).toHaveCount(20);
  await expect(marks(page, 'join-unmatched')).toHaveCount(2);
  // 左の注文の色は、つながる右の顧客の色と同じ
  const sameColors = await table.locator('tbody tr').evaluateAll((trs) => {
    const right = trs.filter((tr) => tr.dataset.side === 'right' && tr.dataset.pair !== undefined);
    const left = trs.filter((tr) => tr.dataset.side === undefined);
    const rightColors = new Set(right.map((tr) => tr.dataset.pair));
    return left.every((tr) => rightColors.has(tr.dataset.pair));
  });
  expect(sameColors).toBe(true);
});

test('LEFT JOIN：注文のない2人の顧客に「NULL になる」印が付き、合体した表は22行', async ({
  page,
}) => {
  await openSample(page, /^LEFT JOIN：/, 0.5);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-title')).toContainText('JOIN');
  await expect(page.getByTestId('step-player')).toContainText('右の列が NULL になる');
  await expect(marks(page, 'join-null')).toHaveCount(2);
  await expect(page.getByTestId('step-table')).toContainText('10行 → 22行', { timeout: 15_000 });
  await expect(page.locator('[data-testid="step-table"] tbody tr')).toHaveCount(22);
});
