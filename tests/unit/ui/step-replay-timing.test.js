import { describe, it, expect } from 'vitest';
import { needsMark, stepTiming } from '../../../src/ui/state/step-replay-timing.js';

const step = (diff = {}) => ({
  diff: {
    removed: [],
    removedColumns: [],
    renamedColumns: {},
    merged: {},
    reordered: false,
    groups: {},
    ...diff,
  },
});

describe('needsMark', () => {
  it('行が消える・列が消える・行がまとまる段階は、先に印を付ける', () => {
    expect(needsMark(step({ removed: ['(0,1)'] }))).toBe(true);
    expect(needsMark(step({ removedColumns: ['id'] }))).toBe(true);
    expect(needsMark(step({ merged: { '(0,1)': ['(0,2)'] } }))).toBe(true);
  });

  it('GROUP BY・HAVING の段階は、先にグループの色を付ける', () => {
    expect(needsMark(step({ groups: { '(0,1)': 0 } }))).toBe(true);
  });

  it('変化のない段階・並び替えだけの段階は、印を付けない', () => {
    expect(needsMark(step())).toBe(false);
    expect(needsMark(step({ reordered: true }))).toBe(false);
  });
});

describe('stepTiming', () => {
  it('機能設計書の長さ（WHERE は印 1.8 秒 → 消す 0.8 秒）と、段階の間の1秒', () => {
    expect(stepTiming('WHERE', 1)).toEqual({ markMs: 1800, applyMs: 800, holdMs: 1000 });
    expect(stepTiming('FROM', 1)).toEqual({ markMs: 0, applyMs: 600, holdMs: 1000 });
    expect(stepTiming('GROUP BY', 1)).toEqual({ markMs: 1800, applyMs: 800, holdMs: 1000 });
    expect(stepTiming('HAVING', 1)).toEqual({ markMs: 1800, applyMs: 800, holdMs: 1000 });
  });

  it('速さ2倍なら半分、0.5倍なら2倍の長さ', () => {
    expect(stepTiming('ORDER BY', 2)).toEqual({ markMs: 0, applyMs: 400, holdMs: 500 });
    expect(stepTiming('ORDER BY', 0.5)).toEqual({ markMs: 0, applyMs: 1600, holdMs: 2000 });
  });

  it('知らない段階・おかしな速さでも、長さ1倍の決まった値を返す', () => {
    expect(stepTiming('UNKNOWN', 0)).toEqual({ markMs: 0, applyMs: 800, holdMs: 1000 });
  });
});
