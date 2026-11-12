import { describe, it, expect } from 'vitest';
import { parseFrom } from '../../../src/core/stepper/from-clause.js';

describe('parseFrom', () => {
  it('テーブル1つ（別名なし・あり・AS あり）', () => {
    expect(parseFrom('FROM products')).toEqual({
      base: { name: 'products', alias: null, ref: 'products', text: 'FROM products' },
      joins: [],
    });
    expect(parseFrom('FROM products p').base).toMatchObject({
      name: 'products',
      alias: 'p',
      ref: 'p',
    });
    expect(parseFrom('from Products AS p').base).toMatchObject({ name: 'products', ref: 'p' });
  });

  it('JOIN の並び：種類・テーブル・JOIN の文字の範囲（ON の条件の終わりまで）', () => {
    const text =
      'FROM orders o\n  JOIN customers c ON c.id = o.customer_id\n  LEFT OUTER JOIN order_items i ON (i.order_id = o.id AND i.quantity > 1)';
    const parsed = parseFrom(text);
    expect(parsed.base).toMatchObject({ name: 'orders', ref: 'o', text: 'FROM orders o' });
    expect(parsed.joins.map((j) => [j.kind, j.table.name, j.table.ref])).toEqual([
      ['INNER', 'customers', 'c'],
      ['LEFT', 'order_items', 'i'],
    ]);
    expect(text.slice(parsed.joins[0].start, parsed.joins[0].end)).toBe(
      'JOIN customers c ON c.id = o.customer_id',
    );
    expect(text.slice(parsed.joins[1].start, parsed.joins[1].end)).toBe(
      'LEFT OUTER JOIN order_items i ON (i.order_id = o.id AND i.quantity > 1)',
    );
  });

  it('INNER JOIN・LEFT JOIN と書いても同じ。同じテーブルを別名で2回（自己結合）', () => {
    const parsed = parseFrom('FROM customers a INNER JOIN customers b ON a.region = b.region');
    expect(parsed.joins[0]).toMatchObject({
      kind: 'INNER',
      table: { name: 'customers', ref: 'b' },
    });
    expect(parseFrom('FROM a LEFT JOIN b ON a.id = b.a_id').joins[0].kind).toBe('LEFT');
  });

  it('ON の条件の中の文字列・括弧の中の JOIN の語では区切らない', () => {
    const parsed = parseFrom("FROM a JOIN b ON b.note = 'x join y' AND (a.id = b.id)");
    expect(parsed.joins).toHaveLength(1);
  });

  it('ON の中の left(...)・right(...) は関数（JOIN の始まりではない）', () => {
    const parsed = parseFrom("FROM a JOIN b ON left(b.name, 1) = 'A' AND right(a.code, 2) = b.x");
    expect(parsed.joins).toHaveLength(1);
  });

  it('引用符つきの別名は、SQLで使う名前（ref）に引用符を残す', () => {
    expect(parseFrom('FROM orders "O"').base).toMatchObject({ alias: 'O', ref: '"O"' });
  });

  it('ON の条件が括弧2つと AND', () => {
    const text = 'FROM a LEFT OUTER JOIN b ON (a.id = b.a_id) AND (b.x > 1)';
    const parsed = parseFrom(text);
    expect(text.slice(parsed.joins[0].start, parsed.joins[0].end)).toBe(
      'LEFT OUTER JOIN b ON (a.id = b.a_id) AND (b.x > 1)',
    );
  });

  it('扱わない形の理由は、その形を言う（スキーマ名つき・テーブル関数・RIGHT など）', () => {
    expect(parseFrom('FROM public.products')).toEqual({
      unsupported: 'スキーマ名つきのテーブルのステップ再生はまだありません',
    });
    expect(parseFrom('FROM generate_series(1, 3) g')).toEqual({
      unsupported: '関数を使う FROM のステップ再生はまだありません',
    });
    expect(parseFrom('FROM a RIGHT JOIN b ON true')).toEqual({
      unsupported: 'RIGHT JOIN のステップ再生はまだありません',
    });
    expect(parseFrom('FROM a x y')).toEqual({
      unsupported: 'この形の FROM のステップ再生はまだありません',
    });
  });

  it.each([
    ['RIGHT JOIN', 'FROM a RIGHT JOIN b ON a.id = b.id'],
    ['FULL JOIN', 'FROM a FULL OUTER JOIN b ON a.id = b.id'],
    ['CROSS JOIN', 'FROM a CROSS JOIN b'],
    ['NATURAL JOIN', 'FROM a NATURAL JOIN b'],
    ['USING', 'FROM a JOIN b USING (id)'],
    ['ON のない JOIN', 'FROM a JOIN b'],
    ['カンマ', 'FROM a, b'],
    ['サブクエリ', 'FROM (SELECT * FROM a) t'],
    ['LATERAL', 'FROM a JOIN LATERAL (SELECT 1) t ON true'],
    ['同じ別名が2つ', 'FROM a x JOIN b x ON true'],
    ['別名のない同じテーブル', 'FROM a JOIN a ON true'],
  ])('%s は扱わない', (_label, text) => {
    expect(parseFrom(text)).toHaveProperty('unsupported');
  });
});
