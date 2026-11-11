import { tokenize } from './sql-text.js';
import { translateError } from './error-translator.js';

/**
 * 判定。書いたSQLと正解SQLを実行し、問題の judge のルールで正解かどうかを決める。
 * 結果で比べるので、書き方の違う別解も正解になる。判定の前とあとに DB を初期状態に戻す。
 * judge は reset → 実行 → reset を順に行うので、画面からは1つずつ呼ぶこと（同時に2つ呼ぶと割り込まれる）。
 * 元：docs/functional-design.md の Judge
 */

/**
 * コアレイヤーは data を import しないので、使う形だけをここで決める（SqlRunner はこの形を満たす）。
 * @typedef {string | number | boolean | null} SqlValue
 * @typedef {{ columns: string[], rows: SqlValue[][] }} Table
 * @typedef {{ code: string, message: string, position?: number, multipleStatements?: boolean }} PgError
 * @typedef {{ ok: true, result: Table } | { ok: false, error: PgError } | { ok: false, timeout: true }} RunOutcome
 * @typedef {{ run: (sql: string) => Promise<RunOutcome>, reset: () => Promise<void> }} Runner
 * @typedef {{
 *   ordered: boolean, checkColumnNames?: boolean, require?: string[], forbid?: string[],
 *   compareTable?: string, ignoreColumns?: string[],
 * }} JudgeRule
 * @typedef {{ answer: string, judge: JudgeRule }} JudgedProblem
 * @typedef {{ ok: true, table: Table } | { ok: false, message: string }} Expected
 * @typedef {'empty' | 'columnCount' | 'columnNames' | 'columnOrder' | 'rowCount' | 'values' | 'order' | 'tableMissing'} WrongReason
 * @typedef {{
 *   status: 'correct' | 'wrong' | 'ruleViolation' | 'error' | 'timeout',
 *   reason?: WrongReason,
 *   message?: string,
 *   mine?: Table,
 *   expected?: Table,
 *   error?: import('./error-translator.js').TranslatedError,
 * }} JudgeResult
 */

const TIMEOUT_MESSAGE = '5秒で打ち切りました。終わらない条件になっていないか確かめてください';

/** 関数として使ったときだけ数える語（`SELECT 30 AS count` で COUNT を使ったことにしない） */
const FUNCTION_WORDS = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'ROUND',
  'COALESCE',
  'UPPER',
  'LOWER',
  'LENGTH',
  'SUBSTRING',
  'NOW',
]);

/** 数値を同じと見なす差（相対 1e-9。浮動小数の計算の誤差・NUMERIC と INTEGER の違いを吸収する） */
const RELATIVE_TOLERANCE = 1e-9;

/**
 * 表示や説明のための値（比べるのは cellsEqual）。-0 は 0、NaN・±Infinity は文字の印にする
 * （JSON にすると null と同じになってしまうため）。
 * @param {SqlValue} value
 * @returns {SqlValue}
 */
export function normalizeCell(value) {
  if (typeof value !== 'number') return value;
  if (Number.isNaN(value)) return '__NaN__';
  if (!Number.isFinite(value)) return value > 0 ? '__Infinity__' : '__-Infinity__';
  return value === 0 ? 0 : value;
}

/**
 * 2つの値が同じか。数値は許容誤差で比べる（丸めて比べると、目盛りの境目で同じ値が分かれるため）。
 * 数値と文字列、NULL と文字列 'NULL' は違う。NaN は NaN どうしだけ同じ。
 * @param {SqlValue} a
 * @param {SqlValue} b
 */
export function cellsEqual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
    return Math.abs(a - b) <= RELATIVE_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
  }
  return a === b;
}

const rowsEqual = (a, b) => a.length === b.length && a.every((v, i) => cellsEqual(v, b[i]));

/** 数値以外の値で行を分けるための印（同じ印の行の中だけを許容誤差で比べる。全部の行どうしを比べないように） */
const bucketKey = (row) => JSON.stringify(row.map((v) => (typeof v === 'number' ? 'N' : v)));

const describeRow = (row) => row.map((v) => (v === null ? 'NULL' : String(v))).join(', ');
const lower = (columns) => columns.map((c) => c.toLowerCase());

/** 行の中身を並びを無視して比べる（同じ行が2つあれば2つとも要る）。同じなら null、違えば余っている行 */
function extraRow(mine, expected) {
  /** @type {Map<string, SqlValue[][]>} */
  const buckets = new Map();
  for (const row of expected.rows) {
    const k = bucketKey(row);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(row);
  }
  return (
    mine.rows.find((row) => {
      const candidates = buckets.get(bucketKey(row)) ?? [];
      const at = candidates.findIndex((candidate) => rowsEqual(row, candidate));
      if (at === -1) return true;
      candidates.splice(at, 1);
      return false;
    }) ?? null
  );
}

