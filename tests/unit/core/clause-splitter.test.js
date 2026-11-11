import { describe, it, expect } from 'vitest';
import { splitClauses, canRunWhileTyping } from '../../../src/core/clause-splitter.js';

describe('canRunWhileTyping', () => {
  it('句に分けられる SELECT は true（先頭にコメントがあってもよい）', () => {
    expect(canRunWhileTyping('SELECT * FROM products')).toBe(true);
    expect(canRunWhileTyping('-- 一覧\nSELECT * FROM products')).toBe(true);
  });

  it('書き換え系・括弧の外に INTO がある SELECT・分けられないSQLは false', () => {
    expect(canRunWhileTyping('UPDATE products SET price = 0')).toBe(false);
    expect(canRunWhileTyping('SELECT * INTO copy FROM products')).toBe(false);
    expect(canRunWhileTyping('SELECT a FROM t ORDER BY a WHERE x = 1')).toBe(false);
  });

  it('文字列や括弧の中の INTO は気にしない', () => {
    expect(canRunWhileTyping("SELECT 'INTO' FROM products")).toBe(true);
  });
});

const shape = (sql) => {
  const { ok, clauses } = splitClauses(sql);
  return {
    ok,
    clauses: clauses.map((c) => [c.kind, sql.slice(c.start, c.end), c.writtenOrder, c.execOrder]),
  };
};

describe('splitClauses', () => {
  it('SELECT と FROM に分ける。実行順は FROM が先', () => {
    expect(shape('SELECT * FROM products')).toEqual({
      ok: true,
      clauses: [
        ['SELECT', 'SELECT *', 1, 2],
        ['FROM', 'FROM products', 2, 1],
      ],
    });
  });

  it('WHERE・ORDER BY・LIMIT を含むSQL（実行順は FROM → WHERE → SELECT → ORDER BY → LIMIT）', () => {
    expect(
      shape('SELECT name, price FROM products WHERE stock > 0 ORDER BY price DESC LIMIT 5'),
    ).toEqual({
      ok: true,
      clauses: [
        ['SELECT', 'SELECT name, price', 1, 3],
        ['FROM', 'FROM products', 2, 1],
        ['WHERE', 'WHERE stock > 0', 3, 2],
        ['ORDER BY', 'ORDER BY price DESC', 4, 4],
        ['LIMIT', 'LIMIT 5', 5, 5],
      ],
    });
  });

  it('GROUP BY と HAVING の実行順は WHERE の後・SELECT の前', () => {
    const { clauses } = shape(
      'SELECT category, count(*) FROM products WHERE stock > 0 GROUP BY category HAVING count(*) > 1',
    );
    expect(clauses.map(([kind, , , exec]) => [kind, exec])).toEqual([
      ['SELECT', 5],
      ['FROM', 1],
      ['WHERE', 2],
      ['GROUP BY', 3],
      ['HAVING', 4],
    ]);
  });

  it('改行や小文字でも分けられ、句の後ろの空白は含めない', () => {
    expect(shape('select name\nfrom products\n  where price > 1\n')).toEqual({
      ok: true,
      clauses: [
        ['SELECT', 'select name', 1, 3],
        ['FROM', 'from products', 2, 1],
        ['WHERE', 'where price > 1', 3, 2],
      ],
    });
  });

  it('括弧の中・文字列の中のキーワードでは区切らない', () => {
    const { clauses } = shape(
      "SELECT name FROM products WHERE id IN (SELECT id FROM products WHERE name = 'FROM X')",
    );
    expect(clauses.map(([kind]) => kind)).toEqual(['SELECT', 'FROM', 'WHERE']);
  });

  it('OFFSET は LIMIT の句の一部、DISTINCT は SELECT の句の一部', () => {
    expect(shape('SELECT DISTINCT category FROM products LIMIT 2 OFFSET 1').clauses).toEqual([
      ['SELECT', 'SELECT DISTINCT category', 1, 2],
      ['FROM', 'FROM products', 2, 1],
      ['LIMIT', 'LIMIT 2 OFFSET 1', 3, 3],
    ]);
  });

  it('打っている途中（SELECT だけ）でも分けられる', () => {
    expect(shape('SELECT *')).toEqual({ ok: true, clauses: [['SELECT', 'SELECT *', 1, 1]] });
  });

  it('SELECT で始まらないSQLは ok: false', () => {
    expect(splitClauses('UPDATE products SET price = 0').ok).toBe(false);
    expect(splitClauses('').ok).toBe(false);
  });

  it('同じ句が2回・文法の順番でない並びは ok: false', () => {
    expect(splitClauses('SELECT a FROM t WHERE x = 1 WHERE y = 2').ok).toBe(false);
    expect(splitClauses('SELECT a FROM t ORDER BY a WHERE x = 1').ok).toBe(false);
  });

  it('ORDER と BY の間に改行があっても1つの句', () => {
    expect(shape('SELECT a FROM t ORDER\n  BY a').clauses.at(-1)).toEqual([
      'ORDER BY',
      'ORDER\n  BY a',
      3,
      3,
    ]);
  });
});
