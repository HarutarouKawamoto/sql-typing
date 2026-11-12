/**
 * DBの地図の箱の置き方（React に依存しない。単体テストする）。
 * 指される側（親）を左の列、指す側（子）を右の列に置き、線が左から右へ流れるようにする
 * （中級の customers ← orders ← order_items → products）。同じ列のものは上から章の順に積む。
 */

/** 箱の大きさの目安（px。React Flow の座標） */
export const SCHEMA_LAYOUT = {
  columnWidth: 280,
  headerHeight: 40,
  rowHeight: 22,
  gapY: 40,
};

/**
 * 各テーブルの列の番号（親をたどった深さ）。自分を指すつながりは使わない。輪になっていても止まるよう、
 * 深さはテーブルの数より大きくしない（輪の中は、たどれた深さのまま）。
 * @param {string[]} names
 * @param {{ table: string, refTable: string }[]} relations
 * @returns {Map<string, number>}
 */
function depths(names, relations) {
  const known = new Set(names);
  const edges = relations.filter(
    (r) => r.table !== r.refTable && known.has(r.table) && known.has(r.refTable),
  );
  const depth = new Map(names.map((name) => [name, 0]));
  for (let round = 0; round < names.length; round += 1) {
    let changed = false;
    for (const { table, refTable } of edges) {
      const next = Math.min(depth.get(refTable) + 1, names.length - 1);
      if (next > depth.get(table)) {
        depth.set(table, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

/**
 * @param {{ table: string, columns: unknown[] }[]} tables - 章の順
 * @param {{ table: string, refTable: string }[]} relations - 外部キーのつながり（table が refTable を指す）
 * @returns {Record<string, { x: number, y: number }>}
 */
export function layoutTables(tables, relations) {
  const { columnWidth, headerHeight, rowHeight, gapY } = SCHEMA_LAYOUT;
  const depth = depths(
    tables.map((t) => t.table),
    relations,
  );
  /** @type {Record<string, { x: number, y: number }>} */
  const positions = {};
  /** @type {Map<number, number>} 列ごとの、次に置く高さ */
  const nextY = new Map();
  for (const { table, columns } of tables) {
    const column = depth.get(table) ?? 0;
    const y = nextY.get(column) ?? 0;
    positions[table] = { x: column * columnWidth, y };
    nextY.set(column, y + headerHeight + columns.length * rowHeight + gapY);
  }
  return positions;
}
