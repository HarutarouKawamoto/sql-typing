import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadSchema, loadTablePreview } from '../../../src/data/schema-info.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
});

afterAll(async () => {
  await runner.close();
});

describe('loadSchema', () => {
  it('初級の初期データ：products の列（定義の順）・短い型・主キー。つながりはない', async () => {
    await runner.prepare({ seedSql: readSeed('beginner.sql') });
    expect(await loadSchema(runner)).toEqual({
      tables: [
        {
          table: 'products',
          columns: [
            { name: 'id', type: 'int', primaryKey: true },
            { name: 'name', type: 'text', primaryKey: false },
            { name: 'category', type: 'text', primaryKey: false },
            { name: 'price', type: 'int', primaryKey: false },
            { name: 'stock', type: 'int', primaryKey: false },
            { name: 'supplier', type: 'text', primaryKey: false },
            { name: 'released_on', type: 'date', primaryKey: false },
          ],
        },
      ],
      relations: [],
    });
  });

  it('外部キーのつながり（どの列がどのテーブルのどの列を指すか）と、ほかの型の短い名前', async () => {
    await runner.prepare({
      seedSql: `
        CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(40), vip BOOLEAN);
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          customer_id INT REFERENCES customers (id),
          ordered_at TIMESTAMP,
          total NUMERIC(10, 2)
        );`,
    });
    const schema = await loadSchema(runner);
    expect(schema.tables.map((t) => t.table)).toEqual(['customers', 'orders']);
    expect(schema.tables[0].columns.map((c) => c.type)).toEqual(['int', 'varchar', 'bool']);
    expect(schema.tables[1].columns.map((c) => c.type)).toEqual([
      'int',
      'int',
      'timestamp',
      'numeric',
    ]);
    expect(schema.relations).toEqual([
      { table: 'orders', column: 'customer_id', refTable: 'customers', refColumn: 'id' },
    ]);
  });

  it('2つの列でできた主キーは、どちらの列も主キー', async () => {
    await runner.prepare({
      seedSql:
        'CREATE TABLE order_items (order_id INT, product_id INT, PRIMARY KEY (order_id, product_id));',
    });
    const [items] = (await loadSchema(runner)).tables;
    expect(items.columns.map((c) => c.primaryKey)).toEqual([true, true]);
  });

  it('2つの列でできた外部キーは、列の順どおりに1対1で対応する（掛け合わせない）', async () => {
    await runner.prepare({
      seedSql: `
        CREATE TABLE shipments (order_id INT, line INT, PRIMARY KEY (order_id, line));
        CREATE TABLE parcels (
          id INT PRIMARY KEY, s_order INT, s_line INT,
          FOREIGN KEY (s_order, s_line) REFERENCES shipments (order_id, line)
        );`,
    });
    expect((await loadSchema(runner)).relations).toEqual([
      { table: 'parcels', column: 's_order', refTable: 'shipments', refColumn: 'order_id' },
      { table: 'parcels', column: 's_line', refTable: 'shipments', refColumn: 'line' },
    ]);
  });

  it('別々のテーブルに同じ名前の制約があっても混ざらない', async () => {
    await runner.prepare({
      seedSql: `
        CREATE TABLE a (id INT PRIMARY KEY);
        CREATE TABLE b (id INT PRIMARY KEY);
        CREATE TABLE x (id INT PRIMARY KEY, a_id INT, CONSTRAINT fk_same FOREIGN KEY (a_id) REFERENCES a (id));
        CREATE TABLE y (id INT PRIMARY KEY, b_id INT, CONSTRAINT fk_same FOREIGN KEY (b_id) REFERENCES b (id));`,
    });
    expect((await loadSchema(runner)).relations).toEqual([
      { table: 'x', column: 'a_id', refTable: 'a', refColumn: 'id' },
      { table: 'y', column: 'b_id', refTable: 'b', refColumn: 'id' },
    ]);
  });

  it('public 以外のスキーマのテーブル・それを指すつながり・ビューは出さない', async () => {
    await runner.prepare({
      seedSql: `
        CREATE SCHEMA other;
        CREATE TABLE other.customers (id INT PRIMARY KEY);
        CREATE TABLE customers (id INT PRIMARY KEY);
        CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT REFERENCES other.customers (id));
        CREATE VIEW order_view AS SELECT id FROM orders;`,
    });
    const schema = await loadSchema(runner);
    expect(schema.tables.map((t) => t.table)).toEqual(['customers', 'orders']);
    expect(schema.relations).toEqual([]);
  });

  it('テーブルがなければ空', async () => {
    await runner.prepare({ seedSql: 'SELECT 1;' });
    expect(await loadSchema(runner)).toEqual({ tables: [], relations: [] });
  });
});

describe('loadTablePreview', () => {
  it('先頭20行と、全部の行数', async () => {
    await runner.prepare({ seedSql: readSeed('beginner.sql') });
    const { result, total } = await loadTablePreview(runner, 'products');
    expect(total).toBe(30);
    expect(result.rows).toHaveLength(20);
    expect(result.columns[0]).toBe('id');
  });

  it('上限を変えられる', async () => {
    const { result } = await loadTablePreview(runner, 'products', 3);
    expect(result.rows).toHaveLength(3);
  });

  it('変わった名前（大文字・引用符）のテーブルも引用して読める', async () => {
    await runner.prepare({
      seedSql: 'CREATE TABLE "Odd ""Name""" (x INT); INSERT INTO "Odd ""Name""" VALUES (1), (2);',
    });
    const { result, total } = await loadTablePreview(runner, 'Odd "Name"');
    expect(total).toBe(2);
    expect(result.rows).toEqual([[1], [2]]);
  });

  it('ないテーブルは例外', async () => {
    await expect(loadTablePreview(runner, 'nothing')).rejects.toThrow();
  });
});
