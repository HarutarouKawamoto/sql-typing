import { canRunWhileTyping, splitClauses } from '../clause-splitter.js';
import { tokenize } from '../sql-text.js';
import { splitSelectList } from './select-list.js';

/**
 * 見える化A（ステップ再生）の段階を作る。
 * SQLを実行順（FROM → WHERE → SELECT → DISTINCT → ORDER BY → LIMIT）の段階に分け、
 * 各段階の表を「本物のSQL」として PostgreSQL で実行して作る。行は ctid（行の目印）で前の段階とつなぐ。
 * 段階のSQLは、ClauseSplitter の句の範囲で元のSQLの文字をそのまま切り貼りして作る（構文木は使わない）。
 * 間違った見える化を見せないため、対応しない形は先に unsupported にし、最後の段階が元のSQLの結果と
 * 一致しなければ mismatch にする。
 * 今は初級の単一テーブルの形だけ。GROUP BY・JOIN の段階は中級（P1）でこのフォルダに足す。
 * 元：docs/functional-design.md の Stepper
 */

/**
 * コアレイヤーは data を import しないので、使う形だけをここで決める（SqlRunner はこの形を満たす）。
 * @typedef {string | number | boolean | null} SqlValue
 * @typedef {{ columns: string[], rows: SqlValue[][] }} QueryTable
 * @typedef {{ ok: true, result: QueryTable } | { ok: false, error: { code: string, message: string } } | { ok: false, timeout: true }} RunOutcome
 * @typedef {{ run: (sql: string) => Promise<RunOutcome> }} Runner
 *
 * @typedef {{ rid: string, values: SqlValue[] }} StepRow
 * @typedef {{
 *   removed: string[],
 *   removedColumns: string[],
 *   renamedColumns: Record<string, string>,
 *   merged: Record<string, string[]>,
 *   reordered: boolean,
 * }} StepDiff
 * @typedef {{
 *   label: 'FROM' | 'WHERE' | 'SELECT' | 'DISTINCT' | 'ORDER BY' | 'LIMIT',
 *   range: [number, number],
 *   columns: string[],
 *   rows: StepRow[],
 *   rowCountBefore: number | null,
 *   diff: StepDiff,
 * }} Step
 * @typedef {{ ok: true, steps: Step[] } | { ok: false, reason: 'unsupported' | 'error' | 'mismatch', message: string }} BuildResult
 */

const RID = '__rid';
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
/** 括弧の外にあると、ClauseSplitter の句の範囲に混ざってしまう語（LIMIT 句の中の OFFSET は扱える） */
const UNSUPPORTED_WORDS = new Set([
  'OFFSET',
  'FETCH',
  'FOR',
  'WINDOW',
  'UNION',
  'INTERSECT',
  'EXCEPT',
]);

