import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSteps } from '../../../src/core/stepper/index.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

/*
 * JOIN のステップ再生を、中級の初期データ（customers 10・orders 20・order_items 33・products 30）の上で作る。
 */

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
  await runner.prepare({ seedSql: readSeed('intermediate.sql') });
});

afterAll(async () => {
  await runner.close();
});

const labels = (built) => built.steps.map((s) => s.label);
const valuesOf = (step) => step.rows.map((r) => r.values);
const sortRows = (rows) => [...rows].map((r) => JSON.stringify(r)).sort();

async function expectSameAsOriginal(built, sql, ordered) {
  const original = await runner.run(sql);
  expect(original.ok).toBe(true);
  const last = built.steps.at(-1);
  expect(last.columns).toEqual(original.result.columns);
  if (ordered) expect(valuesOf(last)).toEqual(original.result.rows);
  else expect(sortRows(valuesOf(last))).toEqual(sortRows(original.result.rows));
}

describe('buildSteps：JOIN', () => {
  it('orders JOIN customers：FROM は orders だけ、JOIN で各注文に顧客が1人つながる', async () => {
    const sql =
      'SELECT o.id, c.name, o.status FROM orders o JOIN customers c ON c.id = o.customer_id';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual(['FROM', 'JOIN', 'SELECT']);

    const [from, join] = built.steps;
    expect(from.rows).toHaveLength(20);
    expect(from.columns).toEqual(['id', 'customer_id', 'ordered_at', 'status']);
    expect(join.rows).toHaveLength(20);
    expect(join.columns).toEqual([
      'id',
      'customer_id',
      'ordered_at',
      'status',
      'id',
      'name',
      'region',
      'joined_on',
    ]);
    expect(join.diff.join.kind).toBe('INNER');
    expect(join.diff.join.rows).toHaveLength(10);
    expect(join.diff.join.columns).toEqual(['id', 'name', 'region', 'joined_on']);
    // 左の注文ごとに、右の顧客が1人ずつ
    expect(Object.keys(join.diff.join.pairs)).toHaveLength(20);
    expect(Object.values(join.diff.join.pairs).every((rights) => rights.length === 1)).toBe(true);
    expect(join.diff.removed).toEqual([]);
    // 合体した行の目印は「左の目印+右の目印」
    for (const row of join.rows) {
      const [left, right] = row.rid.split('+');
      expect(join.diff.join.pairs[left]).toEqual([right]);
    }
    await expectSameAsOriginal(built, sql, false);
  });

  it('customers LEFT JOIN orders：注文のない2人は残り、右の列が NULL になる', async () => {
    const sql = 'SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    const join = built.steps[1];
    expect(join.diff.join.kind).toBe('LEFT');
    const lonely = Object.entries(join.diff.join.pairs).filter(([, rights]) => rights.length === 0);
    expect(lonely).toHaveLength(2);
    // 相手のない行は、右の目印が - で、右の列が全部 NULL
    const nullRows = join.rows.filter((row) => row.rid.endsWith('+-'));
    expect(nullRows).toHaveLength(2);
    for (const row of nullRows) expect(row.values.slice(4)).toEqual([null, null, null, null]);
    expect(join.rows).toHaveLength(22);
    expect(join.diff.removed).toEqual([]);
    await expectSameAsOriginal(built, sql, false);
  });

  it('INNER JOIN では、相手のない左の行が消える', async () => {
    const sql = 'SELECT c.name, o.id FROM customers c JOIN orders o ON o.customer_id = c.id';
    const built = await buildSteps(sql, runner);
    const join = built.steps[1];
    expect(join.diff.removed).toHaveLength(2);
    expect(join.rows).toHaveLength(20);
    await expectSameAsOriginal(built, sql, false);
  });

  it('3つのテーブルの JOIN・WHERE・GROUP BY・ORDER BY：最後が元のSQLと一致する', async () => {
    const sql =
      "SELECT c.region, sum(i.quantity * i.unit_price) AS sales FROM orders o JOIN customers c ON c.id = o.customer_id JOIN order_items i ON i.order_id = o.id WHERE o.status <> 'cancelled' GROUP BY c.region ORDER BY sales DESC";
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual([
      'FROM',
      'JOIN',
      'JOIN',
      'WHERE',
      'GROUP BY',
      'SELECT',
      'ORDER BY',
    ]);
    const secondJoin = built.steps[2];
    expect(secondJoin.rows).toHaveLength(33);
    // 2つ目の JOIN の左の目印は、1つ目の JOIN の合体した行の目印
    const firstJoinRids = new Set(built.steps[1].rows.map((r) => r.rid));
    for (const left of Object.keys(secondJoin.diff.join.pairs)) {
      expect(firstJoinRids.has(left)).toBe(true);
    }
    await expectSameAsOriginal(built, sql, true);
  });

  it('自己結合（同じテーブルを別名で2回）', async () => {
    const sql =
      'SELECT a.name, b.name AS same_region FROM customers a JOIN customers b ON a.region = b.region AND a.id < b.id';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    await expectSameAsOriginal(built, sql, false);
  });

  it('LEFT JOIN と count：注文のない顧客は 0 件', async () => {
    const sql =
      'SELECT c.name, count(o.id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name ORDER BY orders, c.name';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    await expectSameAsOriginal(built, sql, true);
    expect(
      valuesOf(built.steps.at(-1))
        .slice(0, 2)
        .map((r) => r[1]),
    ).toEqual([0, 0]);
  });

  it('JOIN と LIMIT', async () => {
    const sql =
      'SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.ordered_at DESC LIMIT 3';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    await expectSameAsOriginal(built, sql, true);
  });
});

