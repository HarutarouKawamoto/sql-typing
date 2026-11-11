/**
 * PGlite（PostgreSQL）への窓口。
 * - 実行は1つずつ順番に流す（ready / prepare / reset / run / close は1本の列に並ぶ）
 * - 初期状態（章の初期データ＋問題の extraSql）を覚え、いつでもその状態に戻せる
 * - 時間のかかりすぎたSQLは打ち切り、中身（バックエンド）を作り直して初期状態に戻す
 * - バックエンドを作り直したら（打ち切り・close・Worker が落ちた）、次に使う前に必ず初期状態を流し直す
 * 学習者のSQLのエラー・打ち切りは結果のオブジェクトで返し、例外にしない。
 * 元：docs/functional-design.md の SqlRunner
 */

/**
 * @typedef {Object} SqlBackend
 * @property {(sql: string) => Promise<void>} exec        複数の文を流す（初期データ用）
 * @property {(sql: string) => Promise<RawResult>} query  1つの文を実行する。PG のエラーは { code, message, position } で reject
 * @property {() => void} terminate                        すぐに止める（打ち切り用）
 *
 * @typedef {{ fields: { name: string }[], rows: unknown[][], affectedRows?: number }} RawResult
 *
 * @typedef {string | number | boolean | null} SqlValue
 * @typedef {{ columns: string[], rows: SqlValue[][], affectedRows: number }} QueryResult
 * @typedef {{ code: string, message: string, position?: number, multipleStatements: boolean }} PgError
 * @typedef {{ ok: true, result: QueryResult } | { ok: false, error: PgError } | { ok: false, timeout: true }} RunOutcome
 * @typedef {{ seedSql: string, extraSql: string }} InitialState
 */

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_START_ATTEMPTS = 3;
/** 1回の起動を待つ上限。WebAssembly の読み込みが止まったときに「準備中」のまま止まらないように */
export const DEFAULT_START_TIMEOUT_MS = 30_000;
/** 初期状態の流し直しを待つ上限 */
export const DEFAULT_RESTORE_TIMEOUT_MS = 15_000;

/** PGlite の query() が2つ以上の文を受け取ったときのメッセージ（SQLSTATE 42601） */
const MULTIPLE_STATEMENTS_MESSAGE = 'cannot insert multiple commands into a prepared statement';

/** SQLSTATE は数字と大文字の5文字。Node の ENOENT など、ほかの code と見分けるため */
const SQLSTATE = /^[0-9A-Z]{5}$/;

const TIMEOUT = Symbol('timeout');

/**
 * PGlite の値を、このアプリの値（string | number | boolean | null）にそろえる。
 * 型ごとの変換は value-parsers.js で済ませてあり、ここは取りこぼしの受け皿。
 * @param {unknown} value
 * @returns {SqlValue}
 */
export function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  // 配列・JSON など。表に出すときに読めるように文字列にする
  return JSON.stringify(value);
}

/**
 * @param {RawResult} raw
 * @returns {QueryResult}
 */
export function normalizeResult(raw) {
  return {
    columns: raw.fields.map((field) => field.name),
    rows: raw.rows.map((row) => row.map(normalizeValue)),
    affectedRows: raw.affectedRows ?? 0,
  };
}

/**
 * PG のエラーを PgError にする。PG のエラーでない（SQLSTATE の code がない）ものは null。
 * @param {unknown} error
 * @returns {PgError | null}
 */
export function toPgError(error) {
  if (!error || typeof error !== 'object') return null;
  const e = /** @type {{ code?: unknown, message?: unknown, position?: unknown }} */ (error);
  if (typeof e.code !== 'string' || !SQLSTATE.test(e.code)) return null;
  const message = String(e.message ?? '');
  const position = Number(e.position);
  return {
    code: e.code,
    message,
    ...(Number.isFinite(position) && position > 0 ? { position } : {}),
    multipleStatements: e.code === '42601' && message.includes(MULTIPLE_STATEMENTS_MESSAGE),
  };
}

