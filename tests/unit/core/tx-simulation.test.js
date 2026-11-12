import { describe, it, expect } from 'vitest';
import {
  autoRun,
  canStep,
  nextStep,
  READ_FIRST_ORDER,
  startTx,
  stepTx,
  TX_SCENARIOS,
  txOutcome,
} from '../../../src/core/tx-simulation.js';

/** 進めるだけ進めて、両方が終わったすべての状態を集める（どの順でも試す） */
function allEndings(state) {
  const sides = /** @type {const} */ (['A', 'B']).filter((side) => canStep(state, side));
  if (sides.length === 0) return [state];
  return sides.flatMap((side) => allEndings(stepTx(state, side)));
}

describe('tx-simulation：鍵なし（SELECT で見てから UPDATE）', () => {
  it('両方が先に在庫を読むと、どちらも 1 を見て減らし、在庫 -1・注文2つになる', () => {
    const end = autoRun(startTx('unsafe'), READ_FIRST_ORDER);
    expect(txOutcome(end)).toEqual({ kind: 'oversold', stock: -1, orders: 2 });
    const reads = end.events.filter((e) => e.step === 'read');
    expect(reads.map((e) => [e.side, e.seen])).toEqual([
      ['A', 1],
      ['B', 1],
    ]);
  });

  it('B の UPDATE は、A が鍵を持っているあいだ待ち、A の COMMIT で進む', () => {
    let state = startTx('unsafe');
    for (const side of ['A', 'B', 'A', 'B', 'A']) state = stepTx(state, side);
    expect(state.lockOwner).toBe('A');
    state = stepTx(state, 'B'); // B の UPDATE
    expect(state.events.at(-1)).toMatchObject({ side: 'B', kind: 'wait', step: 'update' });
    expect(canStep(state, 'B')).toBe(false);
    state = stepTx(stepTx(state, 'A'), 'A'); // A の INSERT・COMMIT
    expect(state.events.slice(-2).map((e) => [e.side, e.kind, e.step])).toEqual([
      ['A', 'run', 'commit'],
      ['B', 'resume', 'update'],
    ]);
    expect(state.lockOwner).toBe('B');
    expect(state.stock).toBe(0);
    // 待ったあとは確定した最新の在庫（0）から減らす
    expect(state.sides.B.ownStock).toBe(-1);
    expect(state.events.at(-1)?.note).toMatch(/確定した最新の在庫 0 から1減らして/);
    expect(canStep(state, 'B')).toBe(true);
  });

  it('A が先に全部終われば、B は在庫 0 を見て ROLLBACK し、注文は1つ', () => {
    const end = autoRun(startTx('unsafe'), ['A', 'A', 'A', 'A', 'A', 'B', 'B', 'B']);
    expect(txOutcome(end)).toEqual({ kind: 'safe', stock: 0, orders: 1 });
    expect(end.sides.B.ended).toBe('rollback');
    expect(end.events.at(-1)).toMatchObject({ side: 'B', step: 'rollback' });
  });

  it('COMMIT までは、相手には変更が見えない', () => {
    let state = startTx('unsafe');
    for (const side of ['A', 'A', 'A']) state = stepTx(state, side); // A：BEGIN・読む・UPDATE
    expect(state.sides.A.ownStock).toBe(0);
    expect(state.stock).toBe(1);
    state = stepTx(stepTx(state, 'B'), 'B'); // B：BEGIN・読む
    expect(state.sides.B.seen).toBe(1);
  });

  it('順番によって、売りすぎになることも守れることもある', () => {
    const kinds = new Set(allEndings(startTx('unsafe')).map((s) => txOutcome(s)?.kind));
    expect(kinds).toEqual(new Set(['oversold', 'safe']));
  });
});

describe('tx-simulation：鍵あり（SELECT ... FOR UPDATE）', () => {
  it('後から読む方は待ち、相手の COMMIT のあと在庫 0 を見てやめる', () => {
    const end = autoRun(startTx('locked'), READ_FIRST_ORDER);
    expect(txOutcome(end)).toEqual({ kind: 'safe', stock: 0, orders: 1 });
    expect(end.events.find((e) => e.side === 'B' && e.kind === 'wait')).toMatchObject({
      step: 'read',
    });
    expect(end.events.find((e) => e.side === 'B' && e.kind === 'resume')).toMatchObject({
      step: 'read',
      seen: 0,
    });
  });

  it('どの順で進めても、在庫は 0 で注文は1つ', () => {
    const endings = allEndings(startTx('locked'));
    // 待つあいだは片方しか進めず、後の側は ROLLBACK で手順が減るので36通り（探索が全部の順を試したかの確かめ）
    expect(endings).toHaveLength(36);
    for (const end of endings) {
      expect(txOutcome(end)).toEqual({ kind: 'safe', stock: 0, orders: 1 });
    }
  });
});

describe('tx-simulation：進め方', () => {
  it('stepTx は元の状態を変えない', () => {
    const start = startTx('unsafe');
    const copy = structuredClone(start);
    stepTx(start, 'A');
    expect(start).toEqual(copy);
  });

  it('始めは在庫 1・注文0・鍵なし。次の手順は BEGIN', () => {
    const state = startTx('locked');
    expect(state).toMatchObject({ stock: 1, orders: 0, lockOwner: null, events: [] });
    expect(nextStep(state, 'A')).toMatchObject({ kind: 'begin', sql: 'BEGIN' });
    expect(txOutcome(state)).toBeNull();
  });

  it('鍵ありの読む手順の SQL は FOR UPDATE、鍵なしは付かない', () => {
    const read = (id) => {
      const state = stepTx(startTx(id), 'A');
      return nextStep(state, 'A')?.sql;
    };
    expect(read('locked')).toMatch(/FOR UPDATE$/);
    expect(read('unsafe')).not.toMatch(/FOR UPDATE/);
  });

  it('終わった側・待っている側は進めない（進めようとしても変わらない）', () => {
    const end = autoRun(startTx('unsafe'), READ_FIRST_ORDER);
    expect(canStep(end, 'A')).toBe(false);
    expect(nextStep(end, 'A')).toBeNull();
    expect(stepTx(end, 'A')).toBe(end);
  });

  it('2つの場面に名前と、A・B の名前がある。知らない場面は例外', () => {
    expect(Object.keys(TX_SCENARIOS)).toEqual(['unsafe', 'locked']);
    expect(() => startTx(/** @type {any} */ ('nothing'))).toThrow();
  });

  it('autoRun は、番の側が待っていて進めないときは、もう片方を進める', () => {
    // A：BEGIN・読む（鍵）、B：BEGIN・読む（待つ）、B の番 → 進めないので A の UPDATE
    const state = autoRun(startTx('locked'), ['A', 'A', 'B', 'B', 'B']);
    // そのあとは両方が終わるまで進むので、最初の5つだけを見る
    expect(state.events.slice(0, 5).map((e) => [e.side, e.kind, e.step])).toEqual([
      ['A', 'run', 'begin'],
      ['A', 'run', 'read'],
      ['B', 'run', 'begin'],
      ['B', 'wait', 'read'],
      ['A', 'run', 'update'],
    ]);
  });

  it('autoRun は、順の指定が足りなくても両方が終わるまで進める', () => {
    const end = autoRun(startTx('locked'), []);
    expect(txOutcome(end)).not.toBeNull();
  });
});
