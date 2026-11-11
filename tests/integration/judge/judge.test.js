import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { judge, computeExpected } from '../../../src/core/judge.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';
import { makeProblem } from '../../helpers/problem-factory.js';

/*
 * 判定を、初級の初期データ（products 30行）と本物の PostgreSQL で確かめる。
 */

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
  await runner.prepare({ seedSql: readSeed('beginner.sql') });
});

afterAll(async () => {
  await runner.close();
});

const problemOf = (answer, judgeRule = {}) =>
  makeProblem({
    answer,
    judge: { ordered: false, checkColumnNames: false, require: [], forbid: [], ...judgeRule },
  });

async function judgeWith(sql, problem) {
  const expected = await computeExpected({ problem, runner });
  return judge({ sql, problem, runner, expected });
}

describe('judge：正解と別解', () => {
  it('正解SQLそのものは correct', async () => {
    const problem = problemOf('SELECT name, price FROM products WHERE price >= 1000');
    expect((await judgeWith(problem.answer, problem)).status).toBe('correct');
  });

  it('IN と OR、大文字・小文字・改行が違っても結果が同じなら correct', async () => {
    const problem = problemOf("SELECT name FROM products WHERE category IN ('kitchen', 'bag')");
    const result = await judgeWith(
      "select name\nfrom products\nwhere category = 'bag' or category = 'kitchen'",
      problem,
    );
    expect(result.status).toBe('correct');
  });

  it('expected を渡さなくても、その場で正解の結果を作って判定する', async () => {
    const problem = problemOf('SELECT name FROM products WHERE stock = 0');
    expect((await judge({ sql: problem.answer, problem, runner })).status).toBe('correct');
  });
});

describe('judge：同じ結果になる別の条件は正解', () => {
  it('ちょうど1000円の商品がないので、price > 1000 は price >= 1000 の別解として correct', async () => {
    const problem = problemOf('SELECT name, price FROM products WHERE price >= 1000');
    expect(
      (await judgeWith('SELECT name, price FROM products WHERE price > 1000', problem)).status,
    ).toBe('correct');
  });
});

describe('judge：不正解の理由', () => {
  const problem = problemOf('SELECT name, price FROM products WHERE price >= 1000');

  it.each([
    ['columnCount', 'SELECT name FROM products WHERE price >= 1000'],
    // ちょうど1000円の商品はないので、> 1000 は >= 1000 と同じ結果（正解）になる。1200円の Mug Cup Blue で差を作る
    ['rowCount', 'SELECT name, price FROM products WHERE price > 1200'],
    ['values', 'SELECT name, stock FROM products WHERE price >= 1000'],
  ])('%s', async (reason, sql) => {
    const result = await judgeWith(sql, problem);
    expect(result).toMatchObject({ status: 'wrong', reason });
    expect(result.message).toMatch(/違/);
    expect(result.mine.columns.length).toBeGreaterThan(0);
  });

  it('ordered の問題で並びが違うと order', async () => {
    const ordered = problemOf('SELECT name, price FROM products ORDER BY price DESC LIMIT 5', {
      ordered: true,
    });
    const result = await judgeWith(
      'SELECT name, price FROM products WHERE price >= 4800 ORDER BY price ASC',
      ordered,
    );
    expect(result).toMatchObject({ status: 'wrong', reason: 'order' });
  });

  it('checkColumnNames の問題で AS を付け忘れると columnNames', async () => {
    const named = problemOf('SELECT name AS item, price FROM products', { checkColumnNames: true });
    expect(await judgeWith('SELECT name, price FROM products', named)).toMatchObject({
      status: 'wrong',
      reason: 'columnNames',
    });
  });
});

