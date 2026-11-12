import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSteps } from '../../../src/core/stepper/index.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

/*
 * 初級の初期データ（products 30行）の上で、ステップ再生の段階を本物の PostgreSQL で作る。
 * 初級9問の正解SQLの形（docs/functional-design.md の「初級1章の問題（案）」）すべてで、
 * 最後の段階が元のSQLの結果と一致することを確かめる。
 */

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
  await runner.prepare({ seedSql: readSeed('beginner.sql') });
});

afterAll(async () => {
  await runner.close();
});

const BEGINNER_ANSWERS = [
  'SELECT * FROM products',
  'SELECT name AS item, price FROM products',
  'SELECT name, price FROM products WHERE price >= 1000',
  "SELECT name, stock FROM products WHERE category = 'kitchen' AND stock < 5",
  "SELECT name, category, price FROM products WHERE category IN ('kitchen', 'bag') AND price BETWEEN 500 AND 2000",
  "SELECT name, supplier FROM products WHERE name LIKE '%Mug%' OR supplier IS NULL",
  'SELECT name, price FROM products ORDER BY price DESC LIMIT 5',
  'SELECT DISTINCT category FROM products ORDER BY category',
  "SELECT name AS item, category, price FROM products WHERE stock > 0 AND supplier IS NOT NULL AND category IN ('kitchen', 'interior') AND price BETWEEN 1000 AND 5000 ORDER BY price DESC LIMIT 5",
];

const labels = (steps) => steps.map((s) => s.label);
const valuesOf = (step) => step.rows.map((r) => r.values);

describe('buildSteps：初級9問の形', () => {
  it.each(BEGINNER_ANSWERS)('ok で、最後の段階が元のSQLの結果と一致する：%s', async (sql) => {
    const built = await buildSteps(sql, runner);
    expect(built.ok).toBe(true);
    const original = await runner.run(sql);
    expect(original.ok).toBe(true);
    const last = built.steps.at(-1);
    expect(last.columns).toEqual(original.result.columns);
    expect(valuesOf(last)).toEqual(original.result.rows);
  });
});

describe('buildSteps：各段階の変化', () => {
  it('FROM の段階は全30行。SELECT * では列は消えない', async () => {
    const { steps } = await buildSteps('SELECT * FROM products', runner);
    expect(labels(steps)).toEqual(['FROM', 'SELECT']);
    expect(steps[0].rows).toHaveLength(30);
    expect(steps[0].columns).toContain('supplier');
    expect(steps[0].columns).not.toContain('__rid');
    expect(steps[0].rows[0].rid).toMatch(/^\(\d+,\d+\)$/);
    expect(steps[1].diff.removedColumns).toEqual([]);
  });

  it('各段階は、光らせる句の範囲（SQLの中の位置）を持つ', async () => {
    const sql = 'SELECT name FROM products WHERE price >= 1000';
    const { steps } = await buildSteps(sql, runner);
    expect(steps.map((s) => sql.slice(...s.range))).toEqual([
      'FROM products',
      'WHERE price >= 1000',
      'SELECT name',
    ]);
  });

  it('WHERE で、条件に合わない行が消える（30行 → 21行）', async () => {
    const { steps } = await buildSteps(
      'SELECT name, price FROM products WHERE price >= 1000',
      runner,
    );
    const where = steps[1];
    expect(where.label).toBe('WHERE');
    expect(where.rowCountBefore).toBe(30);
    expect(where.rows).toHaveLength(21);
    expect(where.diff.removed).toHaveLength(9);
    // 消えた行は、FROM の段階にあって WHERE の段階にない行
    const kept = new Set(where.rows.map((r) => r.rid));
    expect(where.diff.removed.every((rid) => !kept.has(rid))).toBe(true);
  });

  it('SELECT で、使わない列が消え、AS で列の名前が変わる', async () => {
    const { steps } = await buildSteps('SELECT name AS item, price FROM products', runner);
    const select = steps.at(-1);
    expect(select.columns).toEqual(['item', 'price']);
    expect(select.diff.renamedColumns).toEqual({ name: 'item' });
    expect(select.diff.removedColumns).toEqual([
      'id',
      'category',
      'stock',
      'supplier',
      'released_on',
    ]);
  });

  it('DISTINCT で、同じ値の行が1つにまとまる（30行 → 4行）', async () => {
    const { steps } = await buildSteps(
      'SELECT DISTINCT category FROM products ORDER BY category',
      runner,
    );
    expect(labels(steps)).toEqual(['FROM', 'SELECT', 'DISTINCT', 'ORDER BY']);
    const distinct = steps[2];
    expect(distinct.rows).toHaveLength(4);
    const mergedCount = Object.values(distinct.diff.merged).reduce((n, list) => n + list.length, 0);
    expect(mergedCount).toBe(26);
    expect(valuesOf(steps[3])).toEqual([['bag'], ['interior'], ['kitchen'], ['stationery']]);
    expect(steps[3].diff.reordered).toBe(true);
  });

  it('ORDER BY で並び替わり、LIMIT で先頭5行のあとが消える', async () => {
    const { steps } = await buildSteps(
      'SELECT name, price FROM products ORDER BY price DESC LIMIT 5',
      runner,
    );
    expect(labels(steps)).toEqual(['FROM', 'SELECT', 'ORDER BY', 'LIMIT']);
    expect(steps[2].diff.reordered).toBe(true);
    expect(steps[2].rows[0].values).toEqual(['Shoulder Bag Leather', 9800]);
    expect(steps[3].rows).toHaveLength(5);
    expect(steps[3].diff.removed).toHaveLength(25);
  });

  it('LIMIT と OFFSET：飛ばした行と後ろの行が消える', async () => {
    const sql = 'SELECT name, price FROM products ORDER BY price DESC LIMIT 3 OFFSET 2';
    const { ok, steps } = await buildSteps(sql, runner);
    expect(ok).toBe(true);
    expect(steps.at(-1).rows.map((r) => r.values[1])).toEqual([6980, 5480, 4800]);
    expect(steps.at(-1).diff.removed).toHaveLength(27);
  });

  it('テーブルに別名を付けても作れる', async () => {
    const built = await buildSteps('SELECT p.name FROM products AS p WHERE p.stock = 0', runner);
    expect(built.ok).toBe(true);
    expect(built.steps.at(-1).rows).toHaveLength(4);
  });
});

