/**
 * ステップ再生の進み方（React に依存しない reducer。単体テストする）。
 * 状態：段階の番号 index・場面 phase（印 mark → 変化 apply）・自動再生中か playing。
 * - 段階に移ると、印が要る段階なら mark から、要らなければ apply から始まる
 * - markDone：印の場面を終えて apply に（タイマーから）
 * - advance：自動再生で次の段階へ（タイマーから）。最後の段階の apply に着いたら止まる
 * - next / back / first：手で動かすと自動再生は止まる
 * - toggle：再生／一時停止。最後で止まっているときの再生は最初から
 */

/**
 * @typedef {{ index: number, phase: 'mark' | 'apply', playing: boolean, marks: boolean[] }} ReplayState
 * @typedef {{ type: 'next' | 'back' | 'first' | 'toggle' | 'markDone' | 'advance' }} ReplayAction
 */

/**
 * @param {boolean[]} marks - 段階ごとに、印の場面が要るか
 * @returns {ReplayState}
 */
export function createReplayState(marks) {
  return { index: 0, phase: marks[0] ? 'mark' : 'apply', playing: marks.length > 1, marks };
}

/**
 * @param {ReplayState} state
 * @param {number} target
 * @param {boolean} playing
 * @returns {ReplayState}
 */
function goTo(state, target, playing) {
  const last = state.marks.length - 1;
  const index = Math.max(0, Math.min(last, target));
  const phase = state.marks[index] ? 'mark' : 'apply';
  // 最後の段階の変化まで見せたら自動再生は止まる
  return { ...state, index, phase, playing: playing && !(index === last && phase === 'apply') };
}

/**
 * @param {ReplayState} state
 * @param {ReplayAction} action
 * @returns {ReplayState}
 */
export function replayReducer(state, action) {
  const last = state.marks.length - 1;
  switch (action.type) {
    case 'next':
      return goTo(state, state.index + 1, false);
    case 'back':
      return goTo(state, state.index - 1, false);
    case 'first':
      return goTo(state, 0, false);
    case 'toggle':
      if (state.playing) return { ...state, playing: false };
      if (state.index === last) return goTo(state, 0, true);
      return { ...state, playing: true };
    case 'markDone':
      if (state.phase !== 'mark') return state;
      return {
        ...state,
        phase: 'apply',
        playing: state.playing && state.index !== last,
      };
    case 'advance':
      if (!state.playing || state.phase !== 'apply') return state;
      return goTo(state, state.index + 1, true);
    default:
      return state;
  }
}
