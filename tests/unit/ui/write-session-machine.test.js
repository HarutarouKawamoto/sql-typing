import { describe, it, expect } from 'vitest';
import {
  canRun,
  createWriteState,
  elapsedMs,
  escapeAction,
  writeReducer,
} from '../../../src/ui/state/write-session-machine.js';

const correct = { status: 'correct' };
const wrong = { status: 'wrong', reason: 'rowCount', message: '行の数が違います' };

describe('createWriteState', () => {
  it('時計は止まっていて、実行・ヒントは0、判定中でもクリアでもない', () => {
    expect(createWriteState()).toEqual({
      startedAt: null,
      finishedAt: null,
      runs: 0,
      hintsOpened: 0,
      judging: false,
      runStartedAt: null,
      last: null,
      cleared: false,
    });
  });
});

describe('writeReducer：時計', () => {
  it('最初の入力で時計が始まり、2回目からは変わらない', () => {
    const s1 = writeReducer(createWriteState(), { type: 'edit', time: 100 });
    expect(s1.startedAt).toBe(100);
    expect(writeReducer(s1, { type: 'edit', time: 500 }).startedAt).toBe(100);
  });

  it('何も打たずに実行しても時計が始まる（貼り付けだけ、などのとき）', () => {
    const s1 = writeReducer(createWriteState(), { type: 'runStart', time: 300 });
    expect(s1.startedAt).toBe(300);
  });

  it('elapsedMs：始まる前は0、動いている間は今まで、クリアのあとは正解の実行を押したときで止まる（判定の時間は数えない）', () => {
    const start = writeReducer(createWriteState(), { type: 'edit', time: 1000 });
    expect(elapsedMs(createWriteState(), 5000)).toBe(0);
    expect(elapsedMs(start, 4000)).toBe(3000);
    const done = writeReducer(writeReducer(start, { type: 'runStart', time: 2000 }), {
      type: 'runEnd',
      result: correct,
      sql: 'SELECT 1',
    });
    expect(elapsedMs(done, 9000)).toBe(1000);
  });
});

describe('writeReducer：実行と判定', () => {
  it('runStart で回数を足して判定中に、runEnd で結果を残して判定中を終える', () => {
    const s1 = writeReducer(createWriteState(), { type: 'runStart', time: 10 });
    expect(s1).toMatchObject({ runs: 1, judging: true });
    const s2 = writeReducer(s1, { type: 'runEnd', result: wrong, sql: 'SELECT 1' });
    expect(s2).toMatchObject({
      runs: 1,
      judging: false,
      cleared: false,
      finishedAt: null,
      last: { result: wrong, sql: 'SELECT 1', run: 1 },
    });
  });

  it('判定中の runStart は何もしない（2つの判定を同時に走らせない）', () => {
    const s1 = writeReducer(createWriteState(), { type: 'runStart', time: 10 });
    expect(writeReducer(s1, { type: 'runStart', time: 11 })).toBe(s1);
  });

  it('correct でクリアになり、時計が止まる。そのあとの実行・入力・ヒントは何もしない', () => {
    const s1 = writeReducer(createWriteState(), { type: 'runStart', time: 10 });
    const done = writeReducer(s1, { type: 'runEnd', result: correct, sql: 'SELECT 1' });
    expect(done).toMatchObject({ cleared: true, finishedAt: 10, judging: false });
    expect(writeReducer(done, { type: 'runStart', time: 50 })).toBe(done);
    expect(writeReducer(done, { type: 'edit', time: 50 })).toBe(done);
    expect(writeReducer(done, { type: 'openHint', max: 3 })).toBe(done);
  });

  it('判定中でないときの runEnd は捨てる（画面を作り直したあとに古い判定が届いたとき）', () => {
    const state = createWriteState();
    expect(writeReducer(state, { type: 'runEnd', result: correct, sql: 'x' })).toBe(state);
  });

  it('間違えた実行のあと、次の正解の実行を押したときで時計が止まる', () => {
    let state = writeReducer(createWriteState(), { type: 'runStart', time: 100 });
    state = writeReducer(state, { type: 'runEnd', result: wrong, sql: 'a' });
    state = writeReducer(state, { type: 'runStart', time: 700 });
    state = writeReducer(state, { type: 'runEnd', result: correct, sql: 'b' });
    expect(state).toMatchObject({ startedAt: 100, finishedAt: 700, runs: 2 });
  });
});

describe('writeReducer：ヒント', () => {
  it('1つずつ、max まで開ける', () => {
    let state = createWriteState();
    for (let i = 0; i < 5; i += 1) state = writeReducer(state, { type: 'openHint', max: 3 });
    expect(state.hintsOpened).toBe(3);
  });
});

describe('escapeAction（本人の決定：書きかけがあるときだけ確かめる）', () => {
  const idle = createWriteState();

  it('書きかけがなければ、すぐもどる', () => {
    expect(escapeAction(idle, '', false)).toBe('exit');
    expect(escapeAction(idle, '  \n', false)).toBe('exit');
  });

  it('書きかけがあれば、1回目は確かめる。確かめている間の Esc でもどる', () => {
    expect(escapeAction(idle, 'SELECT', false)).toBe('confirm');
    expect(escapeAction(idle, 'SELECT', true)).toBe('exit');
  });

  it('クリアのあとは、すぐもどる（書いたSQLは判定済み）', () => {
    const judging = writeReducer(idle, { type: 'runStart', time: 1 });
    const done = writeReducer(judging, { type: 'runEnd', result: correct, sql: 'x' });
    expect(escapeAction(done, 'SELECT * FROM products', false)).toBe('exit');
  });
});

describe('canRun', () => {
  it('空白だけのSQL・判定中・クリアのあとは実行しない', () => {
    const idle = createWriteState();
    expect(canRun(idle, 'SELECT 1')).toBe(true);
    expect(canRun(idle, '  \n ')).toBe(false);
    const judging = writeReducer(idle, { type: 'runStart', time: 1 });
    expect(canRun(judging, 'SELECT 1')).toBe(false);
    const done = writeReducer(judging, { type: 'runEnd', result: correct, sql: 'x' });
    expect(canRun(done, 'SELECT 1')).toBe(false);
  });
});
