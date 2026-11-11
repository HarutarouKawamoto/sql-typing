import { test, expect } from '@playwright/test';

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
  await expect(page.getByRole('button', { name: '1問目をなぞり書きで遊ぶ' })).toBeVisible();
  await expect(page).not.toHaveURL(/demo/);
});
