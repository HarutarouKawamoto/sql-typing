import { describe, it, expect, vi } from 'vitest';
import {
  SqlRunner,
  normalizeValue,
  normalizeResult,
  toPgError,
} from '../../../src/data/sql-runner/sql-runner.js';

/**
 * 作り物のバックエンド。query の中身はテストごとに決める。
 * 呼ばれた順番を log に残す（初期状態の流し直しは 'restore' とだけ書く）。
 */
function makeFakeBackend({ query = async () => ({ fields: [], rows: [] }), exec } = {}) {
  const log = [];
  const backend = {
    log,
    exec: vi.fn(async (sql) => {
      log.push(`exec:${sql.includes('CREATE SCHEMA public') ? 'restore' : sql}`);
      if (exec) await exec(sql);
    }),
    query: vi.fn(async (sql) => {
      if (sql.includes('pg_namespace')) {
        return { fields: [{ name: 'nspname' }], rows: [['public']] };
      }
      log.push(`query:${sql}`);
      return query(sql);
    }),
    terminate: vi.fn(() => log.push('terminate')),
  };
  return backend;
}

const RESTORE_LOG = ['exec:ROLLBACK', 'exec:DISCARD ALL', 'exec:restore'];
const neverResolves = () => new Promise(() => {});

/** 作るたびに backends に足していく createBackend */
function backendFactory(options) {
  const backends = [];
  const createBackend = vi.fn(async () => {
    const backend = makeFakeBackend(
      typeof options === 'function' ? options(backends.length) : options,
    );
    backends.push(backend);
    return backend;
  });
  return { backends, createBackend };
}

async function preparedRunner(runnerOptions = {}, backendOptions = {}) {
  const factory = backendFactory(backendOptions);
  const runner = new SqlRunner({ createBackend: factory.createBackend, ...runnerOptions });
  await runner.prepare({ seedSql: 'SEED', extraSql: 'EXTRA' });
  return { runner, ...factory };
}

