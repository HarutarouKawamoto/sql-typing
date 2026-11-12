import { describe, it, expect } from 'vitest';
import { buildReorderChips } from '../../../src/core/reorder.js';

describe('buildReorderChips', () => {
  it('句ごとのチップを書いた順に返し、実行順の番号を付ける', () => {
    const chips = buildReorderChips(
      'SELECT name, price FROM products WHERE price >= 1000 ORDER BY price DESC LIMIT 5',
    );
    expect(chips).toEqual([
      { kind: 'SELECT', label: 'SELECT name, price', writtenOrder: 1, execOrder: 3 },
      { kind: 'FROM', label: 'FROM products', writtenOrder: 2, execOrder: 1 },
      { kind: 'WHERE', label: 'WHERE price >= 1000', writtenOrder: 3, execOrder: 2 },
      { kind: 'ORDER BY', label: 'ORDER BY price DESC', writtenOrder: 4, execOrder: 4 },
      { kind: 'LIMIT', label: 'LIMIT 5', writtenOrder: 5, execOrder: 5 },
    ]);
  });

  it('句の中の空白・改行は1つの空白にまとめる', () => {
    const chips = buildReorderChips('select  name\n  from\tproducts\n');
    expect(chips?.map((chip) => chip.label)).toEqual(['select name', 'from products']);
  });

  it('長い句は maxLength 文字に切って「…」を付ける', () => {
    const chips = buildReorderChips(
      "SELECT name FROM products WHERE category = 'kitchen' AND stock < 5",
      20,
    );
    const where = chips?.find((chip) => chip.kind === 'WHERE');
    expect(where?.label).toBe("WHERE category = 'k…");
    expect(where?.label).toHaveLength(20);
  });

  it('ちょうど maxLength 文字の句は切らない', () => {
    const chips = buildReorderChips('SELECT abc FROM t', 10);
    expect(chips?.[0].label).toBe('SELECT abc');
  });

  it('句が1つだけ（入れ替わりがない）なら null', () => {
    expect(buildReorderChips('SELECT 1')).toBeNull();
  });

  it('句に分けられないSQLは null', () => {
    expect(buildReorderChips('DELETE FROM products')).toBeNull();
    expect(buildReorderChips('SELECT * WHERE x = 1 FROM t')).toBeNull();
    expect(buildReorderChips('')).toBeNull();
  });

  it('括弧の中・文字列の中のキーワードでは分けない', () => {
    const chips = buildReorderChips("SELECT name FROM products WHERE name = 'FROM'");
    expect(chips?.map((chip) => chip.kind)).toEqual(['SELECT', 'FROM', 'WHERE']);
  });
});
