/**
 * 画面の切り替え（React に依存しない reducer。単体テストする）。
 * 元：docs/functional-design.md の画面遷移図
 *   一覧 → モード選択 → 依頼の会話 → 遊ぶ（クリアの結果とクリア後の会話は遊ぶ画面の中）→ 次の問題のモード選択／一覧
 * - 会話の読み返し（モードを選ばずに読む。幅の狭い画面でも読める）は、終えたらモード選択に戻る
 * - 意味のない動き（一覧での storyDone など）は何もしない
 */

/**
 * @typedef {'1' | '2' | '3' | '4'} Mode
 * @typedef {{ screen: 'home' }
 *   | { screen: 'mode', problemId: string }
 *   | { screen: 'story', problemId: string, mode: Mode | null }
 *   | { screen: 'play', problemId: string, mode: Mode }} Navigation
 *   story の mode が null なら読み返し
 * @typedef {{ type: 'openProblem', problemId: string }
 *   | { type: 'chooseMode', mode: Mode }
 *   | { type: 'readStory' }
 *   | { type: 'storyDone' }
 *   | { type: 'modeSelect' }
 *   | { type: 'home' }
 *   | { type: 'next', problemId: string | null }} NavigationAction
 */

/** @type {Navigation} */
export const HOME = { screen: 'home' };

/**
 * @param {Navigation} state
 * @param {NavigationAction} action
 * @returns {Navigation}
 */
export function navigationReducer(state, action) {
  switch (action.type) {
    case 'openProblem':
      return { screen: 'mode', problemId: action.problemId };
    case 'chooseMode':
      return state.screen === 'mode'
        ? { screen: 'story', problemId: state.problemId, mode: action.mode }
        : state;
    case 'readStory':
      return state.screen === 'mode'
        ? { screen: 'story', problemId: state.problemId, mode: null }
        : state;
    case 'storyDone':
      if (state.screen !== 'story') return state;
      return state.mode === null
        ? { screen: 'mode', problemId: state.problemId }
        : { screen: 'play', problemId: state.problemId, mode: state.mode };
    case 'modeSelect':
      // 今の問題のモード選択へ（会話のあと、幅が狭くなっていたら遊ぶ画面へ進ませない）
      return state.screen === 'home' ? state : { screen: 'mode', problemId: state.problemId };
    case 'home':
      return HOME;
    case 'next':
      return action.problemId === null ? HOME : { screen: 'mode', problemId: action.problemId };
    default:
      return state;
  }
}
