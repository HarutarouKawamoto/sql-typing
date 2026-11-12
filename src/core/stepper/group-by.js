import { tokenize } from '../sql-text.js';
import { hasAggregate } from './aggregates.js';

/**
 * GROUP BY 句を項目に分ける（ステップ再生の GROUP BY の段階で、各行のグループの鍵を作るため）。
 * 列の番号（GROUP BY 1）と SELECT の別名は、段階のSQLの中ではそのまま使えない（「1という値」・ない列になる）ので、
 * resolveGroupItems で SELECT の項目の式に置き換える。
 * ROLLUP・CUBE・GROUPING SETS は、1行が2つ以上のグループに入るので扱わない。
 */

const UNSUPPORTED = new Set(['ROLLUP', 'CUBE', 'GROUPING']);

/**
 * @param {string} clauseText - 'GROUP BY category, price / 1000' のような GROUP BY 句の文字
 * @returns {{ items: string[] } | { unsupported: string }}
 */
export function splitGroupBy(clauseText) {
  const tokens = tokenize(clauseText);
  // 先頭の GROUP と BY を除く
  const meaningful = tokens.filter((t) => t.type !== 'space' && t.type !== 'comment');
  const byToken = meaningful[1];
  if (!byToken) return { unsupported: 'GROUP BY の項目がありません' };
  const body = clauseText.slice(byToken.end);

  /** @type {string[]} */
  const items = [];
  let depth = 0;
  let start = 0;
  for (const token of tokenize(body)) {
    if (token.type === 'word' && depth === 0 && UNSUPPORTED.has(token.text.toUpperCase())) {
      return { unsupported: `${token.text.toUpperCase()} を使う GROUP BY は扱えません` };
    }
    if (token.type !== 'symbol') continue;
    if (token.text === '(') depth += 1;
    if (token.text === ')') depth = Math.max(0, depth - 1);
    if (token.text === ',' && depth === 0) {
      items.push(body.slice(start, token.start).trim());
      start = token.end;
    }
  }
  items.push(body.slice(start).trim());

  if (items.some((item) => item === '')) return { unsupported: 'GROUP BY の項目が空です' };
  return { items };
}

/** 別名とみなさない、式の終わりに来る語 */
const NOT_ALIAS = new Set(['END', 'NULL', 'TRUE', 'FALSE']);

/**
 * SELECT の項目を「式」と「別名」に分ける。AS があれば確か。AS がないときは、式が語・数・閉じ括弧・引用で
 * 終わり、そのあとに語が1つだけあるときだけ別名とみなす（`a + b` の b を別名にしない）。
 * @param {string} text
 * @returns {{ expression: string, alias?: string }}
 */
function splitAlias(text) {
  const withAs = /^(.*\S)\s+AS\s+([A-Za-z_][A-Za-z0-9_]*)$/is.exec(text);
  if (withAs) return { expression: withAs[1], alias: withAs[2].toLowerCase() };
  const bare = /^(.*[A-Za-z0-9_)'"])\s+([A-Za-z_][A-Za-z0-9_]*)$/s.exec(text);
  if (bare && !NOT_ALIAS.has(bare[2].toUpperCase())) {
    return { expression: bare[1], alias: bare[2].toLowerCase() };
  }
  return { expression: text };
}

/**
 * GROUP BY の項目のうち、列の番号（括弧つきも）と SELECT の別名を、SELECT の項目の式に置き換える。
 * 入力の列名と同じ名前は、別名より列を優先する（PostgreSQL と同じ）。
 * @param {string[]} items - splitGroupBy の項目
 * @param {{ text: string }[]} selectItems - splitSelectList の項目
 * @param {string[]} inputColumns - FROM の段階の列名（小文字）
 * @returns {{ items: string[] } | { unsupported: string }}
 */
export function resolveGroupItems(items, selectItems, inputColumns) {
  const columns = new Set(inputColumns.map((c) => c.toLowerCase()));
  const parsed = selectItems.map((item) => splitAlias(item.text.trim()));
  const resolved = [];
  for (const item of items) {
    const number = /^\(*\s*(\d+)\s*\)*$/.exec(item);
    if (number) {
      const target = parsed[Number(number[1]) - 1];
      if (!target)
        return { unsupported: `GROUP BY ${item} の列の番号が SELECT の項目にありません` };
      if (hasAggregate(target.expression)) {
        return { unsupported: `GROUP BY ${item} が集計関数の項目を指しています` };
      }
      resolved.push(target.expression);
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(item) ? item.toLowerCase() : null;
    const aliased = name && !columns.has(name) ? parsed.find((p) => p.alias === name) : undefined;
    resolved.push(aliased ? aliased.expression : item);
  }
  return { items: resolved };
}
