import { describe, it, expect } from 'vitest';
import { touchedTables } from '../../../src/core/touched-tables.js';

const TABLES = ['customers', 'order_items', 'orders', 'products'];

describe('touchedTables', () => {
  it('SQLに出てくるテーブル名を、tableNames の順で返す（大文字・小文字は区別しない）', () => {
    expect(
      touchedTables('SELECT c.name FROM Orders o JOIN CUSTOMERS c ON c.id = o.customer_id', TABLES),
    ).toEqual(['customers', 'orders']);
  });

  it('文字列・コメントの中の語は数えない', () => {
    expect(
      touchedTables("SELECT 'orders' FROM products -- customers\n/* order_items */", TABLES),
    ).toEqual(['products']);
  });

  it('列名の一部や別の語の一部には当たらない（語として同じものだけ）', () => {
    expect(touchedTables('SELECT products_count, orders2 FROM t', TABLES)).toEqual([]);
  });

  it('引用符で囲んだ名前は中身そのままで比べる（PostgreSQL と同じく大文字は別の名前）', () => {
    expect(touchedTables('SELECT * FROM "products"', TABLES)).toEqual(['products']);
    expect(touchedTables('SELECT * FROM "Products"', TABLES)).toEqual([]);
  });

  it('閉じていない引用符（打っている途中）は、最後の文字を切らずに比べる', () => {
    expect(touchedTables('SELECT * FROM "products', TABLES)).toEqual(['products']);
    expect(touchedTables('SELECT * FROM "', TABLES)).toEqual([]);
  });

  it('打っている途中・エラーになるSQLでも、出てきた名前を返す', () => {
    expect(touchedTables('SELECT * FROM produ', TABLES)).toEqual([]);
    expect(touchedTables('SELECT * FROM products WHERE', TABLES)).toEqual(['products']);
    expect(touchedTables('', TABLES)).toEqual([]);
  });

  it('列名と同じ名前のテーブルは、列として出ても当たる（字句だけで見る）', () => {
    expect(touchedTables('SELECT orders FROM t', TABLES)).toEqual(['orders']);
  });
});
