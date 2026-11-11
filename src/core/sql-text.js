/**
 * SQLの小さな字句解析。TypingEngine（文字列の中かどうか）・ClauseSplitter（句の区切り）・
 * Scoring（苦手のキーワード）・Judge（必ず使う／使ってはいけないキーワード）で共有する。
 * 打っている途中のSQLも扱えるように、閉じていない文字列・コメントは最後までをその種類にする。
 * $$ で囲む文字列は扱わない（初級・中級に出ないため）。
 */

/**
 * @typedef {'word' | 'string' | 'quoted' | 'number' | 'symbol' | 'space' | 'comment'} TokenType
 * @typedef {{ type: TokenType, text: string, start: number, end: number }} Token
 */

const isSpace = (ch) => /\s/.test(ch);
const isWordStart = (ch) => /[A-Za-z_]/.test(ch);
const isWordPart = (ch) => /[A-Za-z0-9_]/.test(ch);
const isDigit = (ch) => /[0-9]/.test(ch);

/**
 * quote で囲まれた部分の終わり（閉じの次の位置）を返す。quote 2つ続きは中の1文字として扱う。
 * 閉じていなければ文字列の長さを返す。
 * @param {string} sql
 * @param {number} from - 開きの quote の位置
 * @param {string} quote
 * @returns {number}
 */
function endOfQuoted(sql, from, quote) {
  let i = from + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

/**
 * @param {string} sql
 * @returns {Token[]}
 */
export function tokenize(sql) {
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  const push = (type, end) => {
    tokens.push({ type, text: sql.slice(i, end), start: i, end });
    i = end;
  };

  while (i < sql.length) {
    const ch = sql[i];
    if (isSpace(ch)) {
      let end = i + 1;
      while (end < sql.length && isSpace(sql[end])) end += 1;
      push('space', end);
    } else if (ch === "'") {
      push('string', endOfQuoted(sql, i, "'"));
    } else if (ch === '"') {
      push('quoted', endOfQuoted(sql, i, '"'));
    } else if (ch === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i);
      push('comment', newline === -1 ? sql.length : newline);
    } else if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      push('comment', close === -1 ? sql.length : close + 2);
    } else if (isWordStart(ch)) {
      let end = i + 1;
      while (end < sql.length && isWordPart(sql[end])) end += 1;
      push('word', end);
    } else if (isDigit(ch)) {
      let end = i + 1;
      while (
        end < sql.length &&
        (isDigit(sql[end]) || (sql[end] === '.' && isDigit(sql[end + 1] ?? '')))
      ) {
        end += 1;
      }
      push('number', end);
    } else {
      push('symbol', i + 1);
    }
  }
  return tokens;
}
