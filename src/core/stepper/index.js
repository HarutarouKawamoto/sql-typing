import { canRunWhileTyping, splitClauses } from '../clause-splitter.js';
import { tokenize } from '../sql-text.js';
import { hasAggregate, hasWindow } from './aggregates.js';
import { parseFrom } from './from-clause.js';
import { resolveGroupItems, splitGroupBy } from './group-by.js';
import { splitSelectList } from './select-list.js';

/**
 * 見える化A（ステップ再生）の段階を作る。
 * SQLを実行順（FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT）の段階に分け、
 * 各段階の表を「本物のSQL」として PostgreSQL で実行して作る。行は ctid（行の目印）で前の段階とつなぐ。
 * 段階のSQLは、ClauseSplitter の句の範囲で元のSQLの文字をそのまま切り貼りして作る（構文木は使わない）。
 * 間違った見える化を見せないため、対応しない形は先に unsupported にし、最後の段階が元のSQLの結果と
 * 一致しなければ mismatch にする。
 * 集計（GROUP BY・HAVING・集計関数）は、各行のグループの鍵（ROW(GROUP BY の項目)::text）で前の段階の行とつなぐ。
 * JOIN は FROM（最初のテーブル）のあとに1つずつ段階にする。JOIN のあとの行の目印は、つないだテーブルの ctid を + でつないだもの。
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
 *   removedColumnIndexes: number[],
 *   renamedColumns: Record<string, string>,
 *   merged: Record<string, string[]>,
 *   reordered: boolean,
 *   groups: Record<string, number>,
 *   aggregated: boolean,
 *   join: JoinDiff | null,
 * }} StepDiff
 * @typedef {{
 *   kind: 'INNER' | 'LEFT',
 *   table: string,
 *   alias: string | null,
 *   columns: string[],
 *   rows: StepRow[],
 *   pairs: Record<string, string[]>,
 * }} JoinDiff
 *   JOIN の段階だけ。table・alias は右のテーブルの名前と別名、rows は右の表の行（目印はその ctid）、
 *   pairs は左の行（前の段階の目印）ごとの、つながる右の行の目印（LEFT で相手がなければ []）
 *   groups：GROUP BY・HAVING の段階で、各行（目印）のグループの番号（最初に出てきた順。色分けのため）
 *   aggregated：集計した SELECT の段階か（まとまる行がなくても、段階の一言を「集計」にするため）
 * @typedef {{
 *   label: 'FROM' | 'JOIN' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'SELECT' | 'DISTINCT' | 'ORDER BY' | 'LIMIT',
 *   range: [number, number],
 *   columns: string[],
 *   rows: StepRow[],
 *   rowCountBefore: number | null,
 *   diff: StepDiff,
 * }} Step
 * @typedef {{ ok: true, steps: Step[] } | { ok: false, reason: 'unsupported' | 'error' | 'mismatch', message: string }} BuildResult
 */

const RID = '__rid';
/** 段階のSQLに足す、行のグループの鍵の列 */
const GRP = '__grp';
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
  removedColumnIndexes: [],
  renamedColumns: {},
  merged: {},
  reordered: false,
  groups: {},
  aggregated: false,
  join: null,
});

const key = (values) => JSON.stringify(values);

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
 * 列は位置で見分ける（JOIN のあとは orders.id と customers.id のように同じ名前の列があるため）。
 * - 元の列は、前の段階の表に実在するものだけ（TRUE・CURRENT_DATE などを列と取り違えない）
 * - `o.id` のようにテーブルを書いた項目は、そのテーブルの列。書いていなければ、同じ名前の列が1つのときだけ
 * - `*` があればどの列も消えない。`o.*` はそのテーブルの列を全部使う
 * - 名前を付けない引用符なしの名前は PostgreSQL が小文字にするので、小文字で比べる
 * - 同じ名前の列を2回以上使っているときは、名前の変わった表示をしない（どれか1つに決められないため）
 * @param {{ table: string, name: string }[]} owners - 前の段階の列ごとの、テーブル（別名、なければ名前）と列名
 * @param {import('./select-list.js').SelectItem[]} items
 */
