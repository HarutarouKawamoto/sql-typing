/**
 * ブラウザ用のバックエンド。PGlite を Web Worker（pglite.worker.js）の中で動かす。
 * @returns {Promise<import('./sql-runner.js').SqlBackend>}
 */
export async function createWorkerBackend() {
  const worker = new Worker(new URL('./pglite.worker.js', import.meta.url), { type: 'module' });
  /** @type {Map<number, { resolve: (value: any) => void, reject: (reason: unknown) => void }>} */
  const pending = new Map();
  let nextId = 1;
  let stopped = false;

  /** @param {unknown} reason */
  const rejectAll = (reason) => {
    for (const { reject } of pending.values()) reject(reason);
    pending.clear();
  };

  worker.addEventListener('message', (event) => {
    const { id, ok, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    // PG のエラーは { code, message, position } のまま返す（SqlRunner が学習者のエラーとして扱う）
    if (ok) entry.resolve(result);
    else entry.reject(error ?? new Error('データベースの Worker が理由なしで失敗しました'));
  });

  /** Worker そのものが使えなくなった。以降の要求はすぐ失敗させ、SqlRunner に作り直させる */
  const fail = (/** @type {string} */ reason) => {
    stopped = true;
    // code がないので SqlRunner は学習者のエラーではなく例外として扱い、バックエンドを捨てる
    rejectAll(new Error(`データベースの Worker が止まりました：${reason}`));
  };
  // 読み込めない・WebAssembly が動かない など。モジュールの Worker の読み込み失敗では message が空のことがある
  worker.addEventListener('error', (event) => fail(event.message || '原因不明'));
  worker.addEventListener('messageerror', () => fail('Worker からの返事を読めませんでした'));

  /**
   * @param {'ready' | 'exec' | 'query'} type
   * @param {string} [sql]
   */
  const call = (type, sql) => {
    if (stopped) return Promise.reject(new Error('データベースの Worker は止めてあります'));
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, sql });
    });
  };

  const terminate = () => {
    stopped = true;
    worker.terminate();
    rejectAll(new Error('データベースの Worker を止めました'));
  };

  try {
    await call('ready');
  } catch (error) {
    terminate();
    throw error;
  }

  return {
    exec: async (sql) => {
      await call('exec', sql);
    },
    query: (sql) => call('query', sql),
    terminate,
  };
}
