import { describe, it, expect } from 'vitest';
import { layoutTables, SCHEMA_LAYOUT } from '../../../src/ui/state/schema-layout.js';

const table = (name, columnCount) => ({
  table: name,
  columns: Array.from({ length: columnCount }, (_, i) => ({
    name: `c${i}`,
    type: 'int',
    primaryKey: i === 0,
  })),
});
const fk = (from, to) => ({ table: from, column: `${to}_id`, refTable: to, refColumn: 'id' });

describe('layoutTables', () => {
  const { columnWidth, headerHeight, rowHeight, gapY } = SCHEMA_LAYOUT;
  const height = (columns) => headerHeight + columns * rowHeight + gapY;

  it('1つなら左上', () => {
    expect(layoutTables([table('products', 7)], [])).toEqual({ products: { x: 0, y: 0 } });
  });

  it('親を子のすぐ左の列に置く（線が別の箱の裏を通らないように）。同じ列のものは上から章の順に積む', () => {
    // 中級の形：customers ← orders ← order_items → products
    const positions = layoutTables(
      [table('customers', 4), table('orders', 4), table('order_items', 4), table('products', 7)],
      [fk('orders', 'customers'), fk('order_items', 'orders'), fk('order_items', 'products')],
    );
    // products は order_items のすぐ左（orders の下）。customers は orders のすぐ左
    expect(positions).toEqual({
      customers: { x: 0, y: 0 },
      orders: { x: columnWidth, y: 0 },
      products: { x: columnWidth, y: height(4) },
      order_items: { x: columnWidth * 2, y: 0 },
    });
  });

  it('自分を指すつながり（自己結合）は、列を決めるのに使わない', () => {
    expect(layoutTables([table('employees', 3)], [fk('employees', 'employees')])).toEqual({
      employees: { x: 0, y: 0 },
    });
  });

  it('つながりが輪になっていても止まる（輪の中は左の列に置く）', () => {
    const positions = layoutTables([table('a', 1), table('b', 1)], [fk('a', 'b'), fk('b', 'a')]);
    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
  });

  it('地図にないテーブルへのつながりは無視する', () => {
    expect(layoutTables([table('orders', 2)], [fk('orders', 'customers')])).toEqual({
      orders: { x: 0, y: 0 },
    });
  });

  it('つながりのないテーブルは同じ列に積む', () => {
    expect(layoutTables([table('a', 2), table('b', 3)], [])).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 0, y: height(2) },
    });
  });

  it('テーブルがなければ空', () => {
    expect(layoutTables([], [])).toEqual({});
  });
});
