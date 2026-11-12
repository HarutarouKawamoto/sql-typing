/**
 * 実行計画（EXPLAIN (ANALYZE, FORMAT JSON)）を読む。上級の見える化（インデックスの比較・実行計画の木）で使う。
 * 元：docs/functional-design.md の Explain
 */

/**
 * @typedef {{
 *   nodeType: string,
 *   relation: string | null,
 *   alias: string | null,
 *   index: string | null,
 *   rows: number,
 *   removed: number,
 *   loops: number,
 *   totalMs: number,
 *   children: PlanNode[],
 * }} PlanNode
 *   rows：この節が返した行（Actual Rows × Actual Loops）。removed：条件で取り除いた行（× loops）
 * @typedef {{ plan: PlanNode, executionMs: number, planningMs: number }} ParsedExplain
 * @typedef {ParsedExplain & { rowsRead: number, scans: { nodeType: string, relation: string | null, index: string | null }[] }} ExplainSummary
 * @typedef {{ ok: true, result: { rows: unknown[][] } } | { ok: false, error: { code: string, message: string } } | { ok: false, timeout: true }} RunOutcome
 * @typedef {{ run: (sql: string) => Promise<RunOutcome>, reset: () => Promise<void> }} Runner
 */

/** テーブルの行を読む節。Bitmap Index Scan は索引だけを見る（行は Bitmap Heap Scan が読む）ので入れない */
const TABLE_SCANS = new Set([
  'Seq Scan',
  'Index Scan',
  'Index Only Scan',
  'Bitmap Heap Scan',
  'Tid Scan',
]);

/** @param {unknown} value */
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * @param {Record<string, unknown>} node - EXPLAIN の JSON の Plan
 * @returns {PlanNode}
 */
function toNode(node) {
  // 実行されなかった節は loops 0（行も0になる）。Actual Rows は1回あたりの平均で小数のことがあるので、掛けて丸める
  const loops = num(node['Actual Loops']);
  const removed =
    num(node['Rows Removed by Filter']) +
    num(node['Rows Removed by Index Recheck']) +
    num(node['Rows Removed by Join Filter']);
  // Bitmap Heap Scan は子の Bitmap Index Scan がインデックスを持つ
  const children = Array.isArray(node.Plans)
    ? node.Plans.map((child) => toNode(/** @type {Record<string, unknown>} */ (child)))
    : [];
  const ownIndex = typeof node['Index Name'] === 'string' ? node['Index Name'] : null;
  const childIndex =
    node['Node Type'] === 'Bitmap Heap Scan'
      ? (children.find((c) => c.nodeType === 'Bitmap Index Scan')?.index ?? null)
      : null;
  return {
    nodeType: String(node['Node Type']),
    relation: typeof node['Relation Name'] === 'string' ? node['Relation Name'] : null,
    alias: typeof node.Alias === 'string' ? node.Alias : null,
    index: ownIndex ?? childIndex,
    rows: Math.round(num(node['Actual Rows']) * loops),
    removed: Math.round(removed * loops),
    loops,
    totalMs: num(node['Actual Total Time']),
    children,
  };
}

/**
 * @param {string | unknown[]} raw - EXPLAIN (ANALYZE, FORMAT JSON) の1行1列目（PGlite は JSON の文字列で返す）
 * @returns {ParsedExplain}
 */
export function parseExplain(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const top = Array.isArray(value) ? value[0] : null;
  if (!top || typeof top !== 'object' || !top.Plan) {
    throw new Error('実行計画の形を読めませんでした');
  }
  return {
    plan: toNode(top.Plan),
    executionMs: num(top['Execution Time']),
    planningMs: num(top['Planning Time']),
  };
}

/**
 * @param {PlanNode} plan
 * @returns {PlanNode[]} 木の中の、テーブルの行を読む節（上から順）
 */
function tableScans(plan) {
  const own = TABLE_SCANS.has(plan.nodeType) ? [plan] : [];
  return [...own, ...plan.children.flatMap(tableScans)];
}

/**
 * テーブルから読んだ行の数。読む節ごとに「返した行 + 条件で取り除いた行」を足す（Seq Scan なら全部の行）。
 * @param {PlanNode} plan
 */
export function rowsRead(plan) {
  return tableScans(plan).reduce((sum, node) => sum + node.rows + node.removed, 0);
}

/**
 * 読み方の一覧（どのテーブルを、どの節で、どのインデックスで読んだか）。
 * @param {PlanNode} plan
 */
export function scanKinds(plan) {
  return tableScans(plan).map(({ nodeType, relation, index }) => ({ nodeType, relation, index }));
}

/**
 * @param {Runner} runner
 * @param {string} query
 * @returns {Promise<ExplainSummary | { error: string }>}
 */
async function explain(runner, query) {
  const outcome = await runner.run(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
  if (!outcome.ok) {
    return { error: 'timeout' in outcome ? '時間内に終わりませんでした' : outcome.error.message };
  }
  const parsed = parseExplain(/** @type {string} */ (outcome.result.rows[0]?.[0]));
  return { ...parsed, rowsRead: rowsRead(parsed.plan), scans: scanKinds(parsed.plan) };
}

/**
 * SELECT で始まる問い合わせか（EXPLAIN ANALYZE は実際に実行するので、読むだけのものに限る）。
 * WITH は書き換えを含められるので入れない。
 * @param {string} query
 */
export function isSelectQuery(query) {
  return /^\s*SELECT\b/i.test(query);
}

/**
 * 同じ問い合わせを、DB を変える前と後で実行計画つきで実行して比べる（インデックスのあり・なしなど）。
 * EXPLAIN ANALYZE は実際に実行するので、query は SELECT だけ（それ以外は実行せずに断る）。
 * 判定と同じく、前と後に DB を初期状態に戻す。実行計画を読めなかったときも ok: false で返す。
 * @param {{ runner: Runner, query: string, changeSql: string }} args
 * @returns {Promise<{ ok: true, before: ExplainSummary, after: ExplainSummary } | { ok: false, stage: 'before' | 'change' | 'after', message: string }>}
 */
export async function compareChange({ runner, query, changeSql }) {
  if (!isSelectQuery(query)) {
    return { ok: false, stage: 'before', message: '比べる問い合わせは SELECT だけです' };
  }
  await runner.reset();
  let stage = /** @type {'before' | 'change' | 'after'} */ ('before');
  try {
    const before = await explain(runner, query);
    if ('error' in before) return { ok: false, stage: 'before', message: before.error };
    stage = 'change';
    const changed = await runner.run(changeSql);
    if (!changed.ok) {
      return {
        ok: false,
        stage: 'change',
        message: 'timeout' in changed ? '時間内に終わりませんでした' : changed.error.message,
      };
    }
    stage = 'after';
    const after = await explain(runner, query);
    if ('error' in after) return { ok: false, stage: 'after', message: after.error };
    return { ok: true, before, after };
  } catch (error) {
    // 実行計画の形が読めなかったとき（例外にせず、どこで失敗したかを返す）
    return { ok: false, stage, message: String(error instanceof Error ? error.message : error) };
  } finally {
    await runner.reset();
  }
}