function selectColumnChanges(owners, items) {
  if (items.some((item) => item.text.trim() === '*')) {
    return { removedColumns: [], removedColumnIndexes: [], renamedColumns: {} };
  }
  /** @type {Map<number, import('./select-list.js').SelectItem[]>} 列の位置 → その列を使う項目 */
  const used = new Map();
  const markUsed = (index, item) => used.set(index, [...(used.get(index) ?? []), item]);
  for (const item of items) {
    const star = /^([A-Za-z_][A-Za-z0-9_]*)\.\*$/.exec(item.text.trim());
    if (star) {
      owners.forEach((owner, index) => {
        if (owner.table === star[1].toLowerCase()) markUsed(index, item);
      });
      continue;
    }
    const source = item.sourceColumn?.toLowerCase();
    if (!source) continue;
    const candidates = owners
      .map((owner, index) => ({ owner, index }))
      .filter(
        ({ owner }) =>
          owner.name === source && (!item.sourceTable || owner.table === item.sourceTable),
      );
    if (candidates.length === 1) markUsed(candidates[0].index, item);
  }
  const removedColumnIndexes = owners.map((_, index) => index).filter((index) => !used.has(index));

  /** @type {Record<string, string>} */
  const renamedColumns = {};
  const usedNames = [...used.keys()].map((index) => owners[index].name);
  for (const [index, uses] of used) {
    const name = owners[index].name;
    const alias = uses[0].alias?.toLowerCase();
    const onlyOnce = uses.length === 1 && usedNames.filter((n) => n === name).length === 1;
    if (onlyOnce && alias && alias !== name) renamedColumns[name] = alias;
  }
  return {
    removedColumns: removedColumnIndexes.map((index) => owners[index].name),
    removedColumnIndexes,
    renamedColumns,
  };
}

/**
 * LIMIT 句の数（`LIMIT 5`・`LIMIT 3 OFFSET 2`・`LIMIT ALL`）。式などで読めなければ null。
 * @param {string} limitText
 * @returns {{ limit: number | null, offset: number } | null}
 */
function readLimit(limitText) {
  const match = /^LIMIT\s+(\d+|ALL)(?:\s+OFFSET\s+(\d+))?\s*;?$/i.exec(limitText.trim());
  if (!match) return null;
  return {
    limit: match[1].toUpperCase() === 'ALL' ? null : Number(match[1]),
    offset: match[2] ? Number(match[2]) : 0,
  };
}

/**
 * 並べたあとの LIMIT：ORDER BY の段階の並びをそのまま切る（同じ並びの値の行があっても、段階どうしで並びがずれない）。
 * 切った行が元のSQLの結果と同じ値かは、最後の一致の確かめで見る。
 * @param {StepRow[]} orderedRows
 * @param {{ limit: number | null, offset: number }} limit
 */
