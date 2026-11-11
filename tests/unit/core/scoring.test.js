import { describe, it, expect } from 'vitest';
import {
  computeTypingStats,
  rankFor,
  weakPointKey,
  countTypedKeys,
  topWeakPoints,
} from '../../../src/core/scoring.js';
import { buildTarget } from '../../../src/core/typing-engine.js';

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'IS NULL', 'NULL'];

describe('computeTypingStats', () => {
  it('cpm は正しく打った数 ÷ 分、正確さは小数第1位まで', () => {
    expect(computeTypingStats({ okCount: 100, missCount: 3, elapsedMs: 30_000 })).toEqual({
      cpm: 200,
      accuracy: 97.1,
      rank: 'A',
    });
  });

  it('時間が0のときは cpm 0、打っていないときの正確さは100', () => {
    expect(computeTypingStats({ okCount: 0, missCount: 0, elapsedMs: 0 })).toEqual({
      cpm: 0,
      accuracy: 100,
      rank: 'C',
    });
  });

  it('cpm は小数を切り捨てる', () => {
    expect(computeTypingStats({ okCount: 10, missCount: 0, elapsedMs: 7_000 }).cpm).toBe(85);
  });
});

describe('rankFor', () => {
  it.each([
    [250, 98, 'S'],
    [249, 99, 'A'],
    [300, 97.9, 'A'],
    [180, 95, 'A'],
    [179, 95, 'B'],
    [120, 90, 'B'],
    [500, 89.9, 'C'],
    [119, 100, 'C'],
  ])('cpm %d・正確さ %d%% は %s', (cpm, accuracy, rank) => {
    expect(rankFor(cpm, accuracy)).toBe(rank);
  });
});

describe('weakPointKey', () => {
  const target = buildTarget('SELECT name FROM products WHERE supplier IS NULL ORDER BY (price)');
  const slotOf = (index) => target.slots.findIndex((s) => s.start === index);
  const sql = 'SELECT name FROM products WHERE supplier IS NULL ORDER BY (price)';

  it('記号はその1文字', () => {
    expect(weakPointKey(target, slotOf(sql.indexOf('(')), KEYWORDS)).toBe('(');
  });

  it('英字はそのスロットを含むキーワード（大文字）', () => {
    expect(weakPointKey(target, slotOf(2), KEYWORDS)).toBe('SELECT');
  });

  it('2語のキーワードは2語で数える（IS NULL・ORDER BY）', () => {
    expect(weakPointKey(target, slotOf(sql.indexOf('IS') + 1), KEYWORDS)).toBe('IS NULL');
    expect(weakPointKey(target, slotOf(sql.indexOf('NULL') + 2), KEYWORDS)).toBe('IS NULL');
    expect(weakPointKey(target, slotOf(sql.indexOf('BY')), KEYWORDS)).toBe('ORDER BY');
  });

  it('列名・テーブル名・区切りは数えない（null）', () => {
    expect(weakPointKey(target, slotOf(sql.indexOf('name')), KEYWORDS)).toBe(null);
    expect(weakPointKey(target, slotOf(6), KEYWORDS)).toBe(null); // 区切り
  });
});

describe('countTypedKeys', () => {
  it('問題を1回打ち終えたときの、記号とキーワードの回数（キーワードは1語につき1回）', () => {
    const target = buildTarget("SELECT * FROM t WHERE a = 'x'");
    expect(countTypedKeys(target, KEYWORDS)).toEqual({
      SELECT: 1,
      '*': 1,
      FROM: 1,
      WHERE: 1,
      '=': 1,
      "'": 2,
    });
  });

  it('モード2：空欄のスロットは数えない（空欄の中の miss を苦手に入れないので、分母もそろえる）', () => {
    const target = buildTarget('SELECT * FROM t WHERE a = 1');
    // FROM t（スロット 9〜14）を空欄にする
    const skip = new Set([9, 10, 11, 12, 13, 14]);
    expect(countTypedKeys(target, KEYWORDS, skip)).toEqual({ SELECT: 1, '*': 1, WHERE: 1, '=': 1 });
  });
});

describe('topWeakPoints', () => {
  it('typed が20回以上のものから、ミスの割合が大きい順に3つ', () => {
    const mistakes = { '(': 10, ',': 2, SELECT: 5, WHERE: 9, ')': 1 };
    const typed = { '(': 20, ',': 40, SELECT: 50, WHERE: 10, ')': 25 };
    expect(topWeakPoints(mistakes, typed)).toEqual([
      { key: '(', rate: 0.5, mistakes: 10, typed: 20 },
      { key: SELECT_KEY, rate: 0.1, mistakes: 5, typed: 50 },
      { key: ',', rate: 0.05, mistakes: 2, typed: 40 },
    ]);
  });

  it('ミスが0のものは入れない', () => {
    expect(topWeakPoints({ '(': 0 }, { '(': 30 })).toEqual([]);
  });
});

const SELECT_KEY = 'SELECT';
