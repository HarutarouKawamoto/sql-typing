import { useEffect, useRef } from 'react';
import styles from './WriteResult.module.css';

/**
 * モード3・4のクリアの結果：かかった時間・実行した回数・（モード3）開いたヒントの数。
 * 出たら見出しにフォーカスを移す（入力欄から外れ、結果のキー（Enter・J で次の問題へ、R でもう一度）が効くように）。
 * @param {{ elapsedMs: number, runs: number, hintsOpened: number | null, saveFailed: boolean }} props
 *   hintsOpened：モード4は null（ヒントがない）
 */
export function WriteResult({ elapsedMs, runs, hintsOpened, saveFailed }) {
  const heading = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className={styles.result} aria-labelledby="write-result-title">
      <h2 id="write-result-title" className={styles.title} ref={heading} tabIndex={-1}>
        クリア！
      </h2>
      <dl className={styles.stats}>
        <div>
          <dt>時間</dt>
          <dd data-testid="result-time">{(elapsedMs / 1000).toFixed(1)} 秒</dd>
        </div>
        <div>
          <dt>実行した回数</dt>
          <dd data-testid="result-runs">{runs} 回</dd>
        </div>
        {hintsOpened !== null && (
          <div>
            <dt>開いたヒント</dt>
            <dd data-testid="result-hints">{hintsOpened} 個</dd>
          </div>
        )}
      </dl>
      {saveFailed && <p className={styles.warning}>この環境では記録が保存されません。</p>}
    </section>
  );
}
