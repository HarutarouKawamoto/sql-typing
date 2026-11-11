import { PGlite } from '@electric-sql/pglite';
import { VALUE_PARSERS } from './value-parsers.js';

/*
 * Web Worker の中で PGlite を動かす。画面のスレッドを止めないため。
 * やりとり：{ id, type: 'ready' | 'exec' | 'query', sql } → { id, ok: true, result? } | { id, ok: false, error }
 * PGlite 付属の PGliteWorker（複数タブで1つのDBを共有する仕組み）は使わない。
 * 打ち切りのときに worker.terminate() で確実に止めて作り直したいので、タブごとに別のDBを持つ。
 */

const dbPromise = PGlite.create();

/**
 * エラーを Worker の外に送れる形にする。PG のエラーは code（SQLSTATE）を持つ。
 * @param {unknown} error
 */
function serializeError(error) {
  const e = /** @type {{ code?: unknown, message?: unknown, position?: unknown }} */ (error ?? {});
  return {
    ...(typeof e.code === 'string' ? { code: e.code } : {}),
    message: String(e.message ?? error),
    ...(e.position !== undefined ? { position: e.position } : {}),
  };
}

self.addEventListener('message', async (event) => {
  const { id, type, sql } = event.data;
  try {
    const db = await dbPromise;
    if (type === 'ready') {
      self.postMessage({ id, ok: true });
    } else if (type === 'exec') {
      await db.exec(sql);
      self.postMessage({ id, ok: true });
    } else if (type === 'query') {
      const result = await db.query(sql, [], { rowMode: 'array', parsers: VALUE_PARSERS });
      self.postMessage({
        id,
        ok: true,
        result: { fields: result.fields, rows: result.rows, affectedRows: result.affectedRows },
      });
    } else {
      self.postMessage({ id, ok: false, error: { message: `未知の要求: ${type}` } });
    }
  } catch (error) {
    self.postMessage({ id, ok: false, error: serializeError(error) });
  }
});
