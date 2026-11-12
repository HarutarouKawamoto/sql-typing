import { loadKeywords } from '../../data/problem-loader.js';

/**
 * 用語辞典（data/keywords.yaml）の用語。説明を出す場所・説明の中身で使う。
 * 最初に使うときに1回だけ読む（import しただけで読むと、読めなかったときに画面が起動する前に落ちるため）。
 */

/** @type {{ words: string[], byWord: Map<string, import('../../schema/keyword-schema.js').Keyword> } | null} */
let cache = null;

function load() {
  if (!cache) {
    const keywords = loadKeywords();
    cache = {
      words: keywords.map((keyword) => keyword.word),
      byWord: new Map(keywords.map((keyword) => [keyword.word, keyword])),
    };
  }
  return cache;
}

/** @returns {string[]} 用語の表記（大文字）の一覧 */
export function getKeywordWords() {
  return load().words;
}

/** @returns {Map<string, import('../../schema/keyword-schema.js').Keyword>} 表記 → 用語 */
export function getKeywordMap() {
  return load().byWord;
}