describe('buildSteps：間違った見える化を見せない', () => {
  it('同じ値が続くときの LIMIT と OFFSET：消える行の目印が本物どおり', async () => {
    const sql = 'SELECT category FROM products LIMIT 2 OFFSET 1';
    const { ok, steps } = await buildSteps(sql, runner);
    expect(ok).toBe(true);
    const select = steps.find((s) => s.label === 'SELECT');
    const limit = steps.at(-1);
    // ORDER BY がないので、テーブルを読んだ順の2行目・3行目が残る
    expect(limit.rows.map((r) => r.rid)).toEqual([select.rows[1].rid, select.rows[2].rid]);
    expect(limit.diff.removed).toContain(select.rows[0].rid);
  });

  it('ORDER BY 2（列の番号）でも、行の目印が列番号をずらさない', async () => {
    const built = await buildSteps(
      'SELECT name, price FROM products ORDER BY 2 DESC LIMIT 3',
      runner,
    );
    expect(built.ok).toBe(true);
    expect(built.steps.at(-1).rows.map((r) => r.values[1])).toEqual([9800, 7980, 6980]);
  });

  it('大文字の列名に AS を付けても、名前の変わった列と消えた列が正しい', async () => {
    const { steps } = await buildSteps('SELECT NAME AS Item, price FROM products', runner);
    const select = steps.at(-1);
    expect(select.diff.renamedColumns).toEqual({ name: 'item' });
    expect(select.diff.removedColumns).not.toContain('name');
    expect(select.diff.removedColumns).not.toContain('price');
  });

  it('列でないもの（TRUE）や、別の列に元の列の名前を付けたときを取り違えない', async () => {
    const flag = (await buildSteps('SELECT TRUE flag, name FROM products', runner)).steps.at(-1);
    expect(flag.diff.renamedColumns).toEqual({});
    const swapped = (await buildSteps('SELECT id AS name FROM products', runner)).steps.at(-1);
    expect(swapped.diff.renamedColumns).toEqual({ id: 'name' });
    expect(swapped.diff.removedColumns).toContain('name');
  });

  it('同じ列を2回使うときは、名前の変わった表示をしない', async () => {
    const { steps } = await buildSteps('SELECT name AS a, name AS b FROM products', runner);
    expect(steps.at(-1).diff.renamedColumns).toEqual({});
  });

  it('SELECT *, name のように * があれば、どの列も消えない', async () => {
    const { steps } = await buildSteps('SELECT *, name FROM products', runner);
    expect(steps.at(-1).diff.removedColumns).toEqual([]);
  });

  it('SELECT ... INTO はDBを変えずに unsupported', async () => {
    const result = await buildSteps('SELECT * INTO copy_products FROM products', runner);
    expect(result).toMatchObject({ ok: false, reason: 'unsupported' });
    const exists = await runner.run("SELECT to_regclass('copy_products') IS NULL");
    expect(exists.ok && exists.result.rows[0][0]).toBe(true);
  });
});

describe('buildSteps：作れない形', () => {
  it.each([
    ['LIMIT の外の OFFSET', 'SELECT name FROM products ORDER BY price OFFSET 2'],
    ['FETCH FIRST', 'SELECT name FROM products WHERE stock > 0 FETCH FIRST 3 ROWS ONLY'],
    ['FOR UPDATE', 'SELECT name FROM products FOR UPDATE'],
    ['DISTINCT ON', 'SELECT DISTINCT ON (category) category, name FROM products'],
    ['SELECT ALL', 'SELECT ALL name FROM products'],
    ['JOIN', 'SELECT * FROM products p JOIN products q ON p.id = q.id'],
    ['カンマで2つのテーブル', 'SELECT * FROM products, products AS q'],
    ['FROM のサブクエリ', 'SELECT * FROM (SELECT * FROM products) AS t'],
    ['FROM がない', 'SELECT 1'],
    ['書き換え系', 'UPDATE products SET price = 0'],
  ])('%s は unsupported', async (_label, sql) => {
    expect(await buildSteps(sql, runner)).toMatchObject({ ok: false, reason: 'unsupported' });
  });

  it('元のSQLがエラーになるときは error（PostgreSQL のメッセージ付き）', async () => {
    expect(await buildSteps('SELECT nope FROM products', runner)).toMatchObject({
      ok: false,
      reason: 'error',
      message: expect.stringContaining('nope'),
    });
  });
});
