import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWorkerBackend } from '../../../src/data/sql-runner/worker-backend.js';

/**
 * Worker の作り物。postMessage された要求を requests に貯め、テストが reply で返事をする。
 */
class FakeWorker {
  static last = null;
  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    this.listeners = { message: [], error: [], messageerror: [] };
    this.requests = [];
    this.terminated = false;
    FakeWorker.last = this;
  }
  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }
  postMessage(data) {
    this.requests.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data) {
    for (const listener of this.listeners.message) listener({ data });
  }
  emit(type, event = {}) {
    for (const listener of this.listeners[type]) listener(event);
  }
}

/** ready の要求に答えて、使えるバックエンドにする */
async function startBackend() {
  const promise = createWorkerBackend();
  const worker = FakeWorker.last;
  worker.reply({ id: worker.requests[0].id, ok: true });
  return { backend: await promise, worker };
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createWorkerBackend', () => {
  it('モジュールの Worker を作り、ready の返事を待ってから使えるようになる', async () => {
    const { worker } = await startBackend();
    expect(worker.url).toContain('pglite.worker');
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.requests[0]).toMatchObject({ type: 'ready' });
  });

  it('query の結果を、要求の id で対応づけて返す', async () => {
    const { backend, worker } = await startBackend();
    const first = backend.query('SELECT 1');
    const second = backend.query('SELECT 2');
    const [, req1, req2] = worker.requests;
    // 返事の順番が逆でも、id で正しく対応づける
    worker.reply({ id: req2.id, ok: true, result: { fields: [], rows: [[2]] } });
    worker.reply({ id: req1.id, ok: true, result: { fields: [], rows: [[1]] } });
    expect((await first).rows).toEqual([[1]]);
    expect((await second).rows).toEqual([[2]]);
  });

  it('PG のエラーは { code, message, position } のまま reject する', async () => {
    const { backend, worker } = await startBackend();
    const query = backend.query('SELECT * FROM nope');
    const error = { code: '42P01', message: 'relation "nope" does not exist', position: 15 };
    worker.reply({ id: worker.requests[1].id, ok: false, error });
    await expect(query).rejects.toEqual(error);
  });

  it('Worker が落ちたら、待っている要求とその後の要求をすべて Error で失敗させる', async () => {
    const { backend, worker } = await startBackend();
    const pending = backend.query('SELECT 1');
    worker.emit('error', { message: '' });
    await expect(pending).rejects.toThrow('原因不明');
    await expect(backend.query('SELECT 2')).rejects.toThrow('止めてあります');
    expect(worker.requests).toHaveLength(2); // 落ちたあとは送らない
  });

  it('返事を読めなかったときも同じように失敗させる', async () => {
    const { backend, worker } = await startBackend();
    const pending = backend.exec('SELECT 1');
    worker.emit('messageerror');
    await expect(pending).rejects.toThrow('読めませんでした');
  });

  it('terminate で Worker を止め、待っている要求を失敗させる', async () => {
    const { backend, worker } = await startBackend();
    const pending = backend.query('SELECT pg_sleep(10)');
    backend.terminate();
    expect(worker.terminated).toBe(true);
    await expect(pending).rejects.toThrow('止めました');
  });

  it('起動（ready）に失敗したら Worker を止めて例外にする', async () => {
    const promise = createWorkerBackend();
    const worker = FakeWorker.last;
    worker.reply({ id: worker.requests[0].id, ok: false, error: { message: 'wasm failed' } });
    await expect(promise).rejects.toEqual({ message: 'wasm failed' });
    expect(worker.terminated).toBe(true);
  });
});
