import { describe, it, expect } from 'vitest';
import { localDate } from '../../../src/ui/state/local-date.js';

describe('localDate', () => {
  it('月・日を2桁にそろえる', () => {
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('その人のタイムゾーンの日付（年の境目の夜中も、その日のまま）', () => {
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(localDate(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });
});
