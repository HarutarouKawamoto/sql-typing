import { describe, it, expect } from 'vitest';
import { findKeywordSpans, keywordsOfSlots } from '../../../src/core/keyword-spans.js';
import { buildTarget } from '../../../src/core/typing-engine.js';

const WORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'ORDER BY',
  'DESC',
  'IS NULL',
  'IS NOT NULL',
  'NOT',
  'IN',
];

const words = (sql) => findKeywordSpans(sql, WORDS).map((s) => [s.word, sql.slice(s.start, s.end)]);

describe('findKeywordSpans', () => {
  it('用語辞典の語の場所を前から順に返す（大文字・小文字は区別しない）', () => {
    expect(findKeywordSpans('select * From t', WORDS)).toEqual([
      { start: 0, end: 6, word: 'SELECT' },
      { start: 9, end: 13, word: 'FROM' },
    ]);
  });

  it('2語・3語の用語は、空白・改行だけをはさんでいれば1つにまとめる（長いものが先）', () => {
    expect(words('SELECT a FROM t WHERE b IS NOT NULL ORDER\n  BY a DESC')).toEqual([
      ['SELECT', 'SELECT'],
      ['FROM', 'FROM'],
      ['WHERE', 'WHERE'],
      ['IS NOT NULL', 'IS NOT NULL'],
      ['ORDER BY', 'ORDER\n  BY'],
      ['DESC', 'DESC'],
    ]);
  });

  it('複数語の用語の一部だけなら、1語の用語として見る（IS だけ・NOT IN）', () => {
    expect(words('WHERE a NOT IN (1) AND b IS c')).toEqual([
      ['WHERE', 'WHERE'],
      ['NOT', 'NOT'],
      ['IN', 'IN'],
    ]);
  });

  it('文字列・コメント・引用符の名前の中は見ない。コメントをはさんだ語はつなげない', () => {
    expect(words('SELECT \'from\' FROM "where" -- ORDER BY\nORDER /* x */ BY')).toEqual([
      ['SELECT', 'SELECT'],
      ['FROM', 'FROM'],
    ]);
  });

  it('語の一部には当たらない', () => {
    expect(words('SELECT selected, fromage FROM t')).toEqual([
      ['SELECT', 'SELECT'],
      ['FROM', 'FROM'],
    ]);
  });

  it('空のSQL・用語が空なら空', () => {
    expect(findKeywordSpans('', WORDS)).toEqual([]);
    expect(findKeywordSpans('SELECT 1', [])).toEqual([]);
  });
});

describe('keywordsOfSlots', () => {
  /** スロットごとの [打つ文字（区切りは _）, 語, 組] */
  const slotsOf = (sql) => {
    const target = buildTarget(sql);
    return keywordsOfSlots(target, WORDS).map((found, i) => [
      target.slots[i].kind === 'separator' ? '_' : target.slots[i].expected,
      found?.word ?? null,
      found?.group ?? null,
    ]);
  };

  it('語のスロットに語と組（何番目の語か）を付ける。語の外は undefined', () => {
    expect(slotsOf('SELECT a')).toEqual([
      ['S', 'SELECT', 0],
      ['E', 'SELECT', 0],
      ['L', 'SELECT', 0],
      ['E', 'SELECT', 0],
      ['C', 'SELECT', 0],
      ['T', 'SELECT', 0],
      ['_', null, null],
      ['a', null, null],
    ]);
  });

  it('複数語の用語は、間の区切り（改行・字下げも）にも同じ語と組を付ける', () => {
    const result = slotsOf('a IS NOT\n  NULL ORDER\nBY b');
    const words = result
      .filter(([, word]) => word !== null)
      .map(([ch, word, group]) => `${ch}:${word}:${group}`);
    expect(words).toEqual([
      'I:IS NOT NULL:0',
      'S:IS NOT NULL:0',
      '_:IS NOT NULL:0',
      'N:IS NOT NULL:0',
      'O:IS NOT NULL:0',
      'T:IS NOT NULL:0',
      '_:IS NOT NULL:0',
      'N:IS NOT NULL:0',
      'U:IS NOT NULL:0',
      'L:IS NOT NULL:0',
      'L:IS NOT NULL:0',
      'O:ORDER BY:1',
      'R:ORDER BY:1',
      'D:ORDER BY:1',
      'E:ORDER BY:1',
      'R:ORDER BY:1',
      '_:ORDER BY:1',
      'B:ORDER BY:1',
      'Y:ORDER BY:1',
    ]);
  });
});
