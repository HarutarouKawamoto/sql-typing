import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTableList } from '../../../src/data/table-list.js';
import { makeNodeRunner, readSeed } from '../../helpers/make-runner.js';

let runner;

beforeAll(async () => {
  runner = makeNodeRunner();
});

afterAll(async () => {
  await runner.close();
});

describe('loadTableList', () => {
  it('初級の初期データ：products と、定義の順の列', async () => {
    await runner.prepare({ seedSql: readSeed('beginner.sql') });
    expect(await loadTableList(runner)).toEqual([
      {
        table: 'products',
        columns: ['id', 'name', 'category', 'price', 'stock', 'supplier', 'released_on'],
      },
    ]);
  });

  it('テーブルが2つ以上ならテーブル名の順。public 以外のスキーマ（information_schema など）は出さない', async () => {
    await runner.prepare({
      seedSql:
        'CREATE TABLE orders (id INT, total INT); CREATE TABLE customers (id INT, name TEXT);',
    });
    expect(await loadTableList(runner)).toEqual([
      { table: 'customers', columns: ['id', 'name'] },
      { table: 'orders', columns: ['id', 'total'] },
    ]);
  });

  it('テーブルがなければ空', async () => {
    await runner.prepare({ seedSql: 'SELECT 1;' });
    expect(await loadTableList(runner)).toEqual([]);
  });
});