class StepError extends Error {
  /** @param {'unsupported' | 'error' | 'mismatch'} reason @param {string} message */
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

/** @returns {StepDiff} */
const emptyDiff = () => ({
  removed: [],
  removedColumns: [],
  renamedColumns: {},
  merged: {},
  reordered: false,
});

const isMeaningful = (t) => t.type !== 'space' && t.type !== 'comment';
const key = (values) => JSON.stringify(values);

/**
 * FROM 句が「テーブル名1つ（別名可）」か。JOIN・カンマ・サブクエリは対応しない。
 * @param {string} fromText
 */
function isSingleTable(fromText) {
  const tokens = tokenize(fromText).filter(isMeaningful).slice(1); // 先頭の FROM を除く
  const words = tokens.map((t) => (t.type === 'word' ? t.text.toUpperCase() : null));
  if (tokens.length === 0 || tokens.some((t) => t.type !== 'word')) return false;
  if (words.includes('JOIN')) return false;
  // products / products p / products AS p
  return (
    tokens.length === 1 ||
    (tokens.length === 2 && words[1] !== 'AS') ||
    (tokens.length === 3 && words[1] === 'AS')
  );
}

/** SELECT の項目に集計関数・ウィンドウ関数があるか */
function hasAggregate(selectText) {
  const tokens = tokenize(selectText).filter(isMeaningful);
  return tokens.some(
    (t, i) =>
      t.type === 'word' &&
      ((AGGREGATES.has(t.text.toUpperCase()) && tokens[i + 1]?.text === '(') ||
        t.text.toUpperCase() === 'OVER'),
  );
}

/**
 * 括弧の外に、句の範囲に混ざってしまう語（OFFSET・FETCH・FOR など）があるか。LIMIT 句の中の OFFSET は除く。
 * @param {string} sql
 * @param {{ start: number, end: number } | undefined} limitClause
 * @returns {string | null} 見つかった語
 */
function strayWord(sql, limitClause) {
  let depth = 0;
  for (const token of tokenize(sql)) {
    if (token.type === 'symbol' && token.text === '(') depth += 1;
    if (token.type === 'symbol' && token.text === ')') depth = Math.max(0, depth - 1);
    if (depth > 0 || token.type !== 'word') continue;
    const word = token.text.toUpperCase();
    if (!UNSUPPORTED_WORDS.has(word)) continue;
    const insideLimit =
      limitClause && token.start >= limitClause.start && token.end <= limitClause.end;
    if (!(word === 'OFFSET' && insideLimit)) return word;
  }
  return null;
}

/**
 * 元のSQLを実行する。エラーは学習者のSQLの間違いなので error（PostgreSQL のメッセージ付き）。
 * @param {Runner} runner
 * @param {string} sql
 */
async function runOriginal(runner, sql) {
  const outcome = await runner.run(sql);
  if (!outcome.ok && 'timeout' in outcome) {
    throw new StepError('error', 'SQLが時間内に終わりませんでした');
  }
  if (!outcome.ok) throw new StepError('error', `${outcome.error.code} ${outcome.error.message}`);
  return outcome.result;
}

/**
 * 段階のSQLを実行する。元のSQLは成功しているので、ここでの失敗は「学習者が書いていないSQL」の失敗。
 * PostgreSQL のメッセージは見せず unsupported にする。
 * @param {Runner} runner
 * @param {string} sql
 */
async function runStage(runner, sql) {
  const outcome = await runner.run(sql);
  if (!outcome.ok) {
    throw new StepError('unsupported', 'この書き方の段階の表は、まだ作れません');
  }
  return outcome.result;
}

/** `__rid`（末尾に足した行の目印）を列から外し、行の目印として持つ */
function toStepRows(result) {
  const ridIndex = result.columns.lastIndexOf(RID);
  return {
    columns: result.columns.filter((_, i) => i !== ridIndex),
    rows: result.rows.map((row) => ({
      rid: String(row[ridIndex]),
      values: row.filter((_, i) => i !== ridIndex),
    })),
  };
}

/** 前の段階にあって今の段階にない行の目印 */
function removedRids(previous, current) {
  const kept = new Set(current.map((r) => r.rid));
  return previous.filter((r) => !kept.has(r.rid)).map((r) => r.rid);
}

/** 値の並びから、前の段階の行（同じ値の行）を順に割り当てる（DISTINCT のあとは値が重ならない） */
function matchByValues(sourceRows, valueRows) {
  const pool = new Map();
  for (const row of sourceRows) {
    const k = key(row.values);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(row);
  }
  return valueRows.map((values) => {
    const candidates = pool.get(key(values));
    if (!candidates || candidates.length === 0) {
      throw new StepError('mismatch', '段階の表を前の段階の行に対応づけられませんでした');
    }
    return candidates.shift();
  });
}

/**
 * SELECT の段階で、消えた列と名前の変わった列を、項目の「元の列」から決める（結果の列名との一致では決めない）。
 * - 元の列は FROM の段階に実在するものだけ（TRUE・CURRENT_DATE などを列と取り違えない）
 * - 名前を付けない引用符なしの名前は PostgreSQL が小文字にするので、小文字で比べる
 * - 同じ列を2回以上使っているときは、名前の変わった表示をしない（どれか1つに決められないため）
 * @param {string[]} fromColumns
 * @param {import('./select-list.js').SelectItem[]} items
 */
function selectColumnChanges(fromColumns, items) {
  const existing = new Set(fromColumns);
  if (items.some((item) => /(^|\.)\*$/.test(item.text))) {
    return { removedColumns: [], renamedColumns: {} };
  }
  const used = new Map();
  for (const item of items) {
    const source = item.sourceColumn?.toLowerCase();
    if (!source || !existing.has(source)) continue;
    used.set(source, [...(used.get(source) ?? []), item]);
  }
  /** @type {Record<string, string>} */
  const renamedColumns = {};
  for (const [source, uses] of used) {
    const alias = uses[0].alias?.toLowerCase();
    if (uses.length === 1 && alias && alias !== source) renamedColumns[source] = alias;
  }
  return {
    removedColumns: fromColumns.filter((column) => !used.has(column)),
    renamedColumns,
  };
}

/**
 * @param {string} sql
 * @param {Runner} runner - SqlRunner（初期状態にしてあること）
 * @returns {Promise<BuildResult>}
 */
export async function buildSteps(sql, runner) {
  try {
    return { ok: true, steps: await build(sql, runner) };
  } catch (error) {
    if (error instanceof StepError)
      return { ok: false, reason: error.reason, message: error.message };
    throw error;
  }
}

/**
 * @param {string} sql
 * @param {Runner} runner
 * @returns {Promise<Step[]>}
 */
async function build(sql, runner) {
  const { ok, clauses } = splitClauses(sql);
  if (!ok) throw new StepError('unsupported', 'SELECT の句に分けられないSQLです');
  // SELECT ... INTO（表を作る）は、元のSQLを実行するだけでDBが変わるので扱わない
  if (!canRunWhileTyping(sql)) throw new StepError('unsupported', 'SELECT ... INTO は扱えません');
  const byKind = Object.fromEntries(clauses.map((c) => [c.kind, c]));
  const text = (kind) => (byKind[kind] ? sql.slice(byKind[kind].start, byKind[kind].end) : '');
  const range = (kind) => /** @type {[number, number]} */ ([byKind[kind].start, byKind[kind].end]);

  if (!byKind.FROM) throw new StepError('unsupported', 'FROM のないSQLです');
  if (byKind['GROUP BY'] || byKind.HAVING) {
    throw new StepError('unsupported', 'GROUP BY のステップ再生はまだありません');
  }
  const stray = strayWord(sql, byKind.LIMIT);
  if (stray) {
    throw new StepError('unsupported', `${stray} を使うSQLのステップ再生はまだありません`);
  }
  if (!isSingleTable(text('FROM'))) {
    throw new StepError(
      'unsupported',
      '2つ以上のテーブル・サブクエリのステップ再生はまだありません',
    );
  }
  if (hasAggregate(text('SELECT'))) {
    throw new StepError('unsupported', '集計関数のステップ再生はまだありません');
  }
  const { distinct, unsupportedModifier, items } = splitSelectList(text('SELECT'));
  if (unsupportedModifier) {
    throw new StepError(
      'unsupported',
      `SELECT ${unsupportedModifier} のステップ再生はまだありません`,
    );
  }

  // 元のSQLの結果（最後の段階と比べる）。学習者のSQLの間違いはここで error になる
  const original = await runOriginal(runner, sql);

  // 行の目印は末尾に足す（先頭に足すと ORDER BY 2 のような列番号がずれる）
  const list = items.map((item) => item.text).join(', ');
  const from = text('FROM');
  const where = text('WHERE');
  const order = text('ORDER BY');

  /** @type {Step[]} */
  const steps = [];
  const push = (label, rangeOf, table, diff) => {
    const previous = steps.at(-1);
    steps.push({
      label,
      range: rangeOf,
      columns: table.columns,
      rows: table.rows,
      rowCountBefore: previous ? previous.rows.length : null,
      diff: { ...emptyDiff(), ...diff },
    });
    return steps.at(-1);
  };

  // FROM：テーブルの全行
  const fromStep = push(
    'FROM',
    range('FROM'),
    toStepRows(await runStage(runner, `SELECT *, ctid::text AS ${RID} ${from}`)),
    {},
  );

  // WHERE：条件に合わない行が消える
  if (where) {
    const table = toStepRows(
      await runStage(runner, `SELECT *, ctid::text AS ${RID} ${from} ${where}`),
    );
    push('WHERE', range('WHERE'), table, { removed: removedRids(steps.at(-1).rows, table.rows) });
  }

  // SELECT：使わない列が消え、AS で名前が変わる
  {
    const table = toStepRows(
      await runStage(runner, `SELECT ${list}, ctid::text AS ${RID} ${from} ${where}`),
    );
    push('SELECT', range('SELECT'), table, selectColumnChanges(fromStep.columns, items));
  }

  // DISTINCT：同じ値の行が1つにまとまる（最初の行が残る）
  if (distinct) {
    const previous = steps.at(-1);
    /** @type {Map<string, StepRow>} */
    const firstByValues = new Map();
    /** @type {Record<string, string[]>} */
    const merged = {};
    for (const row of previous.rows) {
      const k = key(row.values);
      const first = firstByValues.get(k);
      if (first) (merged[first.rid] ??= []).push(row.rid);
      else firstByValues.set(k, row);
    }
    push(
      'DISTINCT',
      range('SELECT'),
      { columns: previous.columns, rows: [...firstByValues.values()] },
      { merged },
    );
  }

  // ORDER BY：行が並び替わる
  if (byKind['ORDER BY']) {
    const previous = steps.at(-1);
    let rows;
    if (distinct) {
      // DISTINCT のあとは行の目印を SELECT に入れられないので、値で前の段階の行に対応づける
      const result = await runStage(runner, `SELECT DISTINCT ${list} ${from} ${where} ${order}`);
      rows = matchByValues(previous.rows, result.rows);
    } else {
      rows = toStepRows(
        await runStage(runner, `SELECT ${list}, ctid::text AS ${RID} ${from} ${where} ${order}`),
      ).rows;
    }
    const reordered = rows.some((row, i) => row.rid !== previous.rows[i]?.rid);
    push('ORDER BY', range('ORDER BY'), { columns: previous.columns, rows }, { reordered });
  }

  // LIMIT（OFFSET）：残る行
  if (byKind.LIMIT) {
    const previous = steps.at(-1);
    let rows;
    if (distinct) {
      // DISTINCT のあとは値が重ならないので、元のSQLの結果の値で行を決められる
      rows = matchByValues(previous.rows, original.rows);
    } else {
      // 元の ORDER BY と LIMIT をそのまま使い、行の目印つきで実行する（同じ値の行を取り違えない）
      const limited = toStepRows(
        await runStage(
          runner,
          `SELECT ${list}, ctid::text AS ${RID} ${from} ${where} ${order} ${text('LIMIT')}`,
        ),
      ).rows;
      const byRid = new Map(previous.rows.map((row) => [row.rid, row]));
      rows = limited.map((row) => byRid.get(row.rid));
      if (rows.some((row) => !row)) {
        throw new StepError('mismatch', 'LIMIT の段階を前の段階の行に対応づけられませんでした');
      }
    }
    // 残る行は、ORDER BY の段階の並びのまま連続していること（同じ値の行の並びが違うと、見た目がうそになる）
    const start = previous.rows.findIndex((row) => row.rid === rows[0]?.rid);
    const contiguous =
      rows.length === 0 || rows.every((row, i) => previous.rows[start + i]?.rid === row.rid);
    if (!contiguous) {
      throw new StepError('mismatch', 'LIMIT で残る行が、並べた表の中で続いていません');
    }
    push(
      'LIMIT',
      range('LIMIT'),
      { columns: previous.columns, rows },
      {
        removed: removedRids(previous.rows, rows),
      },
    );
  }

  // 最後の段階が元のSQLの結果と一致するか（ORDER BY がなければ並びは比べない）
  const last = steps.at(-1);
  const lastKeys = last.rows.map((r) => key(r.values));
  const originalKeys = original.rows.map(key);
  const sameOrder = byKind['ORDER BY'] || byKind.LIMIT;
  const equal =
    key(last.columns) === key(original.columns) &&
    (sameOrder
      ? key(lastKeys) === key(originalKeys)
      : key([...lastKeys].sort()) === key([...originalKeys].sort()));
  if (!equal)
    throw new StepError('mismatch', 'ステップ再生の最後の表が、実行結果と一致しませんでした');
  return steps;
}
