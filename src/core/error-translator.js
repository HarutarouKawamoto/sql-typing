import { ERROR_MESSAGES } from './error-messages.js';

/**
 * PostgreSQL のエラーを、日本語の題名とよくある原因にする。英語の原文も残す（画面で折りたたんで見せる）。
 * 元：docs/functional-design.md の ErrorTranslator
 */

/**
 * @typedef {{ code: string, message: string, position?: number, multipleStatements?: boolean }} PgError
 * @typedef {{ code: string, original: string, title: string, causes: string[] }} TranslatedError
 */

/**
 * @param {PgError} pgError
 * @returns {TranslatedError}
 */
export function translateError(pgError) {
  const base = { code: pgError.code, original: pgError.message };
  if (pgError.multipleStatements) {
    return {
      ...base,
      title: '1回に実行できるSQLは1つです',
      causes: ['; で区切って2つ以上の文を書いている（最後の ; 1つだけならよい）'],
    };
  }
  // 同じコードでも、英語の原文で原因がはっきりわかるものは、そちらを出す
  const special = SPECIAL_CASES.find(
    (c) => c.code === pgError.code && c.pattern.test(pgError.message),
  );
  if (special) return { ...base, title: special.title, causes: special.causes };

  const known = ERROR_MESSAGES[pgError.code];
  if (!known) return { ...base, title: 'エラーが起きました', causes: [] };
  const causes = [...known.causes];
  if (pgError.code === '42601' && /at end of input/.test(pgError.message)) {
    causes.unshift('SQLが途中で終わっています（句や条件の続きを書き忘れていないか）');
  }
  return { ...base, title: known.title, causes };
}

/** 同じ SQLSTATE でも原因が違うもの（英語の原文のパターンで見分ける） */
const SPECIAL_CASES = [
  {
    code: '42P01',
    pattern: /invalid reference to FROM-clause entry/,
    title: '別名を付けたテーブルを、元の名前で書いています',
    causes: ['FROM products AS p のように別名を付けたら、列は p.price のように別名で書く'],
  },
  {
    code: '42803',
    pattern: /aggregate functions are not allowed in WHERE/,
    title: 'WHERE の中では集計関数を使えません',
    causes: ['集計した結果で絞り込むときは、WHERE ではなく HAVING を使う'],
  },
  {
    code: '22P02',
    pattern: /type boolean/,
    title: '条件のところに、条件ではない値を書いています',
    causes: ["AND・OR の両側は条件にする（例：AND 'x' ではなく AND name = 'x'）"],
  },
];