function sliceLimit(orderedRows, { limit, offset }) {
  return orderedRows.slice(offset, limit === null ? undefined : offset + limit);
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
  const stray = strayWord(sql, byKind.LIMIT);
  if (stray) {
    throw new StepError('unsupported', `${stray} を使うSQLのステップ再生はまだありません`);
  }
  const parsedFrom = parseFrom(text('FROM'));
  if ('unsupported' in parsedFrom) throw new StepError('unsupported', parsedFrom.unsupported);
  if (hasWindow(sql)) {
    throw new StepError('unsupported', 'ウィンドウ関数（OVER）のステップ再生はまだありません');
  }
  const { distinct, unsupportedModifier, items } = splitSelectList(text('SELECT'));
  if (unsupportedModifier) {
    throw new StepError(
      'unsupported',
      `SELECT ${unsupportedModifier} のステップ再生はまだありません`,
    );
  }
  // 集計するか（GROUP BY・HAVING・集計関数のどれかがある）
  const grouped = Boolean(byKind['GROUP BY'] || byKind.HAVING || hasAggregate(text('SELECT')));
  if (grouped && distinct) {
    throw new StepError('unsupported', 'DISTINCT と集計を一緒に使うステップ再生はまだありません');
  }
  const groupItems = byKind['GROUP BY'] ? splitGroupBy(text('GROUP BY')) : { items: [] };
  if ('unsupported' in groupItems) throw new StepError('unsupported', groupItems.unsupported);

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

  // 行の目印の式。JOIN があれば、つないだテーブルの ctid を + でつなぐ（LEFT JOIN の相手のない行は -）
  const refs = [parsedFrom.base.ref, ...parsedFrom.joins.map((j) => j.table.ref)];
  /** @param {number} count - 前から何個のテーブルの目印をつなぐか */
  const ridOf = (count) =>
    parsedFrom.joins.length === 0
      ? 'ctid::text'
      : refs
          .slice(0, count)
          .map((ref, i) => (i === 0 ? `${ref}.ctid::text` : `coalesce(${ref}.ctid::text, '-')`))
          .join(` || '+' || `);
  const ridSql = ridOf(refs.length);

  // FROM：最初のテーブルの全行（JOIN があれば、最初のテーブルの列だけ）
  push(
    'FROM',
    range('FROM'),
    toStepRows(
      await runStage(
        runner,
        parsedFrom.joins.length === 0
          ? `SELECT *, ctid::text AS ${RID} ${from}`
          : `SELECT ${parsedFrom.base.ref}.*, ${ridOf(1)} AS ${RID} ${parsedFrom.base.text}`,
      ),
    ),
    {},
  );

  // JOIN：1つずつ、右のテーブルの行がつながって1行に合体する
  for (const [index, join] of parsedFrom.joins.entries()) {
    await pushJoinStep({
      runner,
      push,
      steps,
      join,
      fromPrefix: from.slice(0, join.end),
      ridSql: ridOf(index + 2),
      range: [byKind.FROM.start + join.start, byKind.FROM.start + join.end],
    });
  }
  // WHERE のあとの段階で「元の列」と比べる表（JOIN があれば合体した表）
  const inputColumns = steps.at(-1).columns;
  // 合体した表の列ごとの、テーブル（別名、なければ名前）と列名（SELECT の o.id がどの列かを位置で決めるため）
  const tableOf = (part) => (part.alias ?? part.name).toLowerCase();
  const owners = [
    ...steps[0].columns.map((name) => ({ table: tableOf(parsedFrom.base), name })),
    ...steps
      .filter((step) => step.label === 'JOIN')
      .flatMap((step, i) =>
        (step.diff.join?.columns ?? []).map((name) => ({
          table: tableOf(parsedFrom.joins[i].table),
          name,
        })),
      ),
  ];
  const limitParts = byKind.LIMIT ? readLimit(text('LIMIT')) : null;

  // WHERE：条件に合わない行が消える
  if (where) {
    const table = toStepRows(
      await runStage(runner, `SELECT *, ${ridSql} AS ${RID} ${from} ${where}`),
    );
    push('WHERE', range('WHERE'), table, { removed: removedRids(steps.at(-1).rows, table.rows) });
  }

  if (grouped) {
    // グループの鍵の式（GROUP BY がなければ全部の行が1つのグループ）。列の番号・SELECT の別名は式に置き換える
    const resolved = resolveGroupItems(groupItems.items, items, inputColumns);
    if ('unsupported' in resolved) throw new StepError('unsupported', resolved.unsupported);
    const groupKeySql =
      resolved.items.length > 0 ? `ROW(${resolved.items.join(', ')})::text` : `'all'`;
    await pushGroupedSteps({
      runner,
      push,
      steps,
      range,
      byKind,
      parts: {
        list,
        from,
        where,
        groupTail: `${text('GROUP BY')} ${text('HAVING')}`,
        order,
        limit: text('LIMIT'),
        limitParts: byKind['ORDER BY'] ? limitParts : null,
        groupKeySql,
        ridSql,
      },
    });
    return checkLast(steps, original, Boolean(byKind['ORDER BY'] || byKind.LIMIT));
  }

  // SELECT：使わない列が消え、AS で名前が変わる
  {
    const table = toStepRows(
      await runStage(runner, `SELECT ${list}, ${ridSql} AS ${RID} ${from} ${where}`),
    );
    push('SELECT', range('SELECT'), table, selectColumnChanges(owners, items));
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
        await runStage(runner, `SELECT ${list}, ${ridSql} AS ${RID} ${from} ${where} ${order}`),
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
    } else if (byKind['ORDER BY'] && limitParts) {
      rows = sliceLimit(previous.rows, limitParts);
    } else {
      // 元の ORDER BY と LIMIT をそのまま使い、行の目印つきで実行する（同じ値の行を取り違えない）
      const limited = toStepRows(
        await runStage(
          runner,
          `SELECT ${list}, ${ridSql} AS ${RID} ${from} ${where} ${order} ${text('LIMIT')}`,
        ),
      ).rows;
      const byRid = new Map(previous.rows.map((row) => [row.rid, row]));
      rows = limited.map((row) => byRid.get(row.rid));
      if (rows.some((row) => !row)) {
        throw new StepError('mismatch', 'LIMIT の段階を前の段階の行に対応づけられませんでした');
      }
    }
    assertContiguous(previous.rows, rows);
    push(
      'LIMIT',
      range('LIMIT'),
      { columns: previous.columns, rows },
      {
        removed: removedRids(previous.rows, rows),
      },
    );
  }

  return checkLast(steps, original, Boolean(byKind['ORDER BY'] || byKind.LIMIT));
}

