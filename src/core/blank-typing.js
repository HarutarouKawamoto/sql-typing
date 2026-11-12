import { pressKey as pressChoiceKey, startBlank } from './choice-engine.js';
import { buildTarget, createTypingState, pressKey as pressTypingKey } from './typing-engine.js';

/**
 * 空欄つきのなぞり書き（モード2）。空欄の外は TypingEngine、空欄の中は ChoiceEngine で判定する。
 * 空欄がなければ TypingEngine とまったく同じ動きなので、モード1もこれで動かす（決まりを1か所にする）。
 * - 空欄の中の ok・miss も、打った数・ミスの数（TypingState の okCount・missCount）に入れる
 *   （速さ・正確さは打ったキー全体で出す）。表示用SQLのスロットの「ミスした」印には入れない
 * - 正解を選んだら位置を空欄の終わりへ進め、空欄の中で終わった句を知らせる（見える化C）
 */

/**
 * @typedef {import('./typing-engine.js').TypingTarget} TypingTarget
 * @typedef {import('./typing-engine.js').TypingState} TypingState
 * @typedef {import('./choice-engine.js').ChoiceState} ChoiceState
 * @typedef {import('./choice-engine.js').BlankLike} BlankLike
 * @typedef {{ start: number, end: number, blank: BlankLike }} BlankRange - スロット番号（end は含まない）
 * @typedef {{
 *   typing: TypingState,
 *   ranges: BlankRange[],
 *   active: number | null,
 *   choice: ChoiceState | null,
 *   filled: number,
 *   wrongChoices: number,
 * }} BlankTypingState
 *   active：今の空欄（ranges の番号）。filled：埋めた空欄の数。wrongChoices：選び間違えた回数
 * @typedef {{
 *   state: BlankTypingState,
 *   result: 'ok' | 'miss' | 'ignored' | 'decidedCorrect' | 'decidedWrong',
 *   inBlank: boolean,
 *   clauseEnded?: number,
 *   done?: boolean,
 *   why?: string,
 *   text?: string,
 * }} BlankPressResult
 */

/**
 * @param {import('./typing-engine.js').Slot} a
 * @param {import('./typing-engine.js').Slot} b
 */
function sameSlot(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'separator' || b.kind !== 'char') return true;
  // 画面で打つときと同じく、文字列・識別子の外は大文字・小文字の違いを気にしない
  // （問題データの検証 checkBlanks も大文字・小文字を無視して数えるので、それとそろえる）
  if (a.caseSensitive || b.caseSensitive) return a.expected === b.expected;
  return a.expected.toLowerCase() === b.expected.toLowerCase();
}

/**
 * @param {import('./typing-engine.js').Slot[]} haystack
 * @param {import('./typing-engine.js').Slot[]} needle
 * @returns {number} 見つかった先頭のスロット番号（なければ -1）
 */
function findSlots(haystack, needle) {
  if (needle.length === 0) return -1;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    if (needle.every((slot, k) => sameSlot(haystack[i + k], slot))) return i;
  }
  return -1;
}

/**
 * 各空欄の正解が、表示用SQLのどのスロットにあたるかを探す（区切りは改行・字下げの違い、文字列の外は大文字・小文字の違いを気にしない）。
 * @param {TypingTarget} target
 * @param {BlankLike[]} blanks
 * @returns {BlankRange[]} 表示用SQLの中の順
 */
export function locateBlanks(target, blanks) {
  const ranges = blanks
    .map((blank) => {
      const slots = buildTarget(blank.answer).slots;
      const start = findSlots(target.slots, slots);
      if (start < 0) throw new Error(`空欄「${blank.answer}」が表示用SQLの中に見つかりません`);
      return { start, end: start + slots.length, blank };
    })
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i].start < ranges[i - 1].end) {
      throw new Error(
        `空欄「${ranges[i - 1].blank.answer}」と「${ranges[i].blank.answer}」が重なっています`,
      );
    }
  }
  return ranges;
}

/**
 * 表示用SQLから空欄の答えの文字を空白にしたもの（DBの地図で、空欄の答えのテーブルを光らせないため）。
 * 空欄は locateBlanks と同じ探し方で見つける（改行・字下げ・キーワードの大文字小文字の違いを無視する）。
 * 長さと改行は変えない。
 * @param {string} displaySql
 * @param {BlankLike[]} blanks
 * @returns {string}
 */
