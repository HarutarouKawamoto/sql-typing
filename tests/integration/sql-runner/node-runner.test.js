import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeNodeRunner } from '../../helpers/make-runner.js';

/*
 * Node 版の PGlite で SqlRunner を本当に動かす。
 * 初期データは小さなテスト用のもの（data/seeds/ の中身に左右されないように）。
 */

const SEED = `
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  ratio NUMERIC,
  released_on DATE NOT NULL
);
INSERT INTO items (name, price, ratio, released_on) VALUES
  ('Mug', 1200, 1.5, '2026-01-02'),
  ('Pen', 300, NULL, '2025-12-31');
`;

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
  await runner.prepare({ seedSql: SEED });
});

afterAll(async () => {
  await runner.close();
});

beforeEach(async () => {
  await runner.reset();
});

const rowsOf = async (sql) => {
  const outcome = await runner.run(sql);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome));
  return outcome.result.rows;
};

describe('結果の形と値', () => {
  it('列名と、値の配列の行で返る', async () => {
    const outcome = await runner.run('SELECT id, name FROM items ORDER BY id');
    expect(outcome).toEqual({
      ok: true,
      result: {
        columns: ['id', 'name'],
        rows: [
          [1, 'Mug'],
          [2, 'Pen'],
        ],
        affectedRows: 0,
      },
    });
  });

  it('日付は YYYY-MM-DD、NUMERIC と count(*) は数値、比較は真偽値、NULL は null', async () => {
    expect(
      await rowsOf(
        // WHERE を付けるとウィンドウ関数は絞った後の1行で計算されるので、ORDER BY と LIMIT で先頭を取る
        'SELECT released_on, ratio, count(*) OVER (), avg(price) OVER (), price > 500 FROM items ORDER BY id LIMIT 1',
      ),
    ).toEqual([['2026-01-02', 1.5, 2, 750, true]]);
    expect(await rowsOf("SELECT ratio FROM items WHERE name = 'Pen'")).toEqual([[null]]);
  });

  it('行の目印（ctid）を文字列で取れる（ステップ再生で使う）', async () => {
    expect(await rowsOf('SELECT ctid::text FROM items ORDER BY id')).toEqual([
      ['(0,1)'],
      ['(0,2)'],
    ]);
  });

  it('書き換え系は書き換えた行数を返す', async () => {
    const outcome = await runner.run('UPDATE items SET price = 0');
    expect(outcome.ok && outcome.result).toEqual({ columns: [], rows: [], affectedRows: 2 });
  });
});

describe('エラー', () => {
  it('ないテーブルは 42P01 と位置で返る', async () => {
    const outcome = await runner.run('SELECT * FROM nope');
    expect(outcome).toEqual({
      ok: false,
      error: {
        code: '42P01',
        message: 'relation "nope" does not exist',
        position: 15,
        multipleStatements: false,
      },
    });
  });

  it('文法の間違いは 42601', async () => {
    const outcome = await runner.run('SELEC * FROM items');
    expect(outcome.ok === false && outcome.error.code).toBe('42601');
  });

  it('2つの文は実行されず、複数の文の印が付く', async () => {
    const outcome = await runner.run('DELETE FROM items; SELECT 1');
    expect(outcome.ok === false && outcome.error.multipleStatements).toBe(true);
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('末尾の ; が1つあるだけなら実行できる', async () => {
    expect(await rowsOf('SELECT count(*) FROM items;')).toEqual([[2]]);
  });
});

describe('reset で初期状態に戻る', () => {
  it('UPDATE・DELETE のあと', async () => {
    await runner.run('UPDATE items SET price = 0');
    await runner.run('DELETE FROM items WHERE id = 2');
    await runner.reset();
    expect(await rowsOf('SELECT id, price FROM items ORDER BY id')).toEqual([
      [1, 1200],
      [2, 300],
    ]);
  });

  it('DROP TABLE のあと', async () => {
    await runner.run('DROP TABLE items');
    await runner.reset();
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('閉じていない BEGIN のあと', async () => {
    await runner.run('BEGIN');
    await runner.run('DELETE FROM items');
    await runner.reset();
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('学習者が作ったスキーマ・一時テーブル・インデックス・設定のあと', async () => {
    await runner.run('CREATE SCHEMA mine');
    await runner.run('CREATE TEMP TABLE scratch (x int)');
    await runner.run('CREATE INDEX items_price_idx ON items (price)');
    await runner.run("SET search_path TO 'mine'");
    await runner.reset();
    expect(await rowsOf("SELECT count(*) FROM pg_namespace WHERE nspname = 'mine'")).toEqual([[0]]);
    expect(await rowsOf("SELECT to_regclass('pg_temp.scratch') IS NULL")).toEqual([[true]]);
    expect(
      await rowsOf("SELECT count(*) FROM pg_indexes WHERE indexname = 'items_price_idx'"),
    ).toEqual([[0]]);
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('SET ROLE（スーパーユーザーでないロール）のあとでも戻り、ユーザーも元に戻る', async () => {
    const before = await rowsOf('SELECT current_user');
    await runner.run('CREATE ROLE learner_role');
    await runner.run('SET ROLE learner_role');
    await runner.reset();
    expect(await rowsOf('SELECT current_user')).toEqual(before);
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('PREPARE・LISTEN・アドバイザリーロックのあとでも片付く', async () => {
    await runner.run('PREPARE q AS SELECT 1');
    await runner.run('LISTEN channel_x');
    await runner.run('SELECT pg_advisory_lock(42)');
    await runner.reset();
    expect(await rowsOf('SELECT count(*) FROM pg_prepared_statements')).toEqual([[0]]);
    expect(await rowsOf('SELECT count(*) FROM pg_listening_channels()')).toEqual([[0]]);
    expect(await rowsOf("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")).toEqual([
      [0],
    ]);
  });

  it('close のあとに run すると、初期状態を流し直したDBで動く', async () => {
    await runner.close();
    expect(await rowsOf('SELECT count(*) FROM items')).toEqual([[2]]);
  });

  it('SERIAL の次の番号も戻る', async () => {
    await runner.run("INSERT INTO items (name, price, released_on) VALUES ('A', 1, '2026-01-01')");
    await runner.run("INSERT INTO items (name, price, released_on) VALUES ('B', 1, '2026-01-01')");
    await runner.reset();
    await runner.run("INSERT INTO items (name, price, released_on) VALUES ('C', 1, '2026-01-01')");
    expect(await rowsOf("SELECT id FROM items WHERE name = 'C'")).toEqual([[3]]);
  });

  it('prepare の extraSql も初期状態に入る', async () => {
    const other = makeNodeRunner();
    await other.prepare({
      seedSql: SEED,
      extraSql: "INSERT INTO items (name, price, released_on) VALUES ('Extra', 5, '2026-02-01');",
    });
    await other.run('DELETE FROM items');
    await other.reset();
    const outcome = await other.run('SELECT count(*) FROM items');
    expect(outcome.ok && outcome.result.rows).toEqual([[3]]);
    await other.close();
  });
});
