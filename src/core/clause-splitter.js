import { tokenize } from './sql-text.js';

/**
 * SQLを最上位の句（SELECT / FROM / WHERE / GROUP BY / HAVING / ORDER BY / LIMIT）に分ける。
 * 括弧の中（サブクエリ・関数の引数）と、文字列・コメントの中のキーワードでは区切らない。
 * DISTINCT は SELECT の句の一部、OFFSET は LIMIT の句の一部。
 * 扱わない書き方：`IS DISTINCT FROM`（括弧の外の FROM を2つ目の FROM 句と数えて ok: false になる）。
 * 初級・中級には出ないため。
 * 元：docs/functional-design.md の ClauseSplitter
 */

/**
 * @typedef {'SELECT' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY' | 'LIMIT'} ClauseKind
 * @typedef {{ kind: ClauseKind, start: number, end: number, writtenOrder: number, execOrder: number }} Clause
 */

/** 書く順番（文法の順番）。この順に並んでいないSQLは ok: false */
const WRITTEN_ORDER = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'];

/** DBが処理する順番 */
const EXEC_RANK = {
  FROM: 1,
  WHERE: 2,
  'GROUP BY': 3,
  HAVING: 4,
  SELECT: 5,
  'ORDER BY': 6,
  LIMIT: 7,
};

const SINGLE_WORD = new Set(['SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT']);
const NEEDS_BY = new Set(['GROUP', 'ORDER']);

/**
 * @param {string} sql
 * @returns {{ ok: boolean, clauses: Clause[] }}
 */
export function splitClauses(sql) {
  const tokens = tokenize(sql);
  const meaningful = tokens.filter((t) => t.type !== 'space' && t.type !== 'comment');
  if (meaningful.length === 0 || meaningful[0].text.toUpperCase() !== 'SELECT') {
    return { ok: false, clauses: [] };
  }

  /** @type {{ kind: ClauseKind, start: number }[]} */
  const starts = [];
  let depth = 0;
  for (let i = 0; i < meaningful.length; i += 1) {
    const token = meaningful[i];
    if (token.type === 'symbol') {
      if (token.text === '(') depth += 1;
      if (token.text === ')') depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 || token.type !== 'word') continue;
    const word = token.text.toUpperCase();
    if (SINGLE_WORD.has(word)) {
      starts.push({ kind: /** @type {ClauseKind} */ (word), start: token.start });
    } else if (NEEDS_BY.has(word) && meaningful[i + 1]?.text.toUpperCase() === 'BY') {
      starts.push({ kind: /** @type {ClauseKind} */ (`${word} BY`), start: token.start });
      i += 1;
    }
  }

  // 同じ句が2回、または文法の順番でない並びは扱わない
  const positions = starts.map((s) => WRITTEN_ORDER.indexOf(s.kind));
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] <= positions[i - 1]) return { ok: false, clauses: [] };
  }

  const presentByRank = [...starts].sort((a, b) => EXEC_RANK[a.kind] - EXEC_RANK[b.kind]);
  const execOrderOf = new Map(presentByRank.map((s, index) => [s.kind, index + 1]));

  const clauses = starts.map((s, index) => {
    const limit = index + 1 < starts.length ? starts[index + 1].start : sql.length;
    // 句の終わりは、次の句の手前にある最後の意味のあるトークンの終わり（後ろの空白は含めない）
    const last = meaningful.filter((t) => t.start >= s.start && t.end <= limit).at(-1);
    return {
      kind: s.kind,
      start: s.start,
      end: last ? last.end : s.start,
      writtenOrder: index + 1,
      execOrder: /** @type {number} */ (execOrderOf.get(s.kind)),
    };
  });
  return { ok: true, clauses };
}

/**
 * 打っている途中に、句の終わりまでのSQLを実行してよいか（見える化C）。
 * 句に分けられる読み取りだけの SELECT なら true。書き換え系（UPDATE など）と、
 * 括弧の外に INTO がある SELECT（SELECT ... INTO で表を作る）は、途中で実行すると DB が変わるので false。
 * 画面（use-typing-session）と問題データの検証で、この関数だけを判定の元にする。
 * @param {string} sql
 * @returns {boolean}
 */
export function canRunWhileTyping(sql) {
  if (!splitClauses(sql).ok) return false;
  let depth = 0;
  for (const token of tokenize(sql)) {
    if (token.type === 'symbol' && token.text === '(') depth += 1;
    if (token.type === 'symbol' && token.text === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && token.type === 'word' && token.text.toUpperCase() === 'INTO') return false;
  }
  return true;
}
