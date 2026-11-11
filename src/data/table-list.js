/**
 * 今の DB にあるテーブルと列の一覧（書く画面で「どの名前を使えばよいか」を見せる。DBの地図ができるまでの仮）。
 */

const SQL = `SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position`;

/**
 * @param {import('./sql-runner/sql-runner.js').SqlRunner} runner
 * @returns {Promise<{ table: string, columns: string[] }[]>} テーブル名の順、列は定義の順
 */
export async function loadTableList(runner) {
  const outcome = await runner.run(SQL);
  if (!outcome.ok) throw new Error('テーブルの一覧を読めませんでした');
  /** @type {Map<string, string[]>} */
  const tables = new Map();
  for (const [table, column] of outcome.result.rows) {
    const name = String(table);
    if (!tables.has(name)) tables.set(name, []);
    tables.get(name).push(String(column));
  }
  return [...tables].map(([table, columns]) => ({ table, columns }));
}