/**
 * スキーマ名を SQL の識別子として安全に書く。
 * @param {string} name
 * @returns {string}
 */
function quoteIdent(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * promise が ms 以内に終わらなければ onTimeout を呼んで、message の例外にする。
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @param {() => void} [onTimeout]
 * @returns {Promise<T>}
 */
async function withDeadline(promise, ms, message, onTimeout) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(message));
    }, ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export class SqlRunner {
  /** @type {() => Promise<SqlBackend>} */
  #createBackend;
  #timeoutMs;
  #startAttempts;
  #startTimeoutMs;
  #restoreTimeoutMs;
  /** @type {SqlBackend | null} */
  #backend = null;
  /** 今のバックエンドに初期状態が流してあるか */
  #restored = false;
  /** @type {InitialState | null} */
  #initial = null;
  /** @type {Promise<unknown>} */
  #queue = Promise.resolve();

  /**
   * @param {{
   *   createBackend: () => Promise<SqlBackend>,
   *   timeoutMs?: number, startAttempts?: number, startTimeoutMs?: number, restoreTimeoutMs?: number,
   * }} options
   */
  constructor({
    createBackend,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    startAttempts = DEFAULT_START_ATTEMPTS,
    startTimeoutMs = DEFAULT_START_TIMEOUT_MS,
    restoreTimeoutMs = DEFAULT_RESTORE_TIMEOUT_MS,
  }) {
    this.#createBackend = createBackend;
    this.#timeoutMs = timeoutMs;
    this.#startAttempts = startAttempts;
    this.#startTimeoutMs = startTimeoutMs;
    this.#restoreTimeoutMs = restoreTimeoutMs;
  }

  /**
   * 前の処理が終わってから job を動かす。job が失敗しても列は止めない。
   * @template T
   * @param {() => Promise<T>} job
   * @returns {Promise<T>}
   */
  #enqueue(job) {
    const next = this.#queue.then(job);
    this.#queue = next.catch(() => {});
    return next;
  }

  /** 今のバックエンドを捨てる。次に使うときに作り直し、初期状態を流し直す */
  #discardBackend() {
    this.#backend?.terminate();
    this.#backend = null;
    this.#restored = false;
  }

  /** バックエンドがなければ起動する（失敗・時間切れは startAttempts 回まで試す） */
  async #startBackend() {
    if (this.#backend) return this.#backend;
    let lastError;
    for (let attempt = 1; attempt <= this.#startAttempts; attempt += 1) {
      /** @type {Promise<SqlBackend>} */
      const starting = this.#createBackend();
      try {
        this.#backend = await withDeadline(
          starting,
          this.#startTimeoutMs,
          `データベースの起動が ${this.#startTimeoutMs}ms 以内に終わりませんでした`,
          // 時間切れのあとに起動が終わったら、そのバックエンドは使わずに止める
          () => void starting.then((late) => late.terminate()).catch(() => {}),
        );
        this.#restored = false;
        return this.#backend;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `データベース（PGlite）を ${this.#startAttempts} 回試しても起動できませんでした`,
      {
        cause: lastError,
      },
    );
  }

  /**
   * initial の初期状態を作り直す。学習者が DROP TABLE・ALTER TABLE・CREATE INDEX・閉じていない BEGIN・
   * SET ROLE・LISTEN・PREPARE・自分で作ったスキーマや一時テーブルを残しても戻るように、
   * セッションを片付けてからスキーマごと作り直し、初期データを流し直す。
   * 戻らないもの（ロール・データベース・ラージオブジェクトなど、クラスタ全体に残るもの）は
   * 問題として出さない前提（docs/functional-design.md の SqlRunner）。
   * @param {InitialState} initial
   */
  async #restore(initial) {
    const backend = await this.#startBackend();
    this.#restored = false;
    const steps = async () => {
      // DISCARD ALL はトランザクションの中で実行できないので、ROLLBACK と別に流す。
      // DISCARD ALL は RESET ALL・RESET ROLE・RESET SESSION AUTHORIZATION・DEALLOCATE ALL・CLOSE ALL・
      // UNLISTEN *・一時テーブルの削除・アドバイザリーロックの解除をまとめて行う
      await backend.exec('ROLLBACK');
      await backend.exec('DISCARD ALL');
      const schemas = await backend.query(
        "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'",
      );
      const drops = schemas.rows.map(
        ([name]) => `DROP SCHEMA ${quoteIdent(String(name))} CASCADE;`,
      );
      await backend.exec(
        [...drops, 'CREATE SCHEMA public;', initial.seedSql, initial.extraSql].join('\n'),
      );
    };
    try {
      await withDeadline(
        steps(),
        this.#restoreTimeoutMs,
        `初期状態の流し直しが ${this.#restoreTimeoutMs}ms 以内に終わりませんでした`,
      );
    } catch (error) {
      // PG のエラー（初期データの書き間違い）なら DB は途中の状態。そうでなければバックエンドが怪しいので捨てる
      if (!toPgError(error)) this.#discardBackend();
      throw error;
    }
    this.#restored = true;
  }

  /** 初期状態が流してあるバックエンドを用意する（作り直した直後なら流し直す） */
  async #ensureReady() {
    if (!this.#initial) throw new Error('prepare() を呼んで初期状態を決めてから使ってください');
    await this.#startBackend();
    if (!this.#restored) await this.#restore(this.#initial);
    return /** @type {SqlBackend} */ (this.#backend);
  }

  /** PGlite を起動する。何度呼んでも起動は1回だけ */
  ready() {
    return this.#enqueue(async () => {
      await this.#startBackend();
    });
  }

  /**
   * 初期状態を決めて、その状態にする。流し直しに失敗したら、前の初期状態のまま（次に使うときに流し直す）。
   * @param {{ seedSql: string, extraSql?: string }} initial
   */
  prepare({ seedSql, extraSql = '' }) {
    return this.#enqueue(async () => {
      const next = { seedSql, extraSql };
      await this.#restore(next);
      this.#initial = next;
    });
  }

  /** 初期状態に戻す */
  reset() {
    return this.#enqueue(async () => {
      if (!this.#initial) throw new Error('reset() の前に prepare() を呼んでください');
      await this.#restore(this.#initial);
    });
  }

  /**
   * SQLを1つ実行する。prepare() の前に呼ぶと例外。
   * @param {string} sql
   * @param {{ timeoutMs?: number }} [options]
   * @returns {Promise<RunOutcome>}
   */
  run(sql, { timeoutMs = this.#timeoutMs } = {}) {
    return this.#enqueue(async () => {
      const backend = await this.#ensureReady();
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
      });
      let outcome;
      try {
        outcome = await Promise.race([
          backend.query(sql).then(
            (raw) => ({ raw }),
            (error) => ({ error }),
          ),
          timeout,
        ]);
      } finally {
        clearTimeout(timer);
      }

      if (outcome === TIMEOUT) {
        // 止まらないSQLは、バックエンドごと捨てて作り直す。作り直しに失敗しても打ち切ったことは返し、
        // 次の操作でもう一度作り直す
        this.#discardBackend();
        try {
          await this.#ensureReady();
        } catch {
          // 次の操作の #ensureReady() でやり直す
        }
        return { ok: false, timeout: true };
      }
      if ('error' in outcome) {
        const pgError = toPgError(outcome.error);
        if (!pgError) {
          // PG のエラーでないもの（Worker が落ちた など）はプログラムやブラウザの問題。
          // 壊れたバックエンドを捨ててから投げる（次の操作で作り直す）
          this.#discardBackend();
          throw outcome.error instanceof Error
            ? outcome.error
            : new Error(`データベースの実行に失敗しました：${String(outcome.error)}`);
        }
        return { ok: false, error: pgError };
      }
      return { ok: true, result: normalizeResult(outcome.raw) };
    });
  }

  /** バックエンドを止める。このあと使うと、起動し直して初期状態を流し直す */
  close() {
    return this.#enqueue(async () => {
      this.#discardBackend();
    });
  }
}
