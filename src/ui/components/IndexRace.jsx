import { NODE_WORDS, timeText } from '../state/plan-words.js';
import { useCountUp } from '../state/use-count-up.js';
import styles from './IndexRace.module.css';

/** カウンターが最後の数になるまでの長さ */
const COUNT_MS = 1200;

/**
 * 1つの列（インデックスなし・あり）。
 * @param {{ title: string, summary: import('../../core/explain.js').ExplainSummary, max: number, testId: string }} props
 */
function Lane({ title, summary, max, testId }) {
  const count = useCountUp(summary.rowsRead, COUNT_MS);
  // 棒もカウンターと一緒に伸ばす（最初から最後の長さで出すと、比べる動きにならない）
  const width = max > 0 ? (count / max) * 100 : 0;
  return (
    <section className={styles.lane} aria-label={title} data-testid={testId}>
      <h3 className={styles.title}>{title}</h3>
      <ul className={styles.scans}>
        {summary.scans.map((scan, i) => (
          <li key={i}>
            <code className={styles.node}>{scan.nodeType}</code>
            {scan.relation && <span className={styles.muted}>（{scan.relation}）</span>}
            <span>{NODE_WORDS[scan.nodeType] ?? ''}</span>
            {scan.index && <span className={styles.muted}>索引：{scan.index}</span>}
          </li>
        ))}
      </ul>
      <p className={styles.counter}>
        読んだ行：
        <strong data-testid={`${testId}-rows`} data-rows={summary.rowsRead}>
          {count.toLocaleString('ja-JP')}
        </strong>
        行
      </p>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} style={{ width: `${width}%` }} />
      </div>
      <p className={styles.time}>
        かかった時間：<strong>{timeText(summary.executionMs)}</strong>
      </p>
    </section>
  );
}

/**
 * 上級の見える化「インデックスあり・なしの比較」。同じ問い合わせの、変える前と後の読んだ行の数・時間・読み方を左右に並べる。
 * @param {{
 *   before: import('../../core/explain.js').ExplainSummary,
 *   after: import('../../core/explain.js').ExplainSummary,
 *   labels?: [string, string],
 * }} props
 */
export function IndexRace({ before, after, labels = ['インデックスなし', 'インデックスあり'] }) {
  const max = Math.max(before.rowsRead, after.rowsRead);
  const times =
    before.executionMs > 0 && after.executionMs > 0 ? before.executionMs / after.executionMs : null;
  return (
    <div className={styles.race} data-testid="index-race">
      <div className={styles.lanes}>
        <Lane title={labels[0]} summary={before} max={max} testId="race-before" />
        <Lane title={labels[1]} summary={after} max={max} testId="race-after" />
      </div>
      <p className={styles.result}>
        読んだ行は {before.rowsRead.toLocaleString('ja-JP')} →{' '}
        {after.rowsRead.toLocaleString('ja-JP')} 行。
        {times !== null && times >= 1.5 && `時間はおよそ ${Math.round(times)} 分の1。`}
        {times !== null && times < 1.5 && times > 0.67 && '時間はほとんど変わりませんでした。'}
        {times !== null && times <= 0.67 && '時間は、かえって長くなりました。'}
        {after.executionMs === 0 &&
          before.executionMs > 0 &&
          '時間は、測れないほど短くなりました。'}
      </p>
    </div>
  );
}
