import { tokenize } from '../sql-text.js';

/**
 * SELECT 句を項目に分ける（ステップ再生の SELECT の段階で使う）。
 * - 先頭の SELECT と DISTINCT を取り除く
 * - 括弧・文字列の外のカンマで項目に分ける
 * - 項目が「列名」「列名 AS 別名」「列名 別名」（テーブルの別名付き `p.name` も）のときだけ、
 *   元の列（sourceColumn）と別名（alias）を持つ。式や "..." の識別子は持たない
 */

/**
 * @typedef {{ text: string, sourceColumn?: string, sourceTable?: string, alias?: string }} SelectItem
 */

const isMeaningful = (t) => t.type !== 'space' && t.type !== 'comment';

/**
 * @param {import('../sql-text.js').Token[]} tokens - 1つの項目の意味のあるトークン
 * @returns {{ sourceColumn?: string, sourceTable?: string, alias?: string }}
 */
function describeItem(tokens) {
  const words = tokens.map((t) => (t.type === 'word' ? t.text : null));
  // p.name → name を元の列、p をテーブル（JOIN で同じ名前の列があるときに見分ける）として見る
  let rest = tokens;
  /** @type {{ sourceTable?: string }} */
  const table = {};
  if (tokens.length >= 3 && words[0] && tokens[1].text === '.' && words[2]) {
    rest = tokens.slice(2);
    table.sourceTable = words[0].toLowerCase();
  }
  const restWords = rest.map((t) => (t.type === 'word' ? t.text : null));
  if (rest.length === 1 && restWords[0]) return { sourceColumn: restWords[0], ...table };
  if (rest.length === 2 && restWords[0] && restWords[1]) {
    return { sourceColumn: restWords[0], alias: restWords[1], ...table };
  }
  if (rest.length === 3 && restWords[0] && restWords[1]?.toUpperCase() === 'AS' && restWords[2]) {
    return { sourceColumn: restWords[0], alias: restWords[2], ...table };
  }
  return {};
}

/**
 * @param {string} selectClauseText - 'SELECT DISTINCT name AS item, price' のような SELECT 句の文字
 * @returns {{ distinct: boolean, unsupportedModifier: 'DISTINCT ON' | 'ALL' | null, items: SelectItem[] }}
 *   unsupportedModifier：ステップ再生でまだ扱わない書き方（DISTINCT ON・SELECT ALL）
 */
export function splitSelectList(selectClauseText) {
  const tokens = tokenize(selectClauseText);
  const meaningful = tokens.filter(isMeaningful);
  let startToken = meaningful[0];
  let distinct = false;
  /** @type {'DISTINCT ON' | 'ALL' | null} */
  let unsupportedModifier = null;
  const second = meaningful[1]?.type === 'word' ? meaningful[1].text.toUpperCase() : '';
  if (second === 'DISTINCT') {
    distinct = true;
    startToken = meaningful[1];
    if (meaningful[2]?.type === 'word' && meaningful[2].text.toUpperCase() === 'ON') {
      unsupportedModifier = 'DISTINCT ON';
    }
  } else if (second === 'ALL') {
    unsupportedModifier = 'ALL';
    startToken = meaningful[1];
  }
  const bodyStart = startToken ? startToken.end : 0;

  /** @type {SelectItem[]} */
  const items = [];
  let depth = 0;
  let segmentStart = bodyStart;
  /** @type {import('../sql-text.js').Token[]} */
  let segmentTokens = [];
  const close = (end) => {
    const text = selectClauseText.slice(segmentStart, end).trim();
    if (text) items.push({ text, ...describeItem(segmentTokens.filter(isMeaningful)) });
    segmentTokens = [];
  };

  for (const token of tokens) {
    if (token.start < bodyStart) continue;
    if (token.type === 'symbol' && token.text === '(') depth += 1;
    if (token.type === 'symbol' && token.text === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && token.type === 'symbol' && token.text === ',') {
      close(token.start);
      segmentStart = token.end;
      continue;
    }
    segmentTokens.push(token);
  }
  close(selectClauseText.length);
  return { distinct, unsupportedModifier, items };
}