/**
 * LIMIT で残る行は、ORDER BY の段階の並びのまま連続していること（同じ値の行の並びが違うと、見た目がうそになる）。
 * @param {StepRow[]} previousRows
 * @param {StepRow[]} rows
 */
function assertContiguous(previousRows, rows) {
  const start = previousRows.findIndex((row) => row.rid === rows[0]?.rid);
  const contiguous =
    rows.length === 0 || rows.every((row, i) => previousRows[start + i]?.rid === row.rid);
  if (!contiguous) {
    throw new StepError('mismatch', 'LIMIT で残る行が、並べた表の中で続いていません');
  }
}

/**
 * 最後の段階が元のSQLの結果と一致するか（並べていなければ並びは比べない）。一致しなければ mismatch。
 * @param {Step[]} steps
 * @param {QueryTable} original
 * @param {boolean} sameOrder
 * @returns {Step[]}
 */
function checkLast(steps, original, sameOrder) {
  const last = steps.at(-1);
  const lastKeys = last.rows.map((r) => key(r.values));
  const originalKeys = original.rows.map(key);
  const equal =
    key(last.columns) === key(original.columns) &&
    (sameOrder
      ? key(lastKeys) === key(originalKeys)
      : key([...lastKeys].sort()) === key([...originalKeys].sort()));
  if (!equal)
    throw new StepError('mismatch', 'ステップ再生の最後の表が、実行結果と一致しませんでした');
  return steps;
}

/**
 * @typedef {{
 *   runner: Runner,
 *   push: (label: Step['label'], range: [number, number], table: { columns: string[], rows: StepRow[] }, diff: Partial<StepDiff>) => Step,
 *   steps: Step[],
 *   range: (kind: string) => [number, number],
 *   byKind: Record<string, { start: number, end: number }>,
 *   parts: { list: string, from: string, where: string, groupTail: string, order: string, limit: string, limitParts: { limit: number | null, offset: number } | null, groupKeySql: string, ridSql: string },
 * }} GroupContext
 */

