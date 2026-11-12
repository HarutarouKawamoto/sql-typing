import { tokenize } from '../sql-text.js';

/**
 * FROM 句を、最初のテーブルと JOIN の並びに分ける（ステップ再生で、JOIN を1つずつ段階にするため）。
 * 扱うのは `[INNER] JOIN` と `LEFT [OUTER] JOIN` の ON つきだけ。RIGHT・FULL・CROSS・NATURAL・USING・
 * カンマ・サブクエリ・LATERAL は扱わない（行の目印のつなぎ方・段階の見せ方が違うため）。
 */

/**
 * @typedef {{ name: string, alias: string | null, ref: string, text?: string }} TableRef
 *   name：テーブル名（引用符なしは小文字）。ref：SQLの中でこのテーブルを指す名前（別名、なければ名前）
 * @typedef {{ kind: 'INNER' | 'LEFT', table: TableRef, start: number, end: number }} JoinPart
 *   start〜end：fromText の中の、この JOIN の文字の範囲（JOIN の前の INNER・LEFT から ON の条件の終わりまで）
 */

/** JOIN の始まりになる語（ON の条件はこの手前まで） */
const JOIN_START = new Set(['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL']);
/** JOIN の種類で、まだ扱わないもの（理由の文に使う） */
const OTHER_JOINS = new Set(['RIGHT', 'FULL', 'CROSS', 'NATURAL']);
/** 引用符つきの名前の中身（"" は " 1つ） */
const unquote = (text) => text.slice(1, -1).replaceAll('""', '"');
/** テーブルの別名にならない語 */
const NOT_ALIAS = new Set([...JOIN_START, 'ON', 'USING', 'OUTER', 'LATERAL', 'AS']);

/**
 * @param {string} fromText - 'FROM orders o JOIN customers c ON ...' のような FROM 句の文字
 * @returns {{ base: TableRef, joins: JoinPart[] } | { unsupported: string }}
 */
export function parseFrom(fromText) {
  const tokens = tokenize(fromText).filter((t) => t.type !== 'space' && t.type !== 'comment');
  const upper = (i) => (tokens[i]?.type === 'word' ? tokens[i].text.toUpperCase() : null);
  let i = 1; // 先頭の FROM の次

  /** テーブル名と別名を読む。読めなければ理由 */
  const readTable = () => {
    const token = tokens[i];
    if (!token) return 'テーブルがありません';
    if (token.text === '(') return 'サブクエリの FROM のステップ再生はまだありません';
    if (upper(i) === 'LATERAL') return 'LATERAL のステップ再生はまだありません';
    if (token.type !== 'word' && token.type !== 'quoted') return 'テーブルを読めません';
    const name = token.type === 'word' ? token.text.toLowerCase() : unquote(token.text);
    let ref = token.text;
    let alias = null;
    i += 1;
    if (tokens[i]?.text === '.') return 'スキーマ名つきのテーブルのステップ再生はまだありません';
    if (tokens[i]?.text === '(') return '関数を使う FROM のステップ再生はまだありません';
    if (upper(i) === 'AS') i += 1;
    const next = tokens[i];
    if (next && (next.type === 'quoted' || (next.type === 'word' && !NOT_ALIAS.has(upper(i))))) {
      alias = next.type === 'word' ? next.text.toLowerCase() : unquote(next.text);
      ref = next.text;
      i += 1;
    }
    return { name, alias, ref, end: tokens[i - 1].end };
  };

  const base = readTable();
  if (typeof base === 'string') return { unsupported: base };
  /** @type {JoinPart[]} */
  const joins = [];

  while (i < tokens.length) {
    const start = tokens[i].start;
    let kind;
    if (tokens[i].text === ',')
      return { unsupported: 'カンマで並べたテーブルのステップ再生はまだありません' };
    if (upper(i) === 'JOIN') {
      kind = 'INNER';
      i += 1;
    } else if (upper(i) === 'INNER' && upper(i + 1) === 'JOIN') {
      kind = 'INNER';
      i += 2;
    } else if (upper(i) === 'LEFT' && upper(i + 1) === 'JOIN') {
      kind = 'LEFT';
      i += 2;
    } else if (upper(i) === 'LEFT' && upper(i + 1) === 'OUTER' && upper(i + 2) === 'JOIN') {
      kind = 'LEFT';
      i += 3;
    } else if (OTHER_JOINS.has(upper(i) ?? '')) {
      return { unsupported: `${upper(i)} JOIN のステップ再生はまだありません` };
    } else {
      return { unsupported: 'この形の FROM のステップ再生はまだありません' };
    }

    const table = readTable();
    if (typeof table === 'string') return { unsupported: table };
    if (upper(i) === 'USING')
      return { unsupported: 'USING の JOIN のステップ再生はまだありません' };
    if (upper(i) !== 'ON') return { unsupported: 'ON のない JOIN のステップ再生はまだありません' };
    i += 1;

    // ON の条件：括弧の外で次の JOIN が始まる手前まで
    let depth = 0;
    let end = tokens[i - 1].end;
    while (i < tokens.length) {
      const token = tokens[i];
      // left(...)・right(...) は関数で、JOIN の始まりではない
      const startsJoin = JOIN_START.has(upper(i) ?? '') && tokens[i + 1]?.text !== '(';
      if (depth === 0 && (startsJoin || token.text === ',')) break;
      if (token.text === '(') depth += 1;
      if (token.text === ')') depth = Math.max(0, depth - 1);
      end = token.end;
      i += 1;
    }
    joins.push({
      kind,
      table: { name: table.name, alias: table.alias, ref: table.ref },
      start,
      end,
    });
  }

  const refs = [base.ref, ...joins.map((j) => j.table.ref)].map((ref) => ref.toLowerCase());
  if (new Set(refs).size !== refs.length) {
    return { unsupported: '同じ名前で2回使うテーブルには、別名を付けてください' };
  }
  return {
    base: { name: base.name, alias: base.alias, ref: base.ref, text: fromText.slice(0, base.end) },
    joins,
  };
}