/** 列の並びを target の名前の順に並べ替える（名前は小文字で比べる） */
function reorderColumns(table, targetColumns) {
  const index = lower(table.columns);
  const order = lower(targetColumns).map((name) => index.indexOf(name));
  return { columns: targetColumns, rows: table.rows.map((row) => order.map((i) => row[i])) };
}

/**
 * 2つの表を比べる。同じなら null、違えば理由と日本語の説明。
 * 比べる順：列の数 → （checkColumnNames なら）列の名前 → 行の数 → 列の並び順だけが違うか → 値 → （ordered なら）並び。
 * @param {Table} mine
 * @param {Table} expected
 * @param {{ ordered: boolean, checkColumnNames?: boolean }} rule
 * @returns {{ reason: WrongReason, message: string } | null}
 */
export function compareTables(mine, expected, { ordered, checkColumnNames = false }) {
  if (mine.columns.length !== expected.columns.length) {
    return {
      reason: 'columnCount',
      message: `列の数が違います（あなた：${mine.columns.length}列／正解：${expected.columns.length}列）`,
    };
  }
  if (
    checkColumnNames &&
    mine.columns.some((c, i) => c.toLowerCase() !== expected.columns[i].toLowerCase())
  ) {
    return {
      reason: 'columnNames',
      message: `列の名前が違います（あなた：${mine.columns.join(', ')}／正解：${expected.columns.join(', ')}）`,
    };
  }
  if (mine.rows.length !== expected.rows.length) {
    return {
      reason: 'rowCount',
      message: `行の数が違います（あなた：${mine.rows.length}行／正解：${expected.rows.length}行）`,
    };
  }
  const extra = extraRow(mine, expected);
  if (extra) {
    // 列の名前が同じで並び順だけが違い、並べ直すと中身が合うなら、そう伝える
    const sameNames =
      JSON.stringify([...lower(mine.columns)].sort()) ===
        JSON.stringify([...lower(expected.columns)].sort()) &&
      JSON.stringify(lower(mine.columns)) !== JSON.stringify(lower(expected.columns));
    if (sameNames && !extraRow(reorderColumns(mine, expected.columns), expected)) {
      return {
        reason: 'columnOrder',
        message: `列の並び順が違います（正解：${expected.columns.join(', ')} の順）`,
      };
    }
    return {
      reason: 'values',
      message: `値が違う行があります（例：あなたの結果の「${describeRow(extra)}」は正解にありません）`,
    };
  }
  if (ordered && mine.rows.some((row, i) => !rowsEqual(row, expected.rows[i]))) {
    return { reason: 'order', message: '行の順番が違います（中身は合っています）' };
  }
  return null;
}

/**
 * 語を探すためのトークン列。空白・コメント・文字列・"…" の識別子は除き、記号は残す
 * （記号を飛ばすと `ORDER, BY` が ORDER BY に見えてしまう）。
 * `t.in` のように直前が `.` の単語は列名なので、語として数えない。
 */
function phraseTokens(sql) {
  const tokens = tokenize(sql).filter(
    (t) => t.type !== 'space' && t.type !== 'comment' && t.type !== 'string' && t.type !== 'quoted',
  );
  return tokens.map((t, i) => ({
    text: t.text.toUpperCase(),
    isWord: t.type === 'word' && tokens[i - 1]?.text !== '.',
    next: tokens[i + 1]?.text,
  }));
}

/** トークン列の中に、phrase（'IS NULL' のような1〜2語）が続けて出てくるか。関数名は `(` が続くときだけ */
function containsPhrase(tokens, phrase) {
  const parts = phrase.toUpperCase().split(/\s+/);
  return tokens.some((_, i) =>
    parts.every((part, j) => {
      const token = tokens[i + j];
      if (!token?.isWord || token.text !== part) return false;
      return !(parts.length === 1 && FUNCTION_WORDS.has(part)) || token.next === '(';
    }),
  );
}

/**
 * 問題ごとの「必ず使う／使ってはいけない」条件。合っていれば null、合わなければ説明。
 * 文字列・コメントの中、`t.in` のような列名、関数でない COUNT などは数えない。
 * 既知の制限：サブクエリの中だけに出てくる語も数える。NOT BETWEEN も BETWEEN を使ったことになる。
 * @param {string} sql
 * @param {{ require?: string[], forbid?: string[] }} rule
 * @returns {string | null}
 */
