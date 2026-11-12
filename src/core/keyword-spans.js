import { tokenize } from './sql-text.js';

/**
 * SQLの中の、用語辞典の語の場所（キーワードにカーソルを当てたときの説明のため）。
 * 元：docs/functional-design.md の KeywordTip
 */

/**
 * なぞり書きのスロットごとの語（TypingArea で、語のスロットに data-keyword を付けるため）。
 * 複数語の用語は、間の区切りのスロットにも同じ語を付ける（語の間をカーソルが通っても説明が消えないように）。
 * group は何番目の語か（同じ語の中をカーソルが動いても、説明を出し直さないため）。
 * @param {import('./typing-engine.js').TypingTarget} target
 * @param {string[]} words
 * @returns {({ word: string, group: number } | undefined)[]} スロットの順
 */
export function keywordsOfSlots(target, words) {
  const spans = findKeywordSpans(target.text, words);
  return target.slots.map((slot) => {
    const group = spans.findIndex((span) => slot.start >= span.start && slot.start < span.end);
    return group < 0 ? undefined : { word: spans[group].word, group };
  });
}

/** 用語辞典の語は多くて3語（IS NOT NULL） */
const MAX_WORDS = 3;

/**
 * @param {string} sql
 * @param {string[]} words - 用語辞典の表記（大文字。複数語は空白1つで区切る）
 * @returns {{ start: number, end: number, word: string }[]} 前から順
 */
export function findKeywordSpans(sql, words) {
  const known = new Set(words);
  const tokens = tokenize(sql);
  /** @type {{ start: number, end: number, word: string }[]} */
  const spans = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].type !== 'word') {
      i += 1;
      continue;
    }
    // 空白だけをはさんで続く語（コメント・記号をはさんだらそこまで）
    const run = [i];
    let j = i + 1;
    while (run.length < MAX_WORDS && j < tokens.length) {
      while (tokens[j]?.type === 'space') j += 1;
      if (tokens[j]?.type !== 'word') break;
      run.push(j);
      j += 1;
    }
    // 長いものを先に調べる
    let matched = 0;
    for (let n = run.length; n >= 1; n -= 1) {
      const word = run
        .slice(0, n)
        .map((index) => tokens[index].text.toUpperCase())
        .join(' ');
      if (known.has(word)) {
        spans.push({ start: tokens[i].start, end: tokens[run[n - 1]].end, word });
        matched = n;
        break;
      }
    }
    i = matched > 0 ? run[matched - 1] + 1 : i + 1;
  }
  return spans;
}
