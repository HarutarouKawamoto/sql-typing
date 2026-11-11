import { describe, it, expect } from 'vitest';
import { createExclusive } from '../../../src/ui/state/db-jobs.js';

/** 外から終わらせられる仕事 */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createExclusive', () => {
  it('前の仕事が終わるまで、次の仕事を始めない', async () => {
    const exclusive = createExclusive();
    const log = [];
    const first = deferred();
    const a = exclusive(async () => {
      log.push('a start');
      await first.promise;
      log.push('a end');
      return 'A';
    });
    const b = exclusive(async () => {
      log.push('b start');
      return 'B';
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(['a start']);
    first.resolve();
    expect(await a).toBe('A');
    expect(await b).toBe('B');
    expect(log).toEqual(['a start', 'a end', 'b start']);
  });

  it('前の仕事が失敗しても、次の仕事は動く。失敗はその仕事を呼んだ側にだけ返る', async () => {
    const exclusive = createExclusive();
    const a = exclusive(async () => {
      throw new Error('boom');
    });
    const b = exclusive(async () => 'B');
    await expect(a).rejects.toThrow('boom');
    expect(await b).toBe('B');
  });

  it('同期で投げる仕事も、promise の失敗として返る', async () => {
    const exclusive = createExclusive();
    await expect(
      exclusive(() => {
        throw new Error('sync');
      }),
    ).rejects.toThrow('sync');
    expect(await exclusive(async () => 1)).toBe(1);
  });
});
