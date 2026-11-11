import styles from './TypingResult.module.css';

/**
 * なぞり書き（モード1）の結果。速さ・正確さ・時間・ランクと、今回まちがえたところ・苦手の上位3つ。
 * @param {{
 *   stats: { cpm: number, accuracy: number, rank: string },
 *   elapsedMs: number,
 *   missCount: number,
 *   thisTimeMistakes: Record<string, number>,
 *   weakPoints: { key: string, rate: number, mistakes: number, typed: number }[],
 *   saveFailed: boolean,
 * }} props
 */
export function TypingResult({
  stats,
  elapsedMs,
  missCount,
  thisTimeMistakes,
  weakPoints,
  saveFailed,
}) {
  const mistakes = Object.entries(thisTimeMistakes).sort((a, b) => b[1] - a[1]);
  return (
    <section className={styles.result} aria-labelledby="typing-result-title">
      <h2 id="typing-result-title" className={styles.title}>
        クリア！
      </h2>
      <dl className={styles.stats}>
        <div>
          <dt>ランク</dt>
          <dd className={styles.rank} data-testid="rank">
            {stats.rank}
          </dd>
        </div>
        <div>
          <dt>速さ</dt>
          <dd>{stats.cpm} 文字/分</dd>
        </div>
        <div>
          <dt>正確さ</dt>
          <dd>{stats.accuracy}%</dd>
        </div>
        <div>
          <dt>時間</dt>
          <dd>{(elapsedMs / 1000).toFixed(1)} 秒</dd>
        </div>
        <div>
          <dt>ミス</dt>
          <dd>{missCount} 回</dd>
        </div>
      </dl>

      <h3 className={styles.subtitle}>今回まちがえたところ</h3>
      {mistakes.length === 0 ? (
        <p>なし。完ぺきです。</p>
      ) : (
        <ul className={styles.list}>
          {mistakes.map(([key, count]) => (
            <li key={key}>
              <code>{key}</code> × {count}
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.subtitle}>苦手な記号・キーワード（これまでの合計）</h3>
      {weakPoints.length === 0 ? (
        <p className={styles.muted}>
          まだ数えている途中です（同じ記号・キーワードを20回打つと出ます）。
        </p>
      ) : (
        <ol className={styles.list}>
          {weakPoints.map(({ key, mistakes: missed, typed }) => (
            <li key={key}>
              <code>{key}</code>：{typed} 回打って {missed} 回ミス
            </li>
          ))}
        </ol>
      )}

      {saveFailed && <p className={styles.warning}>この環境では記録が保存されません。</p>}
      <p className={styles.keys}>Enter：もう一度 ／ Esc：もどる</p>
    </section>
  );
}