describe('normalizeValue', () => {
  it('文字列・数値・真偽値・NULL はそのまま、BIGINT と Date はそろえる', () => {
    expect(normalizeValue('a')).toBe('a');
    expect(normalizeValue(1)).toBe(1);
    expect(normalizeValue(false)).toBe(false);
    expect(normalizeValue(undefined)).toBe(null);
    expect(normalizeValue(30n)).toBe(30);
    expect(normalizeValue(9223372036854775807n)).toBe('9223372036854775807');
    expect(normalizeValue(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02T00:00:00.000Z');
    expect(normalizeValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('normalizeResult', () => {
  it('列名の配列・行の配列・書き換えた行数にする', () => {
    const result = normalizeResult({ fields: [{ name: 'id' }, { name: 'n' }], rows: [[1, 2n]] });
    expect(result).toEqual({ columns: ['id', 'n'], rows: [[1, 2]], affectedRows: 0 });
  });
});

describe('toPgError', () => {
  it('code・message・position を取り出す', () => {
    expect(
      toPgError({ code: '42P01', message: 'relation "x" does not exist', position: '15' }),
    ).toEqual({
      code: '42P01',
      message: 'relation "x" does not exist',
      position: 15,
      multipleStatements: false,
    });
  });

  it('複数の文のエラーに印を付ける', () => {
    const error = toPgError({
      code: '42601',
      message: 'cannot insert multiple commands into a prepared statement',
    });
    expect(error.multipleStatements).toBe(true);
    expect(error).not.toHaveProperty('position');
  });

  it('PG のエラーでないもの（code がない・SQLSTATE の形でない）は null', () => {
    expect(toPgError(new Error('worker crashed'))).toBe(null);
    expect(toPgError(Object.assign(new Error('no file'), { code: 'ENOENT' }))).toBe(null);
    expect(toPgError(undefined)).toBe(null);
  });
});

describe('SqlRunner：順番と結果', () => {
  it('実行は1つずつ、呼んだ順番に動く', async () => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const { runner, backends } = await preparedRunner(
      {},
      {
        query: async (sql) => {
          if (sql === 'slow') await gate;
          return { fields: [{ name: 'x' }], rows: [[sql]] };
        },
      },
    );
    const first = runner.run('slow');
    const second = runner.run('fast');
    const log = backends[0].log;
    // slow が始まるまで待ち、fast がまだ始まっていないことを確かめる
    await vi.waitFor(() => expect(log.at(-1)).toBe('query:slow'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log.at(-1)).toBe('query:slow');
    release();
    expect((await first).result.rows).toEqual([['slow']]);
    expect((await second).result.rows).toEqual([['fast']]);
    expect(log.slice(-2)).toEqual(['query:slow', 'query:fast']);
  });

  it('PG のエラーは例外にせず { ok: false, error } で返す', async () => {
    const { runner } = await preparedRunner(
      {},
      {
        query: async () => {
          throw { code: '42601', message: 'syntax error at or near "SELEC"', position: 1 };
        },
      },
    );
    expect(await runner.run('SELEC 1')).toEqual({
      ok: false,
      error: {
        code: '42601',
        message: 'syntax error at or near "SELEC"',
        position: 1,
        multipleStatements: false,
      },
    });
  });

  it('prepare の前に run・reset を呼ぶと例外', async () => {
    const runner = new SqlRunner({ createBackend: async () => makeFakeBackend() });
    await expect(runner.run('SELECT 1')).rejects.toThrow('prepare()');
    await expect(runner.reset()).rejects.toThrow('prepare()');
  });

  it('初期状態の流し直しは ROLLBACK → DISCARD ALL → スキーマの作り直しと初期データ', async () => {
    const { backends } = await preparedRunner();
    expect(backends[0].log).toEqual(RESTORE_LOG);
    const restoreSql = backends[0].exec.mock.calls[2][0];
    expect(restoreSql).toContain('SEED');
    expect(restoreSql).toContain('EXTRA');
  });

  it('学習者が作ったスキーマも消してから初期データを流す', async () => {
    const backend = makeFakeBackend();
    backend.query.mockImplementation(async (sql) => {
      if (sql.includes('pg_namespace')) {
        return { fields: [{ name: 'nspname' }], rows: [['public'], ['my"schema']] };
      }
      return { fields: [], rows: [] };
    });
    const runner = new SqlRunner({ createBackend: async () => backend });
    await runner.prepare({ seedSql: 'SEED' });
    const restoreSql = backend.exec.mock.calls[2][0];
    expect(restoreSql).toContain('DROP SCHEMA "public" CASCADE;');
    expect(restoreSql).toContain('DROP SCHEMA "my""schema" CASCADE;');
    expect(restoreSql.indexOf('CREATE SCHEMA public;')).toBeLessThan(restoreSql.indexOf('SEED'));
  });
});

describe('SqlRunner：打ち切り', () => {
  it('時間切れなら timeout を返し、作り直して初期状態を流し直す。後の実行はそのあと動く', async () => {
    const { runner, backends } = await preparedRunner(
      { timeoutMs: 20 },
      { query: async (sql) => (sql === 'endless' ? neverResolves() : { fields: [], rows: [] }) },
    );
    const stuck = runner.run('endless');
    const after = runner.run('next');

    expect(await stuck).toEqual({ ok: false, timeout: true });
    expect((await after).ok).toBe(true);
    expect(backends).toHaveLength(2);
    expect(backends[0].terminate).toHaveBeenCalledTimes(1);
    expect(backends[1].log).toEqual([...RESTORE_LOG, 'query:next']);
  });

  it('打ち切り後の作り直しに失敗しても timeout を返し、次の実行でもう一度作り直す', async () => {
    let created = 0;
    const createBackend = vi.fn(async () => {
      created += 1;
      // 1つ目は使える。2〜4つ目（打ち切り後の作り直し3回）は失敗。5つ目からまた使える
      if (created >= 2 && created <= 4) throw new Error('boot failed');
      return makeFakeBackend({
        query: async (sql) => (sql === 'endless' ? neverResolves() : { fields: [], rows: [[1]] }),
      });
    });
    const runner = new SqlRunner({ createBackend, timeoutMs: 20 });
    await runner.prepare({ seedSql: 'SEED' });

    expect(await runner.run('endless')).toEqual({ ok: false, timeout: true });
    const next = await runner.run('SELECT 1');
    expect(next.ok).toBe(true);
    expect(createBackend).toHaveBeenCalledTimes(5);
  });
});

describe('SqlRunner：バックエンドを作り直したあと', () => {
  it('close のあとに run すると、起動し直して初期状態を流し直してから実行する', async () => {
    const { runner, backends } = await preparedRunner();
    await runner.close();
    expect(backends[0].terminate).toHaveBeenCalledTimes(1);
    expect((await runner.run('SELECT 1')).ok).toBe(true);
    expect(backends).toHaveLength(2);
    expect(backends[1].log).toEqual([...RESTORE_LOG, 'query:SELECT 1']);
  });

  it('PG 以外のエラー（Worker が落ちた など）は投げ、バックエンドを捨てる。次の実行は作り直したもので動く', async () => {
    const { runner, backends } = await preparedRunner({}, (index) => ({
      query: async () => {
        if (index === 0) throw new Error('worker crashed');
        return { fields: [], rows: [] };
      },
    }));
    await expect(runner.run('a')).rejects.toThrow('worker crashed');
    expect(backends[0].terminate).toHaveBeenCalledTimes(1);
    expect((await runner.run('b')).ok).toBe(true);
    expect(backends[1].log).toEqual([...RESTORE_LOG, 'query:b']);
  });

  it('PG 以外のエラーが Error でなくても Error にして投げる', async () => {
    const { runner } = await preparedRunner(
      {},
      {
        query: async () => {
          throw undefined;
        },
      },
    );
    await expect(runner.run('a')).rejects.toThrow('データベースの実行に失敗しました');
  });
});

describe('SqlRunner：prepare の失敗', () => {
  it('初期データが壊れていたら例外にし、前の初期状態のまま。次の実行で前の初期状態を流し直す', async () => {
    const { runner, backends } = await preparedRunner(
      {},
      {
        exec: async (sql) => {
          if (sql.includes('BROKEN')) throw { code: '42601', message: 'syntax error' };
        },
      },
    );
    await expect(runner.prepare({ seedSql: 'BROKEN' })).rejects.toMatchObject({ code: '42601' });
    expect((await runner.run('SELECT 1')).ok).toBe(true);
    const lastRestore = backends[0].exec.mock.calls.at(-1)[0];
    expect(lastRestore).toContain('SEED');
    expect(lastRestore).not.toContain('BROKEN');
  });

  it('流し直しが時間内に終わらなければ例外にし、バックエンドを捨てる', async () => {
    const { backends, createBackend } = backendFactory({
      exec: async (sql) => (sql.includes('SLOW') ? neverResolves() : undefined),
    });
    const runner = new SqlRunner({ createBackend, restoreTimeoutMs: 20 });
    await expect(runner.prepare({ seedSql: 'SLOW' })).rejects.toThrow('流し直し');
    expect(backends[0].terminate).toHaveBeenCalledTimes(1);
  });
});

describe('SqlRunner：起動', () => {
  it('起動に2回失敗しても3回目で使える', async () => {
    let attempts = 0;
    const runner = new SqlRunner({
      createBackend: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('boot failed');
        return makeFakeBackend();
      },
    });
    await runner.ready();
    expect(attempts).toBe(3);
  });

  it('3回とも起動に失敗したら例外にする（元のエラーを cause に持つ）', async () => {
    const runner = new SqlRunner({
      createBackend: async () => {
        throw new Error('boot failed');
      },
    });
    const error = await runner.ready().catch((e) => e);
    expect(error.message).toContain('3 回試しても起動できませんでした');
    expect(error.cause.message).toBe('boot failed');
  });

  it('起動が時間内に終わらなければ、試し直したうえで例外にする（「準備中」のまま止まらない）', async () => {
    const createBackend = vi.fn(() => neverResolves());
    const runner = new SqlRunner({ createBackend, startTimeoutMs: 10 });
    const error = await runner.ready().catch((e) => e);
    expect(error.message).toContain('起動できませんでした');
    expect(error.cause.message).toContain('以内に終わりませんでした');
    expect(createBackend).toHaveBeenCalledTimes(3);
  });

  it('ready を何度呼んでも起動は1回', async () => {
    const { runner, createBackend } = await preparedRunner();
    await Promise.all([runner.ready(), runner.ready()]);
    await runner.run('x');
    expect(createBackend).toHaveBeenCalledTimes(1);
  });
});