/**
 * 集計するSQLの、WHERE のあとの段階（GROUP BY → HAVING → SELECT → ORDER BY → LIMIT）。
 * 各行のグループの鍵（groupKeySql）で、集計のあとの行を「そのグループの最初の行」の目印につなぐ。
 * @param {GroupContext} context
 */
async function pushGroupedSteps(context) {
  const groups = await readGroups(context);
  if (context.byKind['GROUP BY']) pushGroupStep(context, groups);
  if (context.byKind.HAVING) await pushHavingStep(context, groups);
  await pushAggregateSteps(context, groups);
}

/**
 * 各行のグループの鍵と、グループの番号（前の段階の並びで最初に出てきた順）。
 * @param {GroupContext} context
 */
async function readGroups({ runner, steps, parts }) {
  const { from, where, groupKeySql, ridSql } = parts;
  /** @type {Map<string, string>} 行の目印 → グループの鍵 */
  const keyOfRid = new Map();
  const result = await runStage(
    runner,
    `SELECT *, ${ridSql} AS ${RID}, ${groupKeySql} AS ${GRP} ${from} ${where}`,
  );
  const ridIndex = result.columns.lastIndexOf(RID);
  const grpIndex = result.columns.lastIndexOf(GRP);
  for (const row of result.rows) keyOfRid.set(String(row[ridIndex]), String(row[grpIndex]));

  /** @type {Map<string, number>} グループの鍵 → 番号 */
  const indexOfKey = new Map();
  for (const row of steps.at(-1).rows) {
    const rowKey = keyOfRid.get(row.rid);
    if (rowKey === undefined) {
      throw new StepError('mismatch', 'GROUP BY の段階を前の段階の行に対応づけられませんでした');
    }
    if (!indexOfKey.has(rowKey)) indexOfKey.set(rowKey, indexOfKey.size);
  }
  const indexOf = (rid) => /** @type {number} */ (indexOfKey.get(keyOfRid.get(rid)));
  return {
    keyOfRid,
    indexOfKey,
    indexOf,
    /** @param {StepRow[]} rows */
    groupsOf: (rows) => Object.fromEntries(rows.map((row) => [row.rid, indexOf(row.rid)])),
  };
}

/**
 * GROUP BY：同じグループの行が寄る（グループの中は元の並びのまま。sort は安定）。
 * @param {GroupContext} context
 * @param {Awaited<ReturnType<typeof readGroups>>} groups
 */
function pushGroupStep({ push, steps, range }, { indexOf, groupsOf }) {
  const previous = steps.at(-1);
  const rows = [...previous.rows].sort((a, b) => indexOf(a.rid) - indexOf(b.rid));
  const reordered = rows.some((row, i) => row.rid !== previous.rows[i].rid);
  push(
    'GROUP BY',
    range('GROUP BY'),
    { columns: previous.columns, rows },
    { groups: groupsOf(rows), reordered },
  );
}

/**
 * HAVING：条件に合わないグループの行がすべて消える。
 * @param {GroupContext} context
 * @param {Awaited<ReturnType<typeof readGroups>>} groups
 */
async function pushHavingStep({ runner, push, steps, range, parts }, { keyOfRid, groupsOf }) {
  const { from, where, groupTail, groupKeySql } = parts;
  const result = await runStage(
    runner,
    `SELECT ${groupKeySql} AS ${GRP} ${from} ${where} ${groupTail}`,
  );
  const kept = new Set(result.rows.map((row) => String(row[0])));
  const previous = steps.at(-1);
  const rows = previous.rows.filter((row) => kept.has(String(keyOfRid.get(row.rid))));
  push(
    'HAVING',
    range('HAVING'),
    { columns: previous.columns, rows },
    { removed: removedRids(previous.rows, rows), groups: groupsOf(previous.rows) },
  );
}

