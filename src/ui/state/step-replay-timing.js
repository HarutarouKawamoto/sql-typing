/**
 * ステップ再生の段階ごとの長さ（docs/functional-design.md の「ステップ再生（StepPlayer）の動き」）。
 * 行が消える段階は「印を付ける（赤くする）→ 消す」の2つの場面に分ける。
 * React に依存しない純粋な関数にして、単体テストする。
 */

/**
 * 段階ごとの [印を付ける時間, 変化を見せる時間]（ミリ秒、速さ1倍）。
 * 印の時間は「どの行・列が消えるか」を読める長さにする（本人の指摘で 0.3〜0.4秒 から 1.5〜1.8秒 に。2026-11-11）
 */
const DURATIONS = {
  FROM: [0, 600],
  WHERE: [1800, 800],
  SELECT: [1500, 500],
  DISTINCT: [1800, 600],
  'ORDER BY': [0, 800],
  LIMIT: [1500, 300],
};
const DEFAULT_DURATION = [0, 800];
/** 自動再生で、段階と段階の間に止まる時間 */
const HOLD_MS = 1000;

/**
 * 印を付ける場面が要る段階か（行が消える・列が消える・行がまとまる）。
 * @param {{ diff: import('../../core/stepper/index.js').StepDiff }} step
 */
export function needsMark(step) {
  const { removed, removedColumns, merged } = step.diff;
  return removed.length > 0 || removedColumns.length > 0 || Object.keys(merged).length > 0;
}

/**
 * @param {string} label - 段階の名前（'WHERE' など）
 * @param {number} speed - 再生の速さ（0.5 / 1 / 2）。0以下・数でないときは1
 * @returns {{ markMs: number, applyMs: number, holdMs: number }}
 */
export function stepTiming(label, speed) {
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const [mark, apply] = DURATIONS[label] ?? DEFAULT_DURATION;
  return { markMs: mark / rate, applyMs: apply / rate, holdMs: HOLD_MS / rate };
}
