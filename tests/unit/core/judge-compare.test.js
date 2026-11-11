import { describe, it, expect } from 'vitest';
import {
  normalizeCell,
  cellsEqual,
  compareTables,
  findRuleViolation,
} from '../../../src/core/judge.js';

const table = (columns, rows) => ({ columns, rows });

describe('normalizeCell', () => {
  it('-0 は 0、NaN・Infinity は文字の印。文字列・真偽値・NULL はそのまま', () => {
    expect(normalizeCell(1000)).toBe(normalizeCell(1000.0));
    expect(cellsEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(normalizeCell(-0)).toBe(0);
    expect(normalizeCell(Number.NaN)).toBe('__NaN__');
    expect(normalizeCell('1000')).toBe('1000');
    expect(normalizeCell(true)).toBe(true);
    expect(normalizeCell(null)).toBe(null);
  });

  it('数値の 1000 と文字列の "1000"、NULL と文字列の "null" は違う', () => {
    expect(JSON.stringify(normalizeCell(1000))).not.toBe(JSON.stringify(normalizeCell('1000')));
    expect(JSON.stringify(normalizeCell(null))).not.toBe(JSON.stringify(normalizeCell('null')));
  });
});

describe('compareTables', () => {
  const expected = table(
    ['name', 'price'],
    [
      ['Mug', 1200],
      ['Pen', 300],
    ],
  );

  it('同じなら null。ordered でなければ並びは気にしない', () => {
    const swapped = table(
      ['name', 'price'],
      [
        ['Pen', 300],
        ['Mug', 1200],
      ],
    );
    expect(compareTables(swapped, expected, { ordered: false })).toBe(null);
  });

  it('列の名前は checkColumnNames のときだけ比べる（大文字・小文字は無視）', () => {
    const renamed = table(['item', 'PRICE'], expected.rows);
    expect(compareTables(renamed, expected, { ordered: false })).toBe(null);
    expect(compareTables(renamed, expected, { ordered: false, checkColumnNames: true })).toEqual({
      reason: 'columnNames',
      message: '列の名前が違います（あなた：item, PRICE／正解：name, price）',
    });
    expect(
      compareTables(table(['NAME', 'Price'], expected.rows), expected, {
        ordered: false,
        checkColumnNames: true,
      }),
    ).toBe(null);
  });

  it('列の数が違う', () => {
    expect(
      compareTables(table(['name'], [['Mug'], ['Pen']]), expected, { ordered: false }),
    ).toEqual({
      reason: 'columnCount',
      message: '列の数が違います（あなた：1列／正解：2列）',
    });
  });

  it('行の数が違う', () => {
    expect(
      compareTables(table(['name', 'price'], [['Mug', 1200]]), expected, { ordered: false }),
    ).toEqual({
      reason: 'rowCount',
      message: '行の数が違います（あなた：1行／正解：2行）',
    });
  });

  it('値が違う（違う行の例を出す）', () => {
    const result = compareTables(
      table(
        ['name', 'price'],
        [
          ['Mug', 1200],
          ['Pen', 999],
        ],
      ),
      expected,
      { ordered: false },
    );
    expect(result.reason).toBe('values');
    expect(result.message).toContain('Pen');
  });

  it('ordered のときは、中身が同じでも並びが違えば order', () => {
    const swapped = table(
      ['name', 'price'],
      [
        ['Pen', 300],
        ['Mug', 1200],
      ],
    );
    expect(compareTables(swapped, expected, { ordered: true })).toEqual({
      reason: 'order',
      message: '行の順番が違います（中身は合っています）',
    });
  });
});

describe('findRuleViolation', () => {
  it('require の語がなければ、結果は正しいことと一緒に伝える', () => {
    expect(
      findRuleViolation('SELECT * FROM t WHERE price >= 500 AND price <= 2000', {
        require: ['BETWEEN'],
        forbid: [],
      }),
    ).toBe('結果は正しいです。ただし今回は BETWEEN を使って書いてみよう');
  });

  it('forbid の語があれば伝える', () => {
    expect(
      findRuleViolation('SELECT * FROM t WHERE id IN (SELECT id FROM t)', {
        require: [],
        forbid: ['IN'],
      }),
    ).toBe('結果は正しいです。ただし今回は IN を使わずに書いてみよう');
  });

  it('2語の語（IS NULL）も、大文字・小文字・改行を気にせず探す', () => {
    const rule = { require: ['IS NULL'], forbid: [] };
    expect(findRuleViolation('select * from t where supplier is\n null', rule)).toBe(null);
  });

  it('文字列やコメントの中の語は数えない', () => {
    const rule = { require: ['BETWEEN'], forbid: [] };
    expect(findRuleViolation("SELECT 'BETWEEN' FROM t -- BETWEEN", rule)).not.toBe(null);
  });

  it('条件がなければ null', () => {
    expect(findRuleViolation('SELECT 1', { require: [], forbid: [] })).toBe(null);
  });
});

describe('検証で見つかった取り違え', () => {
  it('NaN・Infinity は NULL とも互いとも違う', () => {
    const t = (v) => table(['x'], [[v]]);
    expect(compareTables(t(Number.NaN), t(null), { ordered: false })?.reason).toBe('values');
    expect(compareTables(t(Infinity), t(null), { ordered: false })?.reason).toBe('values');
    expect(compareTables(t(Infinity), t(-Infinity), { ordered: false })?.reason).toBe('values');
    expect(compareTables(t(Number.NaN), t(Number.NaN), { ordered: false })).toBe(null);
  });

  it('数値は許容誤差（相対 1e-9）で比べるので、丸めの境目をまたいでも同じ。差が大きければ違う', () => {
    const t = (v) => table(['x'], [[v]]);
    expect(compareTables(t(1.0000000004), t(1.0000000006), { ordered: false })).toBe(null);
    expect(compareTables(t(1.001), t(1.002), { ordered: false })?.reason).toBe('values');
  });

  it('数値の 1 と文字列の "1" は違う', () => {
    expect(
      compareTables(table(['x'], [[1]]), table(['x'], [['1']]), { ordered: false })?.reason,
    ).toBe('values');
  });

  it('列の名前が同じで並び順だけが違うと columnOrder', () => {
    const expected = table(['name', 'price'], [['Mug', 1200]]);
    expect(
      compareTables(table(['price', 'name'], [[1200, 'Mug']]), expected, { ordered: false }),
    ).toEqual({
      reason: 'columnOrder',
      message: '列の並び順が違います（正解：name, price の順）',
    });
  });
});

describe('findRuleViolation：検証で見つかった誤検知と見逃し', () => {
  it('t.in のような列名は、語の IN として数えない', () => {
    expect(findRuleViolation('SELECT t.in FROM t', { forbid: ['IN'] })).toBe(null);
  });

  it('ORDER, BY のように間に記号があれば ORDER BY ではない', () => {
    expect(findRuleViolation('SELECT ORDER, BY FROM t', { require: ['ORDER BY'] })).not.toBe(null);
  });

  it('COUNT は関数として使ったときだけ（別名の count では満たさない）', () => {
    expect(findRuleViolation('SELECT 30 AS count FROM t', { require: ['COUNT'] })).not.toBe(null);
    expect(findRuleViolation('SELECT count(*) FROM t', { require: ['COUNT'] })).toBe(null);
  });

  it('空の語が require にあっても黙って通らない', () => {
    expect(findRuleViolation('SELECT 1', { require: [''] })).not.toBe(null);
  });
});
