import { describe, it, expect } from 'vitest';
import {
  PROGRESS_KEY,
  createEmptyProgress,
  loadProgress,
  saveProgress,
  recordPlay,
  markStepReplayFinished,
} from '../../../src/data/progress-store.js';
import { createMemoryStorage } from '../../helpers/memory-storage.js';

const NOW = new Date('2026-11-11T10:00:00Z');

describe('createEmptyProgress', () => {
  it('version 1 の空の記録（設定は既定値）', () => {
    expect(createEmptyProgress()).toEqual({
      version: 1,
      problems: {},
      mistakes: {},
      typed: {},
      days: {},
      settings: { reorderAnimation: true, replaySpeed: 1 },
    });
  });
});

describe('loadProgress', () => {
  it('記録がなければ空の記録（recovered: false）', () => {
    expect(loadProgress(createMemoryStorage(), NOW)).toEqual({
      progress: createEmptyProgress(),
      recovered: false,
    });
  });

  it('保存した記録を読む', () => {
    const storage = createMemoryStorage();
    const progress = recordPlay(createEmptyProgress(), {
      problemId: 'beginner-01',
      mode: '1',
      cleared: true,
      best: { timeMs: 9000, cpm: 150, accuracy: 96, rank: 'B' },
      date: '2026-11-11',
    });
    saveProgress(storage, progress);
    expect(loadProgress(storage, NOW)).toEqual({ progress, recovered: false });
  });

  it('JSON として読めない記録は退避して初期化し、recovered: true', () => {
    const storage = createMemoryStorage({ initial: { [PROGRESS_KEY]: '{broken' } });
    const result = loadProgress(storage, NOW);
    expect(result).toEqual({ progress: createEmptyProgress(), recovered: true });
    expect(storage.getItem(`${PROGRESS_KEY}:broken-2026-11-11T10:00:00.000Z`)).toBe('{broken');
    expect(storage.getItem(PROGRESS_KEY)).toBe(null);
  });

  it('形の違う記録も退避して初期化する', () => {
    const storage = createMemoryStorage({
      initial: { [PROGRESS_KEY]: JSON.stringify({ version: 99 }) },
    });
    expect(loadProgress(storage, NOW).recovered).toBe(true);
  });

  it('storage が読めない（例外）ときも空の記録で動く', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadProgress(storage, NOW)).toEqual({
      progress: createEmptyProgress(),
      recovered: false,
    });
  });
});

describe('saveProgress', () => {
  it('書けたら ok: true', () => {
    expect(saveProgress(createMemoryStorage(), createEmptyProgress())).toEqual({ ok: true });
  });

  it('書けなくても例外にせず ok: false', () => {
    expect(saveProgress(createMemoryStorage({ failOnSet: true }), createEmptyProgress())).toEqual({
      ok: false,
    });
  });
});

describe('markStepReplayFinished', () => {
  it('問題の stepReplayFinished を true にした新しい記録を返す（元は変えない）', () => {
    const empty = createEmptyProgress();
    const next = markStepReplayFinished(empty, 'beginner-01');
    expect(next.problems['beginner-01']).toEqual({ modes: {}, stepReplayFinished: true });
    expect(empty.problems).toEqual({});
  });

  it('遊んだ記録は残す', () => {
    const played = recordPlay(createEmptyProgress(), {
      problemId: 'beginner-01',
      mode: '1',
      cleared: true,
      date: '2026-11-11',
    });
    const next = markStepReplayFinished(played, 'beginner-01');
    expect(next.problems['beginner-01'].modes[1].cleared).toBe(true);
    expect(next.problems['beginner-01'].stepReplayFinished).toBe(true);
  });
});

describe('recordPlay', () => {
  const play = (overrides = {}) => ({
    problemId: 'beginner-01',
    mode: '1',
    cleared: true,
    best: { timeMs: 9000, cpm: 150, accuracy: 96, rank: 'B' },
    date: '2026-11-11',
    ...overrides,
  });

  it('クリア・遊んだ回数・最高記録・日ごとの記録を足す。元の記録は変えない', () => {
    const empty = createEmptyProgress();
    const next = recordPlay(empty, play());
    expect(next.problems['beginner-01']).toEqual({
      modes: {
        1: { cleared: true, plays: 1, best: { timeMs: 9000, cpm: 150, accuracy: 96, rank: 'B' } },
      },
      stepReplayFinished: false,
    });
    expect(next.days['2026-11-11']).toEqual({ plays: 1, cleared: 1 });
    expect(empty.problems).toEqual({});
  });

  it('同じランクなら正確さが高い方を最高記録にする（遅くても）', () => {
    // 1回目：150文字/分・96%（B）
    let progress = recordPlay(createEmptyProgress(), play());
    // 2回目：遅いが正確（B）→ こちらが最高記録
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 8000, cpm: 140, accuracy: 99, rank: 'B' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best).toMatchObject({
      cpm: 140,
      accuracy: 99,
    });
    // 3回目：速いが正確さが低い（B）→ 上書きしない
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 7000, cpm: 170, accuracy: 97, rank: 'B' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best).toMatchObject({
      cpm: 140,
      accuracy: 99,
    });
    expect(progress.problems['beginner-01'].modes[1].plays).toBe(3);
  });

  it('同じランク・同じ正確さなら速い方を最高記録にする', () => {
    let progress = recordPlay(createEmptyProgress(), play());
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 8500, cpm: 160, accuracy: 96, rank: 'B' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best.cpm).toBe(160);
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 9500, cpm: 130, accuracy: 96, rank: 'B' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best.cpm).toBe(160);
  });

  it('ランクを先に比べる。速くても正確さが低くランクが下の回は、最高記録を上書きしない', () => {
    let progress = recordPlay(
      createEmptyProgress(),
      play({ best: { timeMs: 9000, cpm: 200, accuracy: 100, rank: 'A' } }),
    );
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 7000, cpm: 260, accuracy: 80, rank: 'C' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best.rank).toBe('A');
    progress = recordPlay(
      progress,
      play({ best: { timeMs: 6000, cpm: 260, accuracy: 99, rank: 'S' } }),
    );
    expect(progress.problems['beginner-01'].modes[1].best.rank).toBe('S');
  });

  it('一度クリアしたら、あとでクリアしなかった回があってもクリアのまま', () => {
    let progress = recordPlay(createEmptyProgress(), play());
    progress = recordPlay(progress, play({ cleared: false, best: undefined }));
    expect(progress.problems['beginner-01'].modes[1].cleared).toBe(true);
    expect(progress.days['2026-11-11']).toEqual({ plays: 2, cleared: 1 });
  });

  it('苦手（mistakes）と打った回数（typed）を足していく', () => {
    let progress = recordPlay(
      createEmptyProgress(),
      play({ mistakes: { '(': 2 }, typed: { '(': 4, SELECT: 1 } }),
    );
    progress = recordPlay(progress, play({ mistakes: { '(': 1, ',': 1 }, typed: { '(': 4 } }));
    expect(progress.mistakes).toEqual({ '(': 3, ',': 1 });
    expect(progress.typed).toEqual({ '(': 8, SELECT: 1 });
  });
});
