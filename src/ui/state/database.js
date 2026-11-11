import { useEffect, useState } from 'react';
import { SqlRunner, createWorkerBackend } from '../../data/sql-runner/index.js';
import { loadSeed } from '../../data/seed-loader.js';

/** @type {SqlRunner | null} */
let sharedRunner = null;

/**
 * アプリに1つだけの SqlRunner（Worker 版）を返す。
 * 画面が何度描き直されても（StrictMode で effect が2回動いても）、PGlite の起動は1回だけ。
 * @returns {SqlRunner}
 */
export function getSqlRunner() {
  sharedRunner ??= new SqlRunner({ createBackend: createWorkerBackend });
  return sharedRunner;
}

/** @type {Promise<{ productCount: number }> | null} */
let bootPromise = null;

/**
 * PGlite を起動して初級の初期データを流す（1回だけ）。
 * 章を選ぶ画面ができたら、章ごとの prepare に置き換える。
 */
function bootDatabase() {
  bootPromise ??= (async () => {
    const runner = getSqlRunner();
    // PGlite の起動（WebAssembly の読み込み）と初期データの読み込みを同時に始める
    const [seedSql] = await Promise.all([loadSeed('beginner.sql'), runner.ready()]);
    await runner.prepare({ seedSql });
    const outcome = await runner.run('SELECT count(*) FROM products');
    if (!outcome.ok) throw new Error('初期データを確かめられませんでした');
    return { productCount: Number(outcome.result.rows[0][0]) };
  })();
  return bootPromise;
}

/**
 * @typedef {{ status: 'starting' } | { status: 'ready', productCount: number } | { status: 'error', message: string }} DatabaseStatus
 * @returns {DatabaseStatus}
 */
export function useDatabaseStatus() {
  const [state, setState] = useState(/** @type {DatabaseStatus} */ ({ status: 'starting' }));
  useEffect(() => {
    let active = true;
    bootDatabase().then(
      ({ productCount }) => active && setState({ status: 'ready', productCount }),
      (error) => {
        console.error(error);
        if (active) setState({ status: 'error', message: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
