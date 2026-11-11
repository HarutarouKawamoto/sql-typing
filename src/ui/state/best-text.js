/**
 * モードの名前と、最高記録の見せ方（一覧・モード選択で使う。React に依存しない）。
 */

/** モードの名前（docs/glossary.md の「モードの一覧」） */
export const MODE_LABELS = {
  1: 'なぞり書き',
  2: '打って選ぶ',
  3: 'ヒントありで書く',
  4: 'ヒントなしで書く',
};

/**
 * @param {'1' | '2' | '3' | '4'} mode
 * @param {{ timeMs: number, cpm?: number, accuracy?: number, rank?: string, runs?: number, hintsOpened?: number } | undefined} best
 * @returns {string | null} 記録がなければ null
 */
export function formatBest(mode, best) {
  if (!best) return null;
  if (mode === '1' || mode === '2') {
    return `${best.cpm} 文字/分・正確さ ${best.accuracy}%・ランク ${best.rank}`;
  }
  const base = `${(best.timeMs / 1000).toFixed(1)} 秒・実行 ${best.runs ?? '-'} 回`;
  return mode === '3' ? `${base}・ヒント ${best.hintsOpened ?? 0} 個` : base;
}
