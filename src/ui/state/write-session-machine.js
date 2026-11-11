/**
 * 書く画面（モード3・4）の1回分の状態（React に依存しない reducer。単体テストする）。
 * - 時計は最初の入力（か最初の実行）で始まり、正解だった実行を押したときで止まる（判定にかかった時間は数えない）
 * - 実行のたびに回数を足す。判定中は次の実行を受けない（judge は reset → 実行 → reset を順に行うため、
 *   2つを同時に走らせると割り込まれる）
 * - ヒントは1つずつ max まで
 * - クリアのあとは何も変えない
 */

/**
 * @typedef {import('../../core/judge.js').JudgeResult} JudgeResult
 * @typedef {{
 *   startedAt: number | null,
 *   finishedAt: number | null,
 *   runs: number,
 *   hintsOpened: number,
 *   judging: boolean,
 *   runStartedAt: number | null,
 *   last: { result: JudgeResult, sql: string, run: number } | null,
 *   cleared: boolean,
 * }} WriteState
 * @typedef {{ type: 'edit', time: number }
 *   | { type: 'runStart', time: number }
 *   | { type: 'runEnd', result: JudgeResult, sql: string }
 *   | { type: 'openHint', max: number }} WriteAction
 */

/** @returns {WriteState} */
export function createWriteState() {
  return {
    startedAt: null,
    finishedAt: null,
    runs: 0,
    hintsOpened: 0,
    judging: false,
    runStartedAt: null,
    last: null,
    cleared: false,
  };
}

/**
 * @param {WriteState} state
 * @param {WriteAction} action
 * @returns {WriteState}
 */
export function writeReducer(state, action) {
  if (state.cleared) return state;
  switch (action.type) {
    case 'edit':
      return state.startedAt === null ? { ...state, startedAt: action.time } : state;
    case 'runStart':
      if (state.judging) return state;
      return {
        ...state,
        startedAt: state.startedAt ?? action.time,
        runs: state.runs + 1,
        judging: true,
        runStartedAt: action.time,
      };
    case 'runEnd': {
      // 判定中でないときに届いた結果は、作り直す前の古い判定のもの
      if (!state.judging) return state;
      const cleared = action.result.status === 'correct';
      return {
        ...state,
        judging: false,
        last: { result: action.result, sql: action.sql, run: state.runs },
        cleared,
        finishedAt: cleared ? state.runStartedAt : null,
      };
    }
    case 'openHint':
      return { ...state, hintsOpened: Math.min(action.max, state.hintsOpened + 1) };
    default:
      return state;
  }
}

/**
 * @param {WriteState} state
 * @param {string} sql
 * @returns {boolean} 今このSQLを実行してよいか
 */
export function canRun(state, sql) {
  return !state.judging && !state.cleared && sql.trim() !== '';
}

/**
 * Esc を押したとき、すぐもどるか、確かめるか（本人の決定。2026-11-12）。
 * 書きかけのSQLがあるときだけ、1回目は確かめる（もう一度 Esc でもどる）。クリアのあとはすぐもどる。
 * @param {WriteState} state
 * @param {string} sql - 入力欄の今の中身
 * @param {boolean} confirming - 確かめている最中か
 * @returns {'exit' | 'confirm'}
 */
export function escapeAction(state, sql, confirming) {
  if (state.cleared || sql.trim() === '' || confirming) return 'exit';
  return 'confirm';
}

/**
 * @param {WriteState} state
 * @param {number} now
 * @returns {number} 経過時間（ミリ秒）
 */
export function elapsedMs(state, now) {
  if (state.startedAt === null) return 0;
  return (state.finishedAt ?? now) - state.startedAt;
}