describe('buildSteps：JOIN のあとの列と並び', () => {
  it('同じ名前の列が2つ（orders.id と customers.id）でも、SELECT で消える列を位置で正しく決める', async () => {
    const sql = 'SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id';
    const built = await buildSteps(sql, runner);
    const select = built.steps.at(-1);
    // 合体した表の列：id(0) customer_id(1) ordered_at(2) status(3) id(4) name(5) region(6) joined_on(7)
    expect(select.diff.removedColumnIndexes).toEqual([1, 2, 3, 4, 6, 7]);
  });

  it('テーブル名.* は、そのテーブルの列を全部使う', async () => {
    const built = await buildSteps(
      'SELECT o.*, c.name FROM orders o JOIN customers c ON c.id = o.customer_id',
      runner,
    );
    expect(built.steps.at(-1).diff.removedColumnIndexes).toEqual([4, 6, 7]);
  });

  it('1つのテーブルでも、消える列の位置を持つ', async () => {
    const built = await buildSteps('SELECT name, price FROM products', runner);
    expect(built.steps.at(-1).diff.removedColumnIndexes).toEqual([0, 2, 4, 5, 6]);
  });

  it.each([
    'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id ORDER BY c.name LIMIT 4',
    'SELECT c.id FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY c.id DESC LIMIT 2',
    'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id ORDER BY c.name LIMIT 3 OFFSET 2',
  ])(
    '並びの鍵に同じ値がある JOIN と LIMIT でも作れる（ORDER BY の段階の並びをそのまま切る）：%s',
    async (sql) => {
      const built = await buildSteps(sql, runner);
      expect(built.ok).toBe(true);
      const [orderStep, limitStep] = built.steps.slice(-2);
      expect(limitStep.label).toBe('LIMIT');
      const start = orderStep.rows.findIndex((r) => r.rid === limitStep.rows[0].rid);
      expect(limitStep.rows).toEqual(orderStep.rows.slice(start, start + limitStep.rows.length));
      await expectSameAsOriginal(built, sql, true);
    },
  );
});

describe('buildSteps：JOIN で作れない形', () => {
  it.each([
    ['RIGHT JOIN', 'SELECT * FROM orders o RIGHT JOIN customers c ON c.id = o.customer_id'],
    ['USING', 'SELECT * FROM orders JOIN order_items USING (id)'],
    ['カンマ', 'SELECT * FROM orders, customers'],
  ])('%s は unsupported', async (_label, sql) => {
    expect(await buildSteps(sql, runner)).toMatchObject({ ok: false, reason: 'unsupported' });
  });
});
