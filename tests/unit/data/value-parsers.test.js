import { describe, it, expect } from 'vitest';
import {
  parseNumeric,
  parseInt8,
  keepText,
  VALUE_PARSERS,
  PG_TYPE,
} from '../../../src/data/sql-runner/value-parsers.js';

describe('parseNumeric', () => {
  it('NUMERIC の文字列を数値にする', () => {
    expect(parseNumeric('750.0000000000000000')).toBe(750);
    expect(parseNumeric('1.5')).toBe(1.5);
  });

  it('数値にできないもの（NaN）は文字列のまま', () => {
    expect(parseNumeric('NaN')).toBe('NaN');
  });
});

describe('parseInt8', () => {
  it('安全な範囲の BIGINT は数値にする', () => {
    expect(parseInt8('30')).toBe(30);
  });

  it('安全な範囲を超える BIGINT は文字列のまま', () => {
    expect(parseInt8('9223372036854775807')).toBe('9223372036854775807');
  });
});

describe('VALUE_PARSERS', () => {
  it('日付・時刻は文字列のまま返す', () => {
    expect(VALUE_PARSERS[PG_TYPE.DATE]('2026-01-02')).toBe('2026-01-02');
    expect(VALUE_PARSERS[PG_TYPE.TIMESTAMP]).toBe(keepText);
    expect(VALUE_PARSERS[PG_TYPE.TIMESTAMPTZ]).toBe(keepText);
  });
});
