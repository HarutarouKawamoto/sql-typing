import { buildTarget, slotMatches } from './typing-engine.js';

/**
 * モード2の空欄で、選択肢を打って選ぶときの判定。
 * 決まり（docs/functional-design.md の ChoiceEngine）：
 * - 比べ方は TypingEngine と同じ（大文字・小文字、Space と Enter、文字列の中）
 * - まだ選んでいない選択肢のうち、打った文字と先頭が合うものが「候補」
 * - 候補が0個になるキーは miss（止まる）
 * - 1つを最後まで打ち切ったら確定。間違いなら why を返し、その空欄を最初から（選んだ間違いは候補から外す）
 * - 選択肢がほかの選択肢の先頭部分にならないことは、問題データの検証で保証する（打ち切った時点で1つに決まる）
 */

/**
 * @typedef {{ text: string, correct: boolean, why: string | null, target: import('./typing-engine.js').TypingTarget }} ChoiceItem
 * @typedef {{ choices: ChoiceItem[], typed: number, candidates: number[], rejected: number[] }} ChoiceState
 *   typed：候補に共通の、打ったスロットの数。candidates・rejected は choices の番号
 * @typedef {{ answer: string, wrong: { text: string, why: string }[] }} BlankLike
 * @typedef {{ state: ChoiceState, result: 'ok' | 'miss' | 'ignored' | 'decidedCorrect' | 'decidedWrong', why?: string, text?: string }} ChoiceResult
 */

/**
 * 空欄を始める。並び順は乱数で混ぜる（Fisher–Yates）。
 * @param {BlankLike} blank
 * @param {() => number} randomFn - 0 以上 1 未満（画面から Math.random を渡す）
 * @returns {ChoiceState}
 */
export function startBlank(blank, randomFn) {
  const choices = [
    { text: blank.answer, correct: true, why: null },
    ...blank.wrong.map((w) => ({ text: w.text, correct: false, why: w.why })),
  ].map((choice) => ({ ...choice, target: buildTarget(choice.text) }));
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, typed: 0, candidates: choices.map((_, i) => i), rejected: [] };
}

/**
 * @param {ChoiceState} state
 * @returns {number[]} まだ選んでいない選択肢の番号
 */
function openChoices(state) {
  return state.choices.map((_, i) => i).filter((i) => !state.rejected.includes(i));
}

/**
 * 1回のキー入力を判定する。引数の state は変えず、新しい状態を返す。
 * @param {ChoiceState} state
 * @param {string} key - KeyboardEvent.key
 * @returns {ChoiceResult}
 */
export function pressKey(state, key) {
  if (key.length !== 1 && key !== 'Enter') return { state, result: 'ignored' };
  const candidates = state.candidates.filter((i) => {
    const slot = state.choices[i].target.slots[state.typed];
    return slot !== undefined && slotMatches(slot, key);
  });
  if (candidates.length === 0) return { state, result: 'miss' };

  const typed = state.typed + 1;
  const finished = candidates.find((i) => state.choices[i].target.slots.length === typed);
  if (finished === undefined) return { state: { ...state, typed, candidates }, result: 'ok' };

  const choice = state.choices[finished];
  if (choice.correct) {
    return { state: { ...state, typed, candidates: [finished] }, result: 'decidedCorrect' };
  }
  const rejected = [...state.rejected, finished];
  const next = { ...state, typed: 0, rejected };
  return {
    state: { ...next, candidates: openChoices(next) },
    result: 'decidedWrong',
    why: choice.why ?? '',
    text: choice.text,
  };
}
