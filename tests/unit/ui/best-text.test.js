import { describe, it, expect } from 'vitest';
import { formatBest, MODE_LABELS } from '../../../src/ui/state/best-text.js';

describe('MODE_LABELS', () => {
  it('4つのモードの名前（用語集どおり）', () => {
    expect(MODE_LABELS).toEqual({
      1: 'なぞり書き',
      2: '打って選ぶ',
      3: 'ヒントありで書く',
      4: 'ヒントなしで書く',
    });
  });
});

describe('formatBest', () => {
  it('記録がなければ null', () => {
    expect(formatBest('1', undefined)).toBeNull();
  });

  it('モード1・2：速さ・正確さ・ランク', () => {
    expect(formatBest('2', { timeMs: 9000, cpm: 150, accuracy: 96, rank: 'B' })).toBe(
      '150 文字/分・正確さ 96%・ランク B',
    );
  });

  it('モード3：時間・実行の回数・ヒントの数。モード4はヒントなし', () => {
    expect(formatBest('3', { timeMs: 12345, runs: 2, hintsOpened: 1 })).toBe(
      '12.3 秒・実行 2 回・ヒント 1 個',
    );
    expect(formatBest('4', { timeMs: 5000, runs: 1 })).toBe('5.0 秒・実行 1 回');
  });
});