describe('judge：条件・エラー・打ち切り', () => {
  it('結果は正しいが require の語がないと ruleViolation', async () => {
    const problem = problemOf('SELECT name FROM products WHERE price BETWEEN 500 AND 2000', {
      require: ['BETWEEN'],
    });
    const result = await judgeWith(
      'SELECT name FROM products WHERE price >= 500 AND price <= 2000',
      problem,
    );
    expect(result).toMatchObject({ status: 'ruleViolation' });
    expect(result.message).toContain('BETWEEN');
  });

  it('エラーは和訳つきの error', async () => {
    const problem = problemOf('SELECT name FROM products');
    const result = await judgeWith('SELECT name FROM product', problem);
    expect(result.status).toBe('error');
    expect(result.error).toMatchObject({ code: '42P01', title: 'そのテーブルはありません' });
  });

  it('2つの文は error（1回に実行できるSQLは1つです）', async () => {
    const problem = problemOf('SELECT name FROM products');
    const result = await judgeWith('SELECT name FROM products; SELECT 1', problem);
    expect(result.error.title).toBe('1回に実行できるSQLは1つです');
  });

  it('打ち切りは timeout（作り物の runner）', async () => {
    const fake = {
      reset: async () => {},
      run: async (sql) =>
        sql.includes('pg_sleep')
          ? { ok: false, timeout: true }
          : { ok: true, result: { columns: ['x'], rows: [[1]], affectedRows: 0 } },
    };
    const problem = problemOf('SELECT 1 AS x');
    const expected = await computeExpected({ problem, runner: fake });
    expect(await judge({ sql: 'SELECT pg_sleep(10)', problem, runner: fake, expected })).toEqual({
      status: 'timeout',
      message: '5秒で打ち切りました。終わらない条件になっていないか確かめてください',
    });
  });
});

describe('judge：DB を戻す・書き換え系', () => {
  it('判定のあと、学習者の UPDATE は初期状態に戻っている', async () => {
    const problem = problemOf('SELECT name FROM products');
    await judgeWith("UPDATE products SET name = 'X'", problem);
    const check = await runner.run("SELECT count(*) FROM products WHERE name = 'X'");
    expect(check.ok && check.result.rows[0][0]).toBe(0);
  });

  it('compareTable の問題は、実行後のテーブルの中身で比べる（別の書き方の UPDATE も correct）', async () => {
    const problem = problemOf("UPDATE products SET stock = 0 WHERE category = 'bag'", {
      compareTable: 'products',
    });
    const same = await judgeWith(
      "UPDATE products SET stock = 0 WHERE category IN ('bag')",
      problem,
    );
    expect(same.status).toBe('correct');
    const different = await judgeWith(
      "UPDATE products SET stock = 0 WHERE category = 'kitchen'",
      problem,
    );
    expect(different).toMatchObject({ status: 'wrong', reason: 'values' });
  });

  it('computeExpected：正解SQLがエラーなら ok: false', async () => {
    const result = await computeExpected({
      problem: problemOf('SELECT nope FROM products'),
      runner,
    });
    expect(result).toMatchObject({ ok: false });
  });
});

describe('judge：検証で見つかった取り違え', () => {
  it('空のSQLは wrong / empty', async () => {
    const problem = problemOf('SELECT name FROM products');
    expect(await judgeWith('  -- まだ書いていない\n', problem)).toEqual({
      status: 'wrong',
      reason: 'empty',
      message: 'SQLが空です',
    });
  });

  it('書き換え系で VALUES の行の順番が違っても、ignoreColumns で id を外せば correct', async () => {
    const answer =
      "INSERT INTO products (name, category, price, stock, released_on) VALUES ('A', 'bag', 1, 1, '2026-01-01'), ('B', 'bag', 2, 1, '2026-01-01')";
    const swapped =
      "INSERT INTO products (name, category, price, stock, released_on) VALUES ('B', 'bag', 2, 1, '2026-01-01'), ('A', 'bag', 1, 1, '2026-01-01')";
    const strict = problemOf(answer, { compareTable: 'products' });
    expect((await judgeWith(swapped, strict)).status).toBe('wrong');
    const loose = problemOf(answer, { compareTable: 'products', ignoreColumns: ['id'] });
    expect((await judgeWith(swapped, loose)).status).toBe('correct');
  });

  it('書き換え系でテーブルを消したら wrong / tableMissing', async () => {
    const problem = problemOf("UPDATE products SET stock = 0 WHERE category = 'bag'", {
      compareTable: 'products',
    });
    expect(await judgeWith('DROP TABLE products', problem)).toMatchObject({
      status: 'wrong',
      reason: 'tableMissing',
    });
  });

  it('列の並び順が違うと columnOrder', async () => {
    const problem = problemOf('SELECT name, price FROM products');
    expect(await judgeWith('SELECT price, name FROM products', problem)).toMatchObject({
      status: 'wrong',
      reason: 'columnOrder',
    });
  });
});
