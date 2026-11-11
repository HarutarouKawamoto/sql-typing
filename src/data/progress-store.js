import { ProgressSchema } from '../schema/index.js';

/**
 * 学習記録（localStorage）の読み書き。storage は引数で受け取る（画面は window.localStorage、テストは作り物）。
 * 読めない・形の違う記録は捨てずに退避してから初期化し、アプリは止めない。
 * 元：docs/functional-design.md の ProgressStore
 */

/** @typedef {import('../schema/progress-schema.js').Progress} Progress */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void, removeItem(key: string): void }} KeyValueStorage */

export const PROGRESS_KEY = 'sql-typing:progress';

/**
 * ブラウザの localStorage を返す。使えない（プライベートモードで例外など）ときは、
 * そのページの間だけ覚える作り物を返す（遊ぶことは続けられるように）。
 * localStorage に触るのはデータレイヤーだけ（ESLint の決まり）。
 * @returns {{ storage: KeyValueStorage, persistent: boolean }}
 */
export function getBrowserStorage() {
  try {
    const storage = globalThis.localStorage;
    if (storage) return { storage, persistent: true };
  } catch {
    // 下の作り物を使う
  }
  const data = new Map();
  return {
    storage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => void data.set(key, String(value)),
      removeItem: (key) => void data.delete(key),
    },
    persistent: false,
  };
}

/** @returns {Progress} */
export function createEmptyProgress() {
  return ProgressSchema.parse({
    version: 1,
    problems: {},
    mistakes: {},
    typed: {},
    days: {},
    settings: {},
  });
}

/**
 * @param {KeyValueStorage} storage
 * @param {Date} [now] - 退避するときの名前に使う
 * @returns {{ progress: Progress, recovered: boolean }} recovered=true は壊れていて初期化したとき
 */
export function loadProgress(storage, now = new Date()) {
  let raw;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch {
    // プライベートモードなどで読めない。記録なしで遊べるようにする
    return { progress: createEmptyProgress(), recovered: false };
  }
  if (raw === null) return { progress: createEmptyProgress(), recovered: false };

  let parsed;
  try {
    parsed = ProgressSchema.safeParse(JSON.parse(raw));
  } catch {
    parsed = { success: false };
  }
  if (parsed.success) return { progress: parsed.data, recovered: false };

  try {
    storage.setItem(`${PROGRESS_KEY}:broken-${now.toISOString()}`, raw);
    storage.removeItem(PROGRESS_KEY);
  } catch {
    // 退避できなくても、初期化した記録で遊べるようにする（次の保存で上書きされる）
  }
  return { progress: createEmptyProgress(), recovered: true };
}

/**
 * @param {KeyValueStorage} storage
 * @param {Progress} progress
 * @returns {{ ok: boolean }} 書けなかった（容量・プライベートモード）ときは ok: false。例外にしない
 */
export function saveProgress(storage, progress) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * どちらが良い記録か（本人の決定。2026-11-11）。
 * モード1・2は、ランクが高い方 → 同じランクなら正確さが高い方 → 同じ正確さなら速い方。
 * 速さのないモード3・4は時間が短い方。
 * @param {import('../schema/progress-schema.js').Progress['problems'][string]['modes']['1']['best']} candidate
 * @param {typeof candidate} current
 */
function isBetter(candidate, current) {
  if (!current) return true;
  // 速いだけで正確さの低い回が、正確な回の記録を上書きしないように、ランク・正確さを先に比べる
  const RANK_ORDER = { S: 4, A: 3, B: 2, C: 1 };
  if (candidate.rank && current.rank && candidate.rank !== current.rank) {
    return RANK_ORDER[candidate.rank] > RANK_ORDER[current.rank];
  }
  if (candidate.cpm !== undefined && current.cpm !== undefined) {
    const candidateAccuracy = candidate.accuracy ?? 0;
    const currentAccuracy = current.accuracy ?? 0;
    if (candidateAccuracy !== currentAccuracy) return candidateAccuracy > currentAccuracy;
    return candidate.cpm > current.cpm;
  }
  return candidate.timeMs < current.timeMs;
}

/**
 * ステップ再生を最後の段階まで見たことを記録した、新しい記録を返す（KPI「見える化の利用」）。
 * @param {Progress} progress
 * @param {string} problemId
 * @returns {Progress}
 */
export function markStepReplayFinished(progress, problemId) {
  const problem = progress.problems[problemId] ?? { modes: {}, stepReplayFinished: false };
  return {
    ...progress,
    problems: { ...progress.problems, [problemId]: { ...problem, stepReplayFinished: true } },
  };
}

/** @param {Record<string, number>} base @param {Record<string, number>} [add] */
function addCounts(base, add = {}) {
  const result = { ...base };
  for (const [key, count] of Object.entries(add)) result[key] = (result[key] ?? 0) + count;
  return result;
}

/**
 * 1回遊んだ結果を足した、新しい記録を返す（元の記録は変えない）。
 * @param {Progress} progress
 * @param {{
 *   problemId: string, mode: '1' | '2' | '3' | '4', cleared: boolean, date: string,
 *   best?: { timeMs: number, cpm?: number, accuracy?: number, rank?: 'S' | 'A' | 'B' | 'C', runs?: number, hintsOpened?: number },
 *   mistakes?: Record<string, number>, typed?: Record<string, number>,
 * }} play - date は 'YYYY-MM-DD'
 * @returns {Progress}
 */
export function recordPlay(progress, { problemId, mode, cleared, date, best, mistakes, typed }) {
  const problem = progress.problems[problemId] ?? { modes: {}, stepReplayFinished: false };
  const current = problem.modes[mode] ?? { cleared: false, plays: 0 };
  const nextBest = cleared && best && isBetter(best, current.best) ? best : current.best;
  const day = progress.days[date] ?? { plays: 0, cleared: 0 };

  return {
    ...progress,
    problems: {
      ...progress.problems,
      [problemId]: {
        ...problem,
        modes: {
          ...problem.modes,
          [mode]: {
            cleared: current.cleared || cleared,
            plays: current.plays + 1,
            ...(nextBest ? { best: nextBest } : {}),
          },
        },
      },
    },
    mistakes: addCounts(progress.mistakes, mistakes),
    typed: addCounts(progress.typed, typed),
    days: {
      ...progress.days,
      [date]: { plays: day.plays + 1, cleared: day.cleared + (cleared ? 1 : 0) },
    },
  };
}
