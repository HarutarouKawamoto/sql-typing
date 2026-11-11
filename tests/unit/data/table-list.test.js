import { describe, it, expect } from 'vitest';
import { loadTableList } from '../../../src/data/table-list.js';

describe('loadTableList（作り物の runner）', () => {
  it('一覧のSQLが失敗したら投げる（書く画面は空の一覧で続ける）', async () => {
    const runner = {
      run: async () => ({ ok: false, error: { code: '42P01', message: 'x' } }),
    };
    await expect(loadTableList(runner)).rejects.toThrow('テーブルの一覧を読めませんでした');
  });

  it('打ち切りでも投げる', async () => {
    const runner = { run: async () => ({ ok: false, timeout: true }) };
    await expect(loadTableList(runner)).rejects.toThrow();
  });
});