/**
 * SELECT（集計）・ORDER BY・LIMIT。集計のあとの行は、グループの鍵でグループの最初の行の目印につなぐ。
 * @param {GroupContext} context
 * @param {Awaited<ReturnType<typeof readGroups>>} groups
 */
async function pushAggregateSteps(context, { keyOfRid, indexOfKey }) {
  const { runner, push, steps, range, byKind, parts } = context;
  const { list, from, where, groupTail, order, limit, limitParts, groupKeySql } = parts;
  const grouped = Boolean(byKind['GROUP BY']);

  /** @type {Map<string, string[]>} グループの鍵 → そのグループの行の目印（前の段階の並び） */
  const membersOf = new Map();
  for (const row of steps.at(-1).rows) {
    const rowKey = String(keyOfRid.get(row.rid));
    if (!membersOf.has(rowKey)) membersOf.set(rowKey, []);
    membersOf.get(rowKey)?.push(row.rid);
  }
  /**
   * @param {string} tail - 段階のSQLの後ろに足す句（ORDER BY・LIMIT）
   * @param {boolean} limited - LIMIT があるか（あればグループの数より少なくてよい）
   */
  const runGrouped = async (tail, limited) => {
    const result = await runStage(
      runner,
      `SELECT ${list}, ${groupKeySql} AS ${GRP} ${from} ${where} ${groupTail} ${tail}`,
    );
    const grpIndex = result.columns.lastIndexOf(GRP);
    const rows = result.rows.map((row) => {
      const rowKey = String(row[grpIndex]);
      return {
        // 前の段階に行がないグループ（0行の集計）は group:<鍵>
        rid: membersOf.get(rowKey)?.[0] ?? `group:${rowKey}`,
        rowKey,
        values: row.filter((_, i) => i !== grpIndex),
      };
    });
    assertOneRowPerGroup(rows, membersOf, grouped, limited);
    return { columns: result.columns.filter((_, i) => i !== grpIndex), rows };
  };
  const strip = (rows) => rows.map(({ rid, values }) => ({ rid, values }));

  // SELECT：1グループが1行にまとまる。並びはグループの番号の順（前の段階から行が動かないように）
  {
    const table = await runGrouped('', false);
    const position = (row) => indexOfKey.get(row.rowKey) ?? indexOfKey.size;
    const rows = [...table.rows].sort((a, b) => position(a) - position(b));
    /** @type {Record<string, string[]>} */
    const merged = {};
    for (const row of rows) {
      const members = membersOf.get(row.rowKey) ?? [];
      if (members.length > 1) merged[row.rid] = members.slice(1);
    }
    push(
      'SELECT',
      range('SELECT'),
      { columns: table.columns, rows: strip(rows) },
      { merged, aggregated: true },
    );
  }

  // ORDER BY：まとまった行が並び替わる
  if (byKind['ORDER BY']) {
    const previous = steps.at(-1);
    const rows = strip((await runGrouped(order, false)).rows);
    const reordered = rows.some((row, i) => row.rid !== previous.rows[i]?.rid);
    push('ORDER BY', range('ORDER BY'), { columns: previous.columns, rows }, { reordered });
  }

  // LIMIT：残る行
  if (byKind.LIMIT) {
    const previous = steps.at(-1);
    const rows = limitParts
      ? sliceLimit(previous.rows, limitParts)
      : strip((await runGrouped(`${order} ${limit}`, true)).rows);
    assertContiguous(previous.rows, rows);
    push(
      'LIMIT',
      range('LIMIT'),
      { columns: previous.columns, rows },
      { removed: removedRids(previous.rows, rows) },
    );
  }
}

