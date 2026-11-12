import { describe, it, expect } from 'vitest';
import { joinColors } from '../../../src/ui/state/join-colors.js';

const rows = (...rids) => rids.map((rid) => ({ rid, values: [] }));

describe('joinColors', () => {
  it('多対1（注文 → 顧客）：右の行ごとの色。左の行は、つながる右の行と同じ色', () => {
    const join = {
      rows: rows('c1', 'c2', 'c3'),
      pairs: { o1: ['c1'], o2: ['c2'], o3: ['c1'], o4: [] },
    };
    const colors = joinColors(join, rows('o1', 'o2', 'o3', 'o4'));
    expect(colors.right.get('c1')).toBe(0);
    expect(colors.right.get('c2')).toBe(1);
    expect(colors.right.has('c3')).toBe(false);
    for (const [left, [right]] of Object.entries(join.pairs)) {
      if (right) expect(colors.left.get(left)).toBe(colors.right.get(right));
    }
    expect(colors.left.has('o4')).toBe(false);
    expect(colors.used).toEqual(new Set(['c1', 'c2']));
    expect(colors.joined('o3+c1')).toBe(0);
  });

  it('1対多（顧客 → 注文）：左の行ごとの色。右の行は、つながる左の行と同じ色', () => {
    const join = { rows: rows('o1', 'o2', 'o3'), pairs: { c1: ['o1', 'o3'], c2: ['o2'], c3: [] } };
    const colors = joinColors(join, rows('c1', 'c2', 'c3'));
    expect(colors.left.get('c1')).toBe(0);
    expect(colors.right.get('o1')).toBe(0);
    expect(colors.right.get('o3')).toBe(0);
    expect(colors.right.get('o2')).toBe(1);
    expect(colors.joined('c1+o3')).toBe(0);
    expect(colors.joined('c3+-')).toBeUndefined();
  });

  it('多対多：2つ以上の色の左の行につながる右の行は、色を付けず multi にする', () => {
    const join = { rows: rows('x', 'y'), pairs: { a: ['x', 'y'], b: ['x'] } };
    const colors = joinColors(join, rows('a', 'b'));
    expect(colors.right.has('x')).toBe(false);
    expect(colors.multi.has('x')).toBe(true);
    expect(colors.right.get('y')).toBe(colors.left.get('a'));
  });

  it('色は6色でくり返す', () => {
    const lefts = Array.from({ length: 8 }, (_, i) => `l${i}`);
    const join = {
      rows: rows(...lefts.map((_, i) => `r${i}`)),
      pairs: Object.fromEntries(lefts.map((l, i) => [l, [`r${i}`]])),
    };
    const colors = joinColors(join, rows(...lefts));
    expect(colors.right.get('r6')).toBe(0);
  });
});
