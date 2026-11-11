import { PGlite } from '@electric-sql/pglite';
import { VALUE_PARSERS } from './value-parsers.js';

/**
 * テスト用のバックエンド。同じプロセスで PGlite を動かす。
 * 制約：同じプロセスの WebAssembly が動いている間は Node のイベントループも止まるので、
 * SqlRunner の打ち切りの時計が動かない（pg_sleep(2) は timeoutMs: 500 でも2秒後に ok で返る）。
 * 打ち切りの動きは作り物のバックエンドで単体テストする。終わらないSQLをテストで流さないこと。
 * @returns {Promise<import('./sql-runner.js').SqlBackend>}
 */
export async function createNodeBackend() {
  const db = await PGlite.create();
  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async query(sql) {
      const result = await db.query(sql, [], { rowMode: 'array', parsers: VALUE_PARSERS });
      return { fields: result.fields, rows: result.rows, affectedRows: result.affectedRows };
    },
    terminate() {
      // すでに閉じている場合などの失敗は、止めたいだけなので無視する
      db.close().catch(() => {});
    },
  };
}
