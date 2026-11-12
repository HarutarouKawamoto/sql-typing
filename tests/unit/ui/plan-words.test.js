import { describe, it, expect } from 'vitest';
import {
  fitText,
  relationText,
  resultText,
  rowsText,
  textUnits,
  timeText,
} from '../../../src/ui/state/plan-words.js';

const node = (extra) => ({
  nodeType: 'Seq Scan',
  relation: null,
  alias: null,
  index: null,
  rows: 0,
  removed: 0,
  loops: 1,
  totalMs: 0,
  subplan: false,
  children: [],
  ...extra,
});

describe('節の文字', () => {
  it('行の数は3桁ごとに区切る', () => {
    expect(rowsText(50000)).toBe('50,000行');
  });

  it('テーブルは、別名がテーブル名と違うときだけ添える', () => {
    expect(relationText(node({ relation: 'access_logs', alias: 'l' }))).toBe('access_logs l');
    expect(relationText(node({ relation: 'customers', alias: 'customers' }))).toBe('customers');
    expect(relationText(node({}))).toBeNull();
  });

  it('返した行：2回以上は回数、実行されなかった節はそう書く', () => {
    expect(resultText(node({ rows: 10 }))).toBe('10行を返す');
    expect(resultText(node({ rows: 10000, loops: 5000 }))).toBe('10,000行を返す（5,000回）');
    expect(resultText(node({ loops: 0 }))).toBe('実行されなかった');
  });

  it('かかった時間：測れないほど短いときはそう書く', () => {
    expect(timeText(0)).toBe('0.001 ms 未満');
    expect(timeText(1.5)).toBe('1.500 ms');
  });
});

describe('fitText', () => {
  it('英数字は日本語より細く数える', () => {
    expect(textUnits('ab')).toBeCloseTo(1.2);
    expect(textUnits('索引')).toBe(2);
  });

  it('収まるならそのまま、収まらなければ後ろを「…」にして幅の中に収める', () => {
    expect(fitText('customers', 10)).toBe('customers');
    const long = '索引 access_logs_session_id_idx';
    const fitted = fitText(long, 15);
    expect(fitted.endsWith('…')).toBe(true);
    expect(textUnits(fitted)).toBeLessThanOrEqual(15);
    expect(long.startsWith(fitted.slice(0, -1))).toBe(true);
  });
});
