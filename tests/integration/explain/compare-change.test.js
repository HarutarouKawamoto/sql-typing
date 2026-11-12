import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { compareChange, explainQuery } from '../../../src/core/explain.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

/*
 * インデックスのあり・なしの比較を、上級の初期データ（access_logs 5万行）の上で本物の PostgreSQL で確かめる。
 */

let runner;

beforeAll(async () => {
  runner = makeNodeRunner({ timeoutMs: 20_000 });
  await runner.prepare({ seedSql: readSeed('advanced.sql') });
});

afterAll(async () => {
  await runner.close();
});

const QUERY = "SELECT * FROM access_logs WHERE session_id = 's-31337'";

describe('compareChange', () => {
  it('インデックスなしは5万行を全部読み、作ったあとは索引で1行だけ読む', async () => {
    const result = await compareChange({
      runner,
      query: QUERY,
      changeSql: 'CREATE INDEX ON access_logs (session_id)',
    });
    expect(result.ok).toBe(true);
    expect(result.before.rowsRead).toBe(50000);
    expect(result.before.scans).toEqual([
      { nodeType: 'Seq Scan', relation: 'access_logs', index: null },
    ]);
    expect(result.after.rowsRead).toBe(1);
    expect(result.after.scans[0].nodeType).toMatch(/Index/);
    expect(result.after.executionMs).toBeLessThan(result.before.executionMs);
  });

  it('比べたあとは初期状態に戻る（作ったインデックスは残らない）', async () => {
    await compareChange({
      runner,
      query: QUERY,
      changeSql: 'CREATE INDEX ON access_logs (session_id)',
    });
    const indexes = await runner.run(
      "SELECT count(*) FROM pg_indexes WHERE tablename = 'access_logs' AND indexname <> 'access_logs_pkey'",
    );
    expect(indexes.ok && indexes.result.rows[0][0]).toBe(0);
  });

  it('関係のないインデックスでは、読む行は変わらない', async () => {
    const result = await compareChange({
      runner,
      query: QUERY,
      changeSql: 'CREATE INDEX ON access_logs (path)',
    });
    expect(result.ok && result.after.rowsRead).toBe(50000);
  });

  it('変えるSQLがエラーなら、どこで失敗したかを返す', async () => {
    expect(
      await compareChange({ runner, query: QUERY, changeSql: 'CREATE INDEX ON nothing (x)' }),
    ).toMatchObject({ ok: false, stage: 'change' });
  });

  it('SELECT 以外の問い合わせは実行せずに断る（EXPLAIN ANALYZE は実際に実行するため）', async () => {
    expect(
      await compareChange({ runner, query: 'DELETE FROM access_logs', changeSql: 'SELECT 1' }),
    ).toMatchObject({ ok: false, stage: 'before' });
    const count = await runner.run('SELECT count(*) FROM access_logs');
    expect(count.ok && count.result.rows[0][0]).toBe(50000);
  });

  it('変えるSQLでテーブルを消すと after で失敗し、初期状態に戻る', async () => {
    expect(
      await compareChange({ runner, query: QUERY, changeSql: 'DROP TABLE access_logs' }),
    ).toMatchObject({ ok: false, stage: 'after' });
    const count = await runner.run('SELECT count(*) FROM access_logs');
    expect(count.ok && count.result.rows[0][0]).toBe(50000);
  });

  it('問い合わせがエラーなら before で失敗', async () => {
    expect(
      await compareChange({ runner, query: 'SELECT * FROM nothing', changeSql: 'SELECT 1' }),
    ).toMatchObject({ ok: false, stage: 'before' });
  });
});

describe('explainQuery', () => {
  it('SELECT の実行計画と読んだ行・時間を返し、初期状態にもどす', async () => {
    const result = await explainQuery({
      runner,
      query:
        'SELECT c.region, count(*) FROM access_logs l JOIN customers c ON c.id = l.customer_id GROUP BY c.region',
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.summary.plan.children.length).toBeGreaterThan(0);
    expect(result.ok && result.summary.rowsRead).toBeGreaterThanOrEqual(50000);
  });

  it('SELECT 以外・エラーは ok: false', async () => {
    expect(await explainQuery({ runner, query: 'DELETE FROM access_logs' })).toMatchObject({
      ok: false,
    });
    // WITH は書き換え（WITH d AS (DELETE ...)）を含められるので断る。小文字・前の空白の select はよい
    expect(
      await explainQuery({
        runner,
        query: 'WITH d AS (DELETE FROM access_logs RETURNING 1) SELECT * FROM d',
      }),
    ).toMatchObject({ ok: false });
    expect(await explainQuery({ runner, query: '  select count(*) from customers' })).toMatchObject(
      {
        ok: true,
      },
    );
    expect(await explainQuery({ runner, query: 'SELECT * FROM nothing' })).toMatchObject({
      ok: false,
    });
    const count = await runner.run('SELECT count(*) FROM access_logs');
    expect(count.ok && count.result.rows[0][0]).toBe(50000);
  });
});
