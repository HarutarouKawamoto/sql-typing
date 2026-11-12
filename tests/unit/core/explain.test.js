import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseExplain, rowsRead, scanKinds } from '../../../src/core/explain.js';

/** PGlite の EXPLAIN (ANALYZE, FORMAT JSON) の実際の出力（上級の初期データ） */
const fixture = (name) =>
  readFileSync(new URL(`../../helpers/fixtures/explain/${name}.json`, import.meta.url), 'utf8');

describe('parseExplain', () => {
  it('JSON の文字列（PGlite はこの形で返す）を計画の木と時間にする', () => {
    const { plan, executionMs, planningMs } = parseExplain(fixture('seq-scan'));
    expect(plan).toMatchObject({
      nodeType: 'Seq Scan',
      relation: 'access_logs',
      index: null,
      rows: 1,
      removed: 49999,
      loops: 1,
      children: [],
    });
    expect(executionMs).toBeGreaterThan(0);
    expect(planningMs).toBeGreaterThanOrEqual(0);
  });

  it('解いたもの（配列）も受け取る', () => {
    expect(parseExplain(JSON.parse(fixture('index-scan'))).plan.nodeType).toBe('Index Scan');
  });

  it('入れ子（集計 → Hash Join → Seq Scan・Hash → Seq Scan）を子として持つ', () => {
    const { plan } = parseExplain(fixture('join'));
    expect(plan.nodeType).toBe('Aggregate');
    const join = plan.children[0];
    expect(join.nodeType).toBe('Hash Join');
    expect(join.children.map((c) => c.nodeType)).toEqual(['Seq Scan', 'Hash']);
    expect(join.children[1].children[0]).toMatchObject({
      nodeType: 'Seq Scan',
      relation: 'customers',
    });
  });

  it('形の違うものは例外', () => {
    expect(() => parseExplain('not json')).toThrow();
    expect(() => parseExplain('[]')).toThrow();
  });
});

describe('rowsRead', () => {
  it('Seq Scan：返した行と条件で取り除いた行の合計（全部の行を読む）', () => {
    expect(rowsRead(parseExplain(fixture('seq-scan')).plan)).toBe(50000);
  });

  it('Index Scan：索引で見つけた行だけ', () => {
    expect(rowsRead(parseExplain(fixture('index-scan')).plan)).toBe(1);
  });

  it('Bitmap Heap Scan：索引で集めた行（Bitmap Index Scan は数えない）', () => {
    const { plan } = parseExplain(fixture('bitmap'));
    expect(rowsRead(plan)).toBe(plan.rows + plan.removed);
    expect(rowsRead(plan)).toBeLessThan(50000);
  });

  it('入れ子は、テーブルを読む節を全部足す', () => {
    expect(rowsRead(parseExplain(fixture('join')).plan)).toBe(50000 + 10);
  });

  it('ループのある節は、返した行・取り除いた行に回数を掛ける', () => {
    const plan = {
      nodeType: 'Index Scan',
      relation: 't',
      alias: 't',
      index: 'i',
      rows: 3,
      removed: 1,
      loops: 5,
      totalMs: 0,
      children: [],
    };
    expect(rowsRead(plan)).toBe(4);
  });
});

describe('rowsRead：ループ・小数・実行されなかった節', () => {
  it('Nested Loop の内側（Memoize の下の Index Scan）は、返した行に回数を掛けて足す（実物）', () => {
    const raw = JSON.parse(fixture('nested-loop'));
    const { plan } = parseExplain(raw);
    expect(plan.nodeType).toBe('Nested Loop');
    const inner = raw[0].Plan.Plans[1].Plans[0];
    expect(inner['Node Type']).toBe('Index Scan');
    expect(rowsRead(plan)).toBe(50000 + Math.round(inner['Actual Rows'] * inner['Actual Loops']));
  });

  it('Index Only Scan も、索引で見つけた行だけ（実物）', () => {
    const { plan } = parseExplain(fixture('index-only'));
    expect(plan.nodeType).toBe('Index Only Scan');
    expect(rowsRead(plan)).toBe(1);
  });

  it('Actual Rows は1回あたりの平均で小数になる。回数を掛けて丸める', () => {
    const raw = [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Relation Name': 't',
          'Actual Rows': 0.7,
          'Actual Loops': 3,
          'Rows Removed by Filter': 0.1,
        },
        'Execution Time': 1,
        'Planning Time': 0,
      },
    ];
    const { plan } = parseExplain(raw);
    expect(plan.rows).toBe(2);
    expect(plan.removed).toBe(0);
    expect(Number.isInteger(rowsRead(plan))).toBe(true);
  });

  it('実行されなかった節（loops 0）は loops 0 のまま、行は0', () => {
    const raw = [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 't',
          'Actual Rows': 0,
          'Actual Loops': 0,
        },
        'Execution Time': 0,
        'Planning Time': 0,
      },
    ];
    const { plan } = parseExplain(raw);
    expect(plan.loops).toBe(0);
    expect(rowsRead(plan)).toBe(0);
  });
});

describe('scanKinds', () => {
  it('テーブルを読む節の、読み方・テーブル・インデックス', () => {
    expect(scanKinds(parseExplain(fixture('seq-scan')).plan)).toEqual([
      { nodeType: 'Seq Scan', relation: 'access_logs', index: null },
    ]);
    expect(scanKinds(parseExplain(fixture('index-scan')).plan)).toEqual([
      { nodeType: 'Index Scan', relation: 'access_logs', index: 'access_logs_session_id_idx' },
    ]);
    expect(scanKinds(parseExplain(fixture('bitmap')).plan)).toEqual([
      { nodeType: 'Bitmap Heap Scan', relation: 'access_logs', index: 'access_logs_path_idx' },
    ]);
  });
});
