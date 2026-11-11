import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/core/sql-text.js';

const kinds = (sql) => tokenize(sql).map((t) => [t.type, t.text]);

describe('tokenize', () => {
  it('単語・空白・記号・数に分ける', () => {
    expect(kinds('SELECT name, price FROM products WHERE price >= 1000')).toEqual([
      ['word', 'SELECT'],
      ['space', ' '],
      ['word', 'name'],
      ['symbol', ','],
      ['space', ' '],
      ['word', 'price'],
      ['space', ' '],
      ['word', 'FROM'],
      ['space', ' '],
      ['word', 'products'],
      ['space', ' '],
      ['word', 'WHERE'],
      ['space', ' '],
      ['word', 'price'],
      ['space', ' '],
      ['symbol', '>'],
      ['symbol', '='],
      ['space', ' '],
      ['number', '1000'],
    ]);
  });

  it("文字列 '...' を1つにする（'' は中の '）", () => {
    expect(kinds("name = 'It''s Mug'")).toEqual([
      ['word', 'name'],
      ['space', ' '],
      ['symbol', '='],
      ['space', ' '],
      ['string', "'It''s Mug'"],
    ]);
  });

  it('閉じていない文字列は最後までを文字列にする（打っている途中のSQL）', () => {
    expect(kinds("name = 'Mu")).toEqual([
      ['word', 'name'],
      ['space', ' '],
      ['symbol', '='],
      ['space', ' '],
      ['string', "'Mu"],
    ]);
  });

  it('"..." の識別子、-- と /* */ のコメントを見分ける', () => {
    expect(kinds('SELECT "Order" -- note\nFROM /* x */ t')).toEqual([
      ['word', 'SELECT'],
      ['space', ' '],
      ['quoted', '"Order"'],
      ['space', ' '],
      ['comment', '-- note'],
      ['space', '\n'],
      ['word', 'FROM'],
      ['space', ' '],
      ['comment', '/* x */'],
      ['space', ' '],
      ['word', 't'],
    ]);
  });

  it('小数・アンダースコアを含む単語・連続する空白と改行', () => {
    expect(kinds('released_on  \n 1.5')).toEqual([
      ['word', 'released_on'],
      ['space', '  \n '],
      ['number', '1.5'],
    ]);
  });

  it('各トークンに元のSQLの中の位置（start・end）が付く', () => {
    const tokens = tokenize("a = 'x'");
    expect(tokens.map((t) => [t.start, t.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 7],
    ]);
  });

  it('空の文字列は空の配列', () => {
    expect(tokenize('')).toEqual([]);
  });
});