/**
 * 集計のあとの行が、グループごとに1行ずつか（最後の守り）。グループの鍵の文字と本物のグループ分けがずれる
 * （`1.0` と `1.00` は同じグループなのに鍵の文字が違う）と、途中の段階がうそになるので mismatch にする。
 * @param {{ rid: string, rowKey: string }[]} rows
 * @param {Map<string, string[]>} membersOf
 * @param {boolean} grouped - GROUP BY があるか（なければ全部で1グループ。0行でも集計は1行）
 * @param {boolean} limited - LIMIT があるか（あればグループの数より少なくてよい）
 */
function assertOneRowPerGroup(rows, membersOf, grouped, limited) {
  const unique = (values) => new Set(values).size === values.length;
  let countOk;
  if (grouped) countOk = limited ? rows.length <= membersOf.size : rows.length === membersOf.size;
  else countOk = rows.length <= 1 && (limited || membersOf.size === 0 || rows.length === 1);
  if (!unique(rows.map((r) => r.rowKey)) || !unique(rows.map((r) => r.rid)) || !countOk) {
    throw new StepError('mismatch', '集計した行を、グループに1つずつ対応づけられませんでした');
  }
}

/**
 * JOIN の段階。前の段階の行（左）に右のテーブルの行がつながって合体する。
 * 合体した行の目印は「左の目印+右の ctid」（相手のない LEFT JOIN の行は「左の目印+-」）なので、最後の + で分けて対応を作る。
 * @param {{
 *   runner: Runner,
 *   push: (label: Step['label'], range: [number, number], table: { columns: string[], rows: StepRow[] }, diff: Partial<StepDiff>) => Step,
 *   steps: Step[],
 *   join: import('./from-clause.js').JoinPart,
 *   fromPrefix: string,
 *   ridSql: string,
 *   range: [number, number],
 * }} context
 */
async function pushJoinStep({ runner, push, steps, join, fromPrefix, ridSql, range }) {
  const previous = steps.at(-1);
  const joined = toStepRows(await runStage(runner, `SELECT *, ${ridSql} AS ${RID} ${fromPrefix}`));
  const right = toStepRows(
    await runStage(
      runner,
      `SELECT *, ctid::text AS ${RID} FROM "${join.table.name.replaceAll('"', '""')}"`,
    ),
  );

  /** @type {Record<string, string[]>} */
  const pairs = Object.fromEntries(previous.rows.map((row) => [row.rid, []]));
  const rightOrder = new Map(right.rows.map((row, i) => [row.rid, i]));
  const split = (rid) => {
    const at = rid.lastIndexOf('+');
    return { left: rid.slice(0, at), right: rid.slice(at + 1) };
  };
  for (const row of joined.rows) {
    const { left, right: rightRid } = split(row.rid);
    if (!(left in pairs)) {
      throw new StepError('mismatch', 'JOIN の段階を前の段階の行に対応づけられませんでした');
    }
    if (rightRid !== '-') pairs[left].push(rightRid);
  }
  // 合体した行は、左の行の並び → 右の表の並びの順にする（前の段階から行が大きく動かないように）
  const leftOrder = new Map(previous.rows.map((row, i) => [row.rid, i]));
  const position = (rid) => {
    const { left, right: rightRid } = split(rid);
    return [leftOrder.get(left) ?? 0, rightOrder.get(rightRid) ?? -1];
  };
  const rows = [...joined.rows].sort((a, b) => {
    const [la, ra] = position(a.rid);
    const [lb, rb] = position(b.rid);
    return la - lb || ra - rb;
  });
  for (const rights of Object.values(pairs)) {
    rights.sort((a, b) => (rightOrder.get(a) ?? 0) - (rightOrder.get(b) ?? 0));
  }
  const kept = new Set(joined.rows.map((row) => split(row.rid).left));
  push(
    'JOIN',
    range,
    { columns: joined.columns, rows },
    {
      removed: previous.rows.filter((row) => !kept.has(row.rid)).map((row) => row.rid),
      join: {
        kind: join.kind,
        table: join.table.name,
        alias: join.table.alias,
        columns: right.columns,
        rows: right.rows,
        pairs,
      },
    },
  );
}
