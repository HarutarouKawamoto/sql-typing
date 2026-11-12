import { tokenize } from '../sql-text.js';

/**
 * 集計関数・ウィンドウ関数を見つける（ステップ再生で、集計するSQLかを決めるため）。
 * 括弧の中のサブクエリ（`(SELECT avg(price) ...)`）の集計は、外の行をまとめないので数えない。
 */

/** 集計関数（GROUP BY がなくても1行にまとめてしまうので、行の対応が取れない） */
const AGGREGATES = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'STRING_AGG',
  'ARRAY_AGG',
  'BOOL_AND',
  'BOOL_OR',
  'EVERY',
  'JSON_AGG',
  'JSONB_AGG',
]);

const isMeaningful = (t) => t.type !== 'space' && t.type !== 'comment';

/**
 * サブクエリの外に集計関数があるか。
 * @param {string} text
 * @returns {boolean}
 */
export function hasAggregate(text) {
  const tokens = tokenize(text).filter(isMeaningful);
  /** @type {boolean[]} 開いている括弧ごとに、サブクエリの括弧か */
  const stack = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === 'symbol' && token.text === '(') {
      stack.push(tokens[i + 1]?.type === 'word' && tokens[i + 1].text.toUpperCase() === 'SELECT');
      continue;
    }
    if (token.type === 'symbol' && token.text === ')') {
      stack.pop();
      continue;
    }
    if (
      token.type === 'word' &&
      AGGREGATES.has(token.text.toUpperCase()) &&
      tokens[i + 1]?.text === '(' &&
      !stack.includes(true)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * ウィンドウ関数（OVER）があるか（行をまとめずに集計するので、上級の見える化で扱う）。
 * @param {string} text
 */
export function hasWindow(text) {
  return tokenize(text).some((t) => t.type === 'word' && t.text.toUpperCase() === 'OVER');
}