export function findRuleViolation(sql, { require = [], forbid = [] }) {
  const tokens = phraseTokens(sql);
  const missing = require.find((phrase) => !containsPhrase(tokens, phrase));
  if (missing !== undefined)
    return `結果は正しいです。ただし今回は ${missing} を使って書いてみよう`;
  const used = forbid.find((phrase) => containsPhrase(tokens, phrase));
  if (used !== undefined) return `結果は正しいです。ただし今回は ${used} を使わずに書いてみよう`;
  return null;
}

/** テーブル名を SQL の識別子として安全に書く */
const quoteIdent = (name) => `"${name.replaceAll('"', '""')}"`;

/** ignoreColumns の列を外す（書き換え系で、SERIAL の id など書き方で値が変わる列を比べない） */
function withoutColumns(table, ignoreColumns = []) {
  if (ignoreColumns.length === 0) return table;
  const ignored = new Set(ignoreColumns.map((c) => c.toLowerCase()));
  const keep = table.columns
    .map((c, i) => (ignored.has(c.toLowerCase()) ? -1 : i))
    .filter((i) => i >= 0);
  return {
    columns: keep.map((i) => table.columns[i]),
    rows: table.rows.map((row) => keep.map((i) => row[i])),
  };
}

/**
 * SQLを実行して、比べる表を作る。書き換え系（compareTable）は実行後のテーブルの中身。
 * @param {Runner} runner
 * @param {string} sql
 * @param {JudgeRule} rule
 * @returns {Promise<{ table: Table } | { error: PgError } | { timeout: true } | { tableMissing: string }>}
 */
async function runForTable(runner, sql, rule) {
  const outcome = await runner.run(sql);
  if (!outcome.ok) return 'timeout' in outcome ? { timeout: true } : { error: outcome.error };
  if (!rule.compareTable) return { table: outcome.result };
  const after = await runner.run(`SELECT * FROM ${quoteIdent(rule.compareTable)}`);
  if (!after.ok) {
    if ('timeout' in after) return { timeout: true };
    // 学習者のSQLがテーブルを消した（DROP TABLE など）
    if (after.error.code === '42P01') return { tableMissing: rule.compareTable };
    return { error: after.error };
  }
  return { table: withoutColumns(after.result, rule.ignoreColumns) };
}

/**
 * 正解の結果を作る（問題を開いたときに1回）。前とあとに DB を初期状態に戻す。
 * @param {{ problem: JudgedProblem, runner: Runner }} args
 * @returns {Promise<Expected>}
 */
export async function computeExpected({ problem, runner }) {
  await runner.reset();
  try {
    const result = await runForTable(runner, problem.answer, problem.judge);
    if ('table' in result) return { ok: true, table: result.table };
    if ('timeout' in result) return { ok: false, message: '正解SQLが時間内に終わりません' };
    if ('tableMissing' in result) {
      return { ok: false, message: `正解SQLのあとに ${result.tableMissing} がありません` };
    }
    return { ok: false, message: result.error.message };
  } finally {
    await runner.reset();
  }
}

/**
 * @param {{ sql: string, problem: JudgedProblem, runner: Runner, expected?: Expected }} args
 *   expected：computeExpected の結果（省くとその場で作る）
 * @returns {Promise<JudgeResult>}
 */
export async function judge({ sql, problem, runner, expected }) {
  if (!tokenize(sql).some((t) => t.type !== 'space' && t.type !== 'comment')) {
    return { status: 'wrong', reason: 'empty', message: 'SQLが空です' };
  }
  const answer = expected ?? (await computeExpected({ problem, runner }));
  // 正解SQLが動かないのは問題データの間違い（ビルド前の検証で止まっているはず）なので投げる
  if (!answer.ok) throw new Error(`正解SQLを実行できません：${answer.message}`);
  const rule = problem.judge;

  await runner.reset();
  try {
    const mine = await runForTable(runner, sql, rule);
    if ('timeout' in mine) return { status: 'timeout', message: TIMEOUT_MESSAGE };
    if ('error' in mine) return { status: 'error', error: translateError(mine.error) };
    if ('tableMissing' in mine) {
      return {
        status: 'wrong',
        reason: 'tableMissing',
        message: `テーブル ${mine.tableMissing} がなくなっています（DROP TABLE などで消していないか）`,
      };
    }

    // 書き換え系はテーブルの中身なので、並びと列の名前は比べない
    const difference = compareTables(mine.table, answer.table, {
      ordered: rule.compareTable ? false : rule.ordered,
      checkColumnNames: rule.compareTable ? false : rule.checkColumnNames,
    });
    if (difference) {
      return { status: 'wrong', ...difference, mine: mine.table, expected: answer.table };
    }
    const violation = findRuleViolation(sql, rule);
    if (violation) return { status: 'ruleViolation', message: violation, mine: mine.table };
    return { status: 'correct', mine: mine.table };
  } finally {
    await runner.reset();
  }
}