export function maskBlankAnswers(displaySql, blanks) {
  if (blanks.length === 0) return displaySql;
  const target = buildTarget(displaySql);
  const chars = [...displaySql];
  for (const range of locateBlanks(target, blanks)) {
    const first = target.slots[range.start];
    const last = target.slots[range.end - 1];
    const end = last.kind === 'separator' ? last.end : last.start + 1;
    for (let i = first.start; i < end; i += 1) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  }
  return chars.join('');
}

/**
 * 今の位置が空欄の始まりなら、その空欄を始める。
 * @param {BlankTypingState} state
 * @param {() => number} randomFn
 * @returns {BlankTypingState}
 */
function enterBlankIfAt(state, randomFn) {
  const index = state.ranges.findIndex((range) => range.start === state.typing.position);
  if (index < 0) return state;
  return { ...state, active: index, choice: startBlank(state.ranges[index].blank, randomFn) };
}

/**
 * @param {TypingTarget} target
 * @param {BlankLike[]} blanks - モード1は []
 * @param {() => number} randomFn - 選択肢の並び順を決める乱数（0 以上 1 未満）
 * @returns {BlankTypingState}
 */
export function createBlankTypingState(target, blanks, randomFn) {
  const state = {
    typing: createTypingState(target),
    ranges: locateBlanks(target, blanks),
    active: null,
    choice: null,
    filled: 0,
    wrongChoices: 0,
  };
  return enterBlankIfAt(state, randomFn);
}

/**
 * @param {TypingTarget} target
 * @param {BlankRange} range
 * @returns {number | undefined} 空欄の中で終わった句のうち、最後のもの
 */
function lastClauseEndedIn(target, range) {
  let last;
  for (let slot = range.start; slot < range.end; slot += 1) {
    const clause = target.clauseEnds.get(slot);
    if (clause !== undefined) last = clause;
  }
  return last;
}

/**
 * 1回のキー入力を判定する。引数の state は変えず、新しい状態を返す。
 * @param {BlankTypingState} state
 * @param {TypingTarget} target
 * @param {string} key - KeyboardEvent.key
 * @param {() => number} randomFn
 * @returns {BlankPressResult}
 */
export function pressBlankKey(state, target, key, randomFn) {
  if (state.active === null || state.choice === null) {
    const outcome = pressTypingKey(state.typing, target, key);
    const moved = { ...state, typing: outcome.state };
    const next = outcome.result === 'ok' ? enterBlankIfAt(moved, randomFn) : moved;
    return { ...outcome, state: next, inBlank: false };
  }

  const range = state.ranges[state.active];
  const choice = pressChoiceKey(state.choice, key);
  const { typing } = state;
  if (choice.result === 'ignored') return { state, result: 'ignored', inBlank: true };
  if (choice.result === 'miss') {
    return {
      state: {
        ...state,
        choice: choice.state,
        typing: { ...typing, missCount: typing.missCount + 1 },
      },
      result: 'miss',
      inBlank: true,
    };
  }

  const counted = { ...typing, okCount: typing.okCount + 1 };
  if (choice.result === 'ok') {
    return {
      state: { ...state, choice: choice.state, typing: counted },
      result: 'ok',
      inBlank: true,
    };
  }
  if (choice.result === 'decidedWrong') {
    return {
      state: {
        ...state,
        choice: choice.state,
        typing: counted,
        wrongChoices: state.wrongChoices + 1,
      },
      result: 'decidedWrong',
      inBlank: true,
      why: choice.why,
      text: choice.text,
    };
  }

  // 正解：空欄を埋めて、その後ろへ
  const filledState = {
    ...state,
    typing: { ...counted, position: range.end, lastMissAt: null },
    active: null,
    choice: null,
    filled: state.filled + 1,
  };
  /** @type {BlankPressResult} */
  const outcome = {
    state: enterBlankIfAt(filledState, randomFn),
    result: 'decidedCorrect',
    inBlank: true,
  };
  const clauseEnded = lastClauseEndedIn(target, range);
  if (clauseEnded !== undefined) outcome.clauseEnded = clauseEnded;
  if (range.end === target.slots.length) outcome.done = true;
  return outcome;
}
