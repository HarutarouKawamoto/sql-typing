import { describe, it, expect } from 'vitest';
import { resolveGroupItems, splitGroupBy } from '../../../src/core/stepper/group-by.js';

describe('splitGroupBy', () => {
  it('GROUP BY の後ろを、括弧・文字列の外のカンマで項目に分ける', () => {
    expect(splitGroupBy('GROUP BY category')).toEqual({ items: ['category'] });
    expect(
      splitGroupBy("group by\n  category, date_trunc('month', released_on), coalesce(a, ',')"),
    ).toEqual({
      items: ['category', "date_trunc('month', released_on)", "coalesce(a, ',')"],
    });
  });

  it('括弧つきの項目・文字列の中のカンマ・コメントを持つ項目', () => {
    expect(splitGroupBy('GROUP BY (a, b)')).toEqual({ items: ['(a, b)'] });
    expect(splitGroupBy('GROUP BY a /* x */, b')).toEqual({ items: ['a /* x */', 'b'] });
  });

  it('ROLLUP・CUBE・GROUPING SETS は扱わない', () => {
    expect(splitGroupBy('GROUP BY ROLLUP (category)')).toHaveProperty('unsupported');
    expect(splitGroupBy('GROUP BY CUBE (a, b)')).toHaveProperty('unsupported');
    expect(splitGroupBy('GROUP BY GROUPING SETS ((a), (b))')).toHaveProperty('unsupported');
  });

  it('項目が空なら扱わない', () => {
    expect(splitGroupBy('GROUP BY')).toHaveProperty('unsupported');
    expect(splitGroupBy('GROUP BY a,')).toHaveProperty('unsupported');
  });
});

describe('resolveGroupItems', () => {
  const select = [
    { text: 'category' },
    { text: "to_char(released_on, 'YYYY-MM') AS ym", alias: undefined },
    { text: 'count(*) AS n' },
    { text: 'price / 1000 band' },
  ];
  const input = ['id', 'name', 'category', 'price', 'released_on'];

  it('列の番号（括弧つきも）は、SELECT の項目の式に置き換える', () => {
    expect(resolveGroupItems(['1'], select, input)).toEqual({ items: ['category'] });
    expect(resolveGroupItems(['(2)'], select, input)).toEqual({
      items: ["to_char(released_on, 'YYYY-MM')"],
    });
  });

  it('SELECT の別名は、その項目の式に置き換える（AS あり・なし、大文字・小文字）', () => {
    expect(resolveGroupItems(['ym', 'BAND'], select, input)).toEqual({
      items: ["to_char(released_on, 'YYYY-MM')", 'price / 1000'],
    });
  });

  it('入力の列名と同じ名前は、別名より列を優先する（PostgreSQL と同じ）', () => {
    const shadow = [{ text: 'upper(category) AS category' }, { text: 'count(*)' }];
    expect(resolveGroupItems(['category'], shadow, input)).toEqual({ items: ['category'] });
  });

  it('ほかの項目はそのまま', () => {
    expect(resolveGroupItems(['price / 1000', 'supplier'], select, input)).toEqual({
      items: ['price / 1000', 'supplier'],
    });
  });

  it('範囲の外の列の番号・集計の項目の番号は扱わない', () => {
    expect(resolveGroupItems(['9'], select, input)).toHaveProperty('unsupported');
    expect(resolveGroupItems(['3'], select, input)).toHaveProperty('unsupported');
  });
});
