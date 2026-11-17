import { tokenize } from './sql-text.js';
import { splitClauses } from './clause-splitter.js';

/**
 * モード1（なぞり書き）とモード2の空欄以外の、タイピングの判定（モード2の空欄は choice-engine.js、組み合わせは blank-typing.js）。
 * 決まり（docs/functional-design.md の TypingEngine、壁打ちの決定13）：
 * - 文字列 '...'・識別子 "..." の外の英字は大文字・小文字を区別しない。中は区別する
 * - 文字列の外の、連続する空白・改行は1つの「区切りスロット」。Space と Enter のどちらでも正解
 * - 前後の空白は打たない
 * - 間違えても止まらない：そのスロットに印を付けて位置を1つ進める（直さずに書き進められる。2026-11-17 の本人の決定）。
 *   Shift・Backspace など長さ2以上のキーは無視
 */

/**
 * @typedef {{ kind: 'char', expected: string, caseSensitive: boolean, start: number }} CharSlot
 * @typedef {{ kind: 'separator', start: number, end: number }} SeparatorSlot
 * @typedef {CharSlot | SeparatorSlot} Slot
 * @typedef {{ text: string, slots: Slot[], clauseEnds: Map<number, number> }} TypingTarget
 *   clauseEnds：句の最後の文字のスロット番号 → 何番目の句か（0から）
 * @typedef {{ position: number, okCount: number, missCount: number, missedSlots: number[], lastMissAt: number | null }} TypingState
 * @typedef {{ state: TypingState, result: 'ok' | 'miss' | 'ignored', clauseEnded?: number, done?: boolean, caseOnly?: true }} PressResult
 *   caseOnly：文字列の中で、大文字・小文字だけが違う miss（Caps Lock のまま打っていると、ここで先に進めなくなる）
 */

/**
 * 表示用SQLから、打つべきスロットの列を作る。
 * @param {string} displaySql
 * @returns {TypingTarget}
 */
export function buildTarget(displaySql) {
  const tokens = tokenize(displaySql);
  // 前後の空白はスロットにしない
  const first = tokens.findIndex((t) => t.type !== 'space');
  const last = tokens.findLastIndex((t) => t.type !== 'space');
  /** @type {Slot[]} */
  const slots = [];
  const slotAtChar = new Map();

  tokens.slice(first, last + 1).forEach((token) => {
    if (token.type === 'space') {
      slots.push({ kind: 'separator', start: token.start, end: token.end });
      return;
    }
    const caseSensitive = token.type === 'string' || token.type === 'quoted';
    for (let i = token.start; i < token.end; i += 1) {
      slotAtChar.set(i, slots.length);
      slots.push({ kind: 'char', expected: displaySql[i], caseSensitive, start: i });
    }
  });

  const clauseEnds = new Map();
  const { ok, clauses } = splitClauses(displaySql);
  if (ok) {
    clauses.forEach((clause, index) => {
      const slotIndex = slotAtChar.get(clause.end - 1);
      if (slotIndex !== undefined) clauseEnds.set(slotIndex, index);
    });
  }
  return { text: displaySql, slots, clauseEnds };
}

/**
 * キーボードから1回のキーで打てない文字のスロット（文字列・コメントの中の改行やタブ、全角文字など）。
 * 区切りスロットの外で Enter や Tab が要るSQLは、画面では先に進めなくなるので、問題データの検証で止める。
 * @param {TypingTarget} target
 * @returns {{ slotIndex: number, char: string, start: number }[]}
 */
export function untypableSlots(target) {
  return target.slots.flatMap((slot, slotIndex) =>
    slot.kind === 'char' && !/^[\x20-\x7E]$/.test(slot.expected)
      ? [{ slotIndex, char: slot.expected, start: slot.start }]
      : [],
  );
}

/**
 * 先頭から打ち始める状態。
 * @param {TypingTarget} _target
 * @returns {TypingState}
 */
export function createTypingState(_target) {
  return { position: 0, okCount: 0, missCount: 0, missedSlots: [], lastMissAt: null };
}

/**
 * そのスロットに、そのキーが合うか（ChoiceEngine も同じ比べ方を使う）。
 * @param {Slot} slot
 * @param {string} key
 * @returns {boolean}
 */
export function slotMatches(slot, key) {
  if (slot.kind === 'separator') return key === ' ' || key === 'Enter';
  if (key === 'Enter') return false;
  return slot.caseSensitive
    ? key === slot.expected
    : key.toLowerCase() === slot.expected.toLowerCase();
}

/**
 * 1回のキー入力を判定する。引数の state は変えず、新しい状態を返す。
 * @param {TypingState} state
 * @param {TypingTarget} target
 * @param {string} key - KeyboardEvent.key
 * @returns {PressResult}
 */
export function pressKey(state, target, key) {
  const slot = target.slots[state.position];
  if (!slot) return { state, result: 'ignored' }; // 打ち終えたあと
  if (key.length !== 1 && key !== 'Enter') return { state, result: 'ignored' };

  const typedIndex = state.position;
  const matched = slotMatches(slot, key);
  // 打ち間違いも、印を付けて次へ進める。直前の打ち間違いの位置（lastMissAt）は、画面がその文字を目立たせるのに使う
  const next = matched
    ? { ...state, position: typedIndex + 1, okCount: state.okCount + 1, lastMissAt: null }
    : {
        ...state,
        position: typedIndex + 1,
        missCount: state.missCount + 1,
        missedSlots: [...state.missedSlots, typedIndex],
        lastMissAt: typedIndex,
      };
  /** @type {PressResult} */
  const outcome = { state: next, result: matched ? 'ok' : 'miss' };
  if (
    !matched &&
    slot.kind === 'char' &&
    slot.caseSensitive &&
    key.toLowerCase() === slot.expected.toLowerCase()
  ) {
    outcome.caseOnly = true;
  }
  const clauseIndex = target.clauseEnds.get(typedIndex);
  if (clauseIndex !== undefined) outcome.clauseEnded = clauseIndex;
  if (next.position === target.slots.length) outcome.done = true;
  return outcome;
}
