import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSteps } from '../../../src/core/stepper/index.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

/*
 * 中級の集計（GROUP BY・HAVING・集計関数）のステップ再生を、初級の products 30行の上で作る。
 * 最後の段階が元のSQLの結果と一致し、グループの寄り方・まとまり方が本物どおりであることを確かめる。
 */

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
  await runner.prepare({ seedSql: readSeed('beginner.sql') });
});

afterAll(async () => {
  await runner.close();
});

const labels = (built) => built.steps.map((s) => s.label);
const valuesOf = (step) => step.rows.map((r) => r.values);
const sortRows = (rows) => [...rows].map((r) => JSON.stringify(r)).sort();

/** 最後の段階が元のSQLの結果と一致するか（ordered なら並びも） */
async function expectSameAsOriginal(built, sql, ordered) {
  const original = await runner.run(sql);
  expect(original.ok).toBe(true);
  const last = built.steps.at(-1);
  expect(last.columns).toEqual(original.result.columns);
  if (ordered) expect(valuesOf(last)).toEqual(original.result.rows);
  else expect(sortRows(valuesOf(last))).toEqual(sortRows(original.result.rows));
}

describe('buildSteps：GROUP BY と集計', () => {
  it('GROUP BY で30行が4つのグループに寄り、SELECT で1グループ1行（4行）になる', async () => {
    const sql = 'SELECT category, count(*) AS n FROM products GROUP BY category';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual(['FROM', 'GROUP BY', 'SELECT']);

    const [from, group, select] = built.steps;
    // GROUP BY：行は消えず、同じグループの行が続けて並ぶ（グループの番号が途中で戻らない）
    expect(group.rows).toHaveLength(30);
    expect(new Set(group.rows.map((r) => r.rid))).toEqual(new Set(from.rows.map((r) => r.rid)));
    const order = group.rows.map((r) => group.diff.groups[r.rid]);
    expect(new Set(order).size).toBe(4);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // 初期データは category の順に並んでいるので、寄せても並びは変わらない
    expect(group.diff.reordered).toBe(false);
    // 同じグループの行は、category が同じ
    const categoryIndex = group.columns.indexOf('category');
    for (const row of group.rows) {
      const sameGroup = group.rows.filter(
        (other) => group.diff.groups[other.rid] === group.diff.groups[row.rid],
      );
      expect(new Set(sameGroup.map((r) => r.values[categoryIndex])).size).toBe(1);
    }

    // SELECT：4行。残った行の目印はグループの最初の行で、ほかの26行はまとまって消える
    expect(select.rows).toHaveLength(4);
    expect(select.columns).toEqual(['category', 'n']);
    const absorbed = Object.values(select.diff.merged).flat();
    expect(absorbed).toHaveLength(26);
    for (const row of select.rows) {
      const firstOfGroup = group.rows.find(
        (r) => group.diff.groups[r.rid] === group.diff.groups[row.rid],
      );
      expect(row.rid).toBe(firstOfGroup.rid);
    }
    // 並びはグループの番号の順
    expect(select.rows.map((r) => group.diff.groups[r.rid])).toEqual([0, 1, 2, 3]);
    await expectSameAsOriginal(built, sql, false);
  });

  it('WHERE・GROUP BY・HAVING・ORDER BY・LIMIT を全部使っても、最後が元のSQLと一致する', async () => {
    const sql =
      'SELECT category, sum(stock) AS total FROM products WHERE price >= 1000 ' +
      'GROUP BY category HAVING count(*) >= 3 ORDER BY total DESC LIMIT 2';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual([
      'FROM',
      'WHERE',
      'GROUP BY',
      'HAVING',
      'SELECT',
      'ORDER BY',
      'LIMIT',
    ]);
    const having = built.steps[3];
    const group = built.steps[2];
    // HAVING で消える行は、グループごと全部消える
    const removedGroups = new Set(having.diff.removed.map((rid) => group.diff.groups[rid]));
    for (const row of group.rows) {
      const gone = having.diff.removed.includes(row.rid);
      expect(gone).toBe(removedGroups.has(group.diff.groups[row.rid]));
    }
    expect(having.rows.length).toBe(group.rows.length - having.diff.removed.length);
    await expectSameAsOriginal(built, sql, true);
  });

  it('GROUP BY のない集計は、全部の行が1つのグループになって1行にまとまる', async () => {
    const sql = 'SELECT count(*) AS n, max(price) AS top FROM products';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual(['FROM', 'SELECT']);
    const select = built.steps[1];
    expect(select.rows).toHaveLength(1);
    expect(Object.values(select.diff.merged).flat()).toHaveLength(29);
    await expectSameAsOriginal(built, sql, false);
  });

  it('WHERE で0行になっても、集計は1行（行の目印は group: から始まる）', async () => {
    const sql = 'SELECT count(*) AS n FROM products WHERE price < 0';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    const select = built.steps.at(-1);
    expect(valuesOf(select)).toEqual([[0]]);
    expect(select.rows[0].rid).toMatch(/^group:/);
    await expectSameAsOriginal(built, sql, false);
  });

  it('GROUP BY のない HAVING（全部で1グループ）も作れる', async () => {
    const sql = 'SELECT count(*) AS n FROM products HAVING count(*) > 100';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(labels(built)).toEqual(['FROM', 'HAVING', 'SELECT']);
    expect(built.steps[1].rows).toHaveLength(0);
    await expectSameAsOriginal(built, sql, false);
  });

  it('同じグループの行が離れているときは、寄せて並べ替える（グループの中は元の順）', async () => {
    const built = await buildSteps(
      'SELECT supplier, count(*) FROM products GROUP BY supplier',
      runner,
    );
    const [from, group] = built.steps;
    expect(group.diff.reordered).toBe(true);
    const fromOrder = from.rows.map((r) => r.rid);
    for (const index of new Set(Object.values(group.diff.groups))) {
      const members = group.rows
        .filter((r) => group.diff.groups[r.rid] === index)
        .map((r) => r.rid);
      expect(members).toEqual(fromOrder.filter((rid) => members.includes(rid)));
    }
  });

  it('式でグループ分けしても、NULL のグループがあっても作れる', async () => {
    const sql =
      'SELECT supplier, count(*) AS n, avg(price) AS a FROM products GROUP BY supplier ORDER BY supplier';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    await expectSameAsOriginal(built, sql, true);
    const sql2 = 'SELECT price / 1000 AS band, count(*) FROM products GROUP BY price / 1000';
    const built2 = await buildSteps(sql2, runner);
    expect(built2.ok).toBe(true);
    await expectSameAsOriginal(built2, sql2, false);
  });
});

