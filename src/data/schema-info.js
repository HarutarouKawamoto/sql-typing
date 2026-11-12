/**
 * DBの地図のための、今の DB のテーブル・列・つながりと、テーブルの中身の読み込み。
 * 元：docs/functional-design.md の SchemaMap
 */

/**
 * @typedef {{ name: string, type: string, primaryKey: boolean }} SchemaColumn
 * @typedef {{ table: string, columns: SchemaColumn[] }} SchemaTable
 * @typedef {{ table: string, column: string, refTable: string, refColumn: string }} SchemaRelation
 * @typedef {{ tables: SchemaTable[], relations: SchemaRelation[] }} Schema
 */

// ビューは地図に出さない（表ではないので、つながりも中身の数え方も違う）
const COLUMNS_SQL = `SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position`;

// 主キーの列と、外部キーの列 → 指す先の列。pg_constraint の列の並び（conkey・confkey）を同じ番号で
// 対応させる（information_schema で結ぶと、2つの列のキーが掛け合わさり、同じ名前の制約が混ざるため）。
// 指す先が public 以外のテーブルのつながりは出さない（地図にない箱へ線を引かない）
const KEYS_SQL = `SELECT c.contype, rel.relname, a.attname, frel.relname, fa.attname
FROM pg_constraint c
JOIN pg_class rel ON rel.oid = c.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
LEFT JOIN pg_class frel ON frel.oid = c.confrelid
LEFT JOIN pg_namespace fn ON fn.oid = frel.relnamespace
LEFT JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[k.ord]
WHERE n.nspname = 'public'
  AND (c.contype = 'p' OR (c.contype = 'f' AND fn.nspname = 'public'))
ORDER BY rel.relname, c.conname, k.ord`;

/** 地図の箱が細く収まるよう、よく出る型の名前を短くする */
const SHORT_TYPES = {
  integer: 'int',
  bigint: 'bigint',
  smallint: 'smallint',
  'character varying': 'varchar',
  character: 'char',
  'timestamp without time zone': 'timestamp',
  'timestamp with time zone': 'timestamptz',
  boolean: 'bool',
  'double precision': 'float8',
};

/**
 * @param {import('./sql-runner/sql-runner.js').SqlRunner} runner
 * @param {string} sql
 */
async function query(runner, sql) {
  const outcome = await runner.run(sql);
  if (!outcome.ok) throw new Error('DBの地図を読めませんでした');
  return outcome.result.rows;
}

/**
 * @param {import('./sql-runner/sql-runner.js').SqlRunner} runner
 * @returns {Promise<Schema>} テーブルは名前の順、列は定義の順
 */
export async function loadSchema(runner) {
  const columnRows = await query(runner, COLUMNS_SQL);
  const keyRows = await query(runner, KEYS_SQL);

  const primaryKeys = new Set();
  /** @type {SchemaRelation[]} */
  const relations = [];
  for (const [type, table, column, refTable, refColumn] of keyRows) {
    if (type === 'p') primaryKeys.add(`${table}.${column}`);
    else {
      relations.push({
        table: String(table),
        column: String(column),
        refTable: String(refTable),
        refColumn: String(refColumn),
      });
    }
  }

  /** @type {Map<string, SchemaColumn[]>} */
  const tables = new Map();
  for (const [table, column, dataType] of columnRows) {
    const name = String(table);
    if (!tables.has(name)) tables.set(name, []);
    tables.get(name).push({
      name: String(column),
      type: SHORT_TYPES[String(dataType)] ?? String(dataType),
      primaryKey: primaryKeys.has(`${name}.${column}`),
    });
  }
  return { tables: [...tables].map(([table, columns]) => ({ table, columns })), relations };
}

/** テーブル名を引用符で囲む（名前の中の " は2つにする） */
const quoteIdentifier = (name) => `"${name.replaceAll('"', '""')}"`;

/**
 * テーブルの先頭の行と、全部の行数（地図でテーブルを選んだとき）。
 * @param {import('./sql-runner/sql-runner.js').SqlRunner} runner
 * @param {string} table
 * @param {number} [limit]
 * @returns {Promise<{ result: import('./sql-runner/sql-runner.js').QueryResult, total: number }>}
 */
export async function loadTablePreview(runner, table, limit = 20) {
  const name = quoteIdentifier(table);
  const rows = await runner.run(`SELECT * FROM ${name} LIMIT ${Math.trunc(limit)}`);
  if (!rows.ok) throw new Error(`${table} の中身を読めませんでした`);
  const count = await runner.run(`SELECT count(*) FROM ${name}`);
  if (!count.ok) throw new Error(`${table} の行数を読めませんでした`);
  return { result: rows.result, total: Number(count.result.rows[0][0]) };
}
