import { describe, it, expect } from 'vitest';
import { splitSelectList } from '../../../src/core/stepper/select-list.js';

describe('splitSelectList', () => {
  it('SELECT を除き、括弧の外のカンマで項目に分ける', () => {
    expect(splitSelectList('SELECT name, price, round(price * 1.1, 0)')).toEqual({
      distinct: false,
      unsupportedModifier: null,
      items: [
        { text: 'name', sourceColumn: 'name' },
        { text: 'price', sourceColumn: 'price' },
        { text: 'round(price * 1.1, 0)' },
      ],
    });
  });

  it('列名 AS 別名・列名 別名は、元の列と別名を持つ（大文字・小文字はそろえない）', () => {
    expect(splitSelectList('select name AS item, price cost, "Order" AS o').items).toEqual([
      { text: 'name AS item', sourceColumn: 'name', alias: 'item' },
      { text: 'price cost', sourceColumn: 'price', alias: 'cost' },
      { text: '"Order" AS o' },
    ]);
  });

  it('DISTINCT を見分けて項目から外す', () => {
    expect(splitSelectList('SELECT DISTINCT category')).toEqual({
      distinct: true,
      unsupportedModifier: null,
      items: [{ text: 'category', sourceColumn: 'category' }],
    });
  });

  it('DISTINCT ON と SELECT ALL は、まだ扱わない書き方として印を付ける', () => {
    expect(splitSelectList('SELECT DISTINCT ON (a) a, b').unsupportedModifier).toBe('DISTINCT ON');
    expect(splitSelectList('SELECT ALL name').unsupportedModifier).toBe('ALL');
  });

  it('* は1つの項目（元の列なし）', () => {
    expect(splitSelectList('SELECT *').items).toEqual([{ text: '*' }]);
  });

  it('文字列の中のカンマでは分けない', () => {
    expect(splitSelectList("SELECT 'a, b' AS x, name").items.map((i) => i.text)).toEqual([
      "'a, b' AS x",
      'name',
    ]);
  });

  it('改行や余分な空白を含んでいても、項目の前後の空白は取る', () => {
    expect(splitSelectList('SELECT\n  name,\n  price\n').items.map((i) => i.text)).toEqual([
      'name',
      'price',
    ]);
  });
});