describe('buildSteps：よく書く集計の形', () => {
  it.each([
    ['列の番号', 'SELECT category, count(*) AS n FROM products GROUP BY 1'],
    ['括弧つきの列の番号', 'SELECT category, count(*) AS n FROM products GROUP BY (1)'],
    ['SELECT の別名', 'SELECT price / 1000 AS band, count(*) FROM products GROUP BY band'],
    ['テーブルの別名', 'SELECT p.category, count(*) FROM products p GROUP BY p.category'],
    [
      'count(DISTINCT x)',
      'SELECT category, count(DISTINCT supplier) FROM products GROUP BY category',
    ],
    [
      '括弧とカンマを持つ項目',
      "SELECT coalesce(supplier, 'none,x') AS s, count(*) FROM products GROUP BY coalesce(supplier, 'none,x')",
    ],
  ])('%s：グループの数だけの行にまとまり、最後が元のSQLと一致する', async (_label, sql) => {
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    const select = built.steps.find((s) => s.label === 'SELECT');
    const group = built.steps.find((s) => s.label === 'GROUP BY');
    expect(select.rows).toHaveLength(new Set(Object.values(group.diff.groups)).size);
    expect(new Set(select.rows.map((r) => r.rid)).size).toBe(select.rows.length);
    expect(select.diff.aggregated).toBe(true);
    await expectSameAsOriginal(built, sql, false);
  });

  it('ORDER BY で並び替わり、LIMIT で後ろのグループが消える', async () => {
    const sql =
      'SELECT category, count(*) AS n FROM products GROUP BY category ORDER BY n DESC, category LIMIT 2';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    const [orderStep, limitStep] = built.steps.slice(-2);
    expect(orderStep.label).toBe('ORDER BY');
    expect(orderStep.diff.reordered).toBe(true);
    expect(limitStep.diff.removed).toHaveLength(2);
    await expectSameAsOriginal(built, sql, true);
  });

  it('1グループ1行の集計（まとまる行がない）でも、集計した段階だとわかる', async () => {
    const built = await buildSteps('SELECT id, count(*) FROM products GROUP BY id', runner);
    const select = built.steps.at(-1);
    expect(select.diff.merged).toEqual({});
    expect(select.diff.aggregated).toBe(true);
  });
});

describe('buildSteps：集計でうその段階を見せない', () => {
  it('SELECT の中のサブクエリの集計は「集計する」と取り違えない（行はまとまらない）', async () => {
    const sql = 'SELECT name, price - (SELECT avg(price) FROM products) AS d FROM products';
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    expect(built.steps.map((s) => s.label)).toEqual(['FROM', 'SELECT']);
    const select = built.steps.at(-1);
    expect(select.diff.merged).toEqual({});
    expect(select.diff.aggregated).toBe(false);
    expect(new Set(select.rows.map((r) => r.rid)).size).toBe(30);
  });

  it('グループの鍵の文字と本物のグループ分けがずれる（1.0 と 1.00）ときは mismatch', async () => {
    const sql =
      'SELECT count(*) AS n FROM products GROUP BY CASE WHEN id % 2 = 0 THEN 1.0 ELSE 1.00 END';
    expect(await buildSteps(sql, runner)).toMatchObject({ ok: false, reason: 'mismatch' });
  });
});

describe('buildSteps：集計で作れない形', () => {
  it('集計の項目を指す列の番号は、PostgreSQL のエラー（学習者のSQLの間違い）として error', async () => {
    expect(
      await buildSteps('SELECT category, count(*) FROM products GROUP BY 1, 2', runner),
    ).toMatchObject({ ok: false, reason: 'error' });
  });

  it.each([
    ['ROLLUP', 'SELECT category, count(*) FROM products GROUP BY ROLLUP (category)'],
    ['DISTINCT と集計', 'SELECT DISTINCT count(*) FROM products GROUP BY category'],
    ['ウィンドウ関数', 'SELECT name, rank() OVER (ORDER BY price) FROM products'],
  ])('%s は unsupported', async (_label, sql) => {
    expect(await buildSteps(sql, runner)).toMatchObject({ ok: false, reason: 'unsupported' });
  });
});
