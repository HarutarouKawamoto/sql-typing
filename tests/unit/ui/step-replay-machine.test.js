import { describe, it, expect } from 'vitest';
import { createReplayState, replayReducer } from '../../../src/ui/state/step-replay-machine.js';

// FROM（印なし）→ WHERE（印あり）→ SELECT（印あり）→ ORDER BY（印なし）
const MARKS = [false, true, true, false];
const run = (state, ...types) => types.reduce((s, type) => replayReducer(s, { type }), state);

describe('createReplayState', () => {
  it('最初の段階から自動再生で始まる。段階が1つなら再生しない', () => {
    expect(createReplayState(MARKS)).toEqual({
      index: 0,
      phase: 'apply',
      playing: true,
      marks: MARKS,
    });
    expect(createReplayState([false]).playing).toBe(false);
  });

  it('最初の段階が印の要る段階なら mark から', () => {
    expect(createReplayState([true, false]).phase).toBe('mark');
  });
});

describe('replayReducer：自動再生', () => {
  it('advance で次へ。印の要る段階は mark から、markDone で apply に', () => {
    const s1 = run(createReplayState(MARKS), 'advance');
    expect(s1).toMatchObject({ index: 1, phase: 'mark', playing: true });
    expect(run(s1, 'markDone')).toMatchObject({ index: 1, phase: 'apply', playing: true });
  });

  it('印の場面の途中の advance は何もしない（印を見せてから進む）', () => {
    const s1 = run(createReplayState(MARKS), 'advance');
    expect(run(s1, 'advance')).toBe(s1);
  });

  it('最後の段階の変化まで見せたら止まる', () => {
    const end = run(
      createReplayState(MARKS),
      'advance',
      'markDone',
      'advance',
      'markDone',
      'advance',
    );
    expect(end).toMatchObject({ index: 3, phase: 'apply', playing: false });
    expect(run(end, 'advance')).toBe(end);
  });

  it('最後の段階が印の要る段階なら、markDone で止まる', () => {
    const marks = [false, true];
    const s = run(createReplayState(marks), 'advance');
    expect(s).toMatchObject({ index: 1, phase: 'mark', playing: true });
    expect(run(s, 'markDone')).toMatchObject({ index: 1, phase: 'apply', playing: false });
  });
});

describe('replayReducer：手で動かす', () => {
  it('next・back・first で動き、自動再生は止まる。範囲の外には出ない', () => {
    const start = createReplayState(MARKS);
    expect(run(start, 'next')).toMatchObject({ index: 1, phase: 'mark', playing: false });
    expect(run(start, 'back')).toMatchObject({ index: 0, playing: false });
    expect(run(start, 'next', 'next', 'next', 'next', 'next').index).toBe(3);
    expect(run(start, 'next', 'next', 'first')).toMatchObject({ index: 0, phase: 'apply' });
  });

  it('続けて next しても1つずつ進む（前の状態をもとに計算する）', () => {
    expect(run(createReplayState(MARKS), 'next', 'next').index).toBe(2);
  });

  it('toggle：再生中なら止める、止まっていれば再生、最後で止まっていれば最初から再生', () => {
    const playing = createReplayState(MARKS);
    const paused = run(playing, 'toggle');
    expect(paused.playing).toBe(false);
    expect(run(paused, 'toggle').playing).toBe(true);
    const atEnd = run(playing, 'next', 'next', 'next');
    expect(run(atEnd, 'toggle')).toMatchObject({ index: 0, playing: true });
  });
});
