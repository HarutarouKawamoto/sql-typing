import { useEffect, useState } from 'react';
import { compareChange } from '../../core/explain.js';
import { runDbJob } from '../state/db-jobs.js';
import { IndexRace } from './IndexRace.jsx';
import styles from './IndexRacePanel.module.css';

/**
 * インデックスあり・なしの比較を作って見せる枠。query を、changeSql を実行する前と後で比べる。
 * DB を使う仕事は runDbJob の列に入れる（判定・問題の準備と入り混じらないように）。changeSql が変わったら比べ直す。
 * @param {{
 *   runner: import('../../core/explain.js').Runner,
 *   query: string,
 *   changeSql: string,
 * }} props
 */
export function IndexRacePanel({ runner, query, changeSql }) {
  const key = `${query}\n${changeSql}`;
  const [state, setState] = useState(
    /** @type {{ key: string, result: Awaited<ReturnType<typeof compareChange>> } | { key: string, error: string } | null} */ (
      null
    ),
  );

  useEffect(() => {
    let active = true;
    runDbJob(() => compareChange({ runner, query, changeSql })).then(
      (result) => active && setState({ key, result }),
      (error) => {
        console.error(error);
        if (active) setState({ key, error: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [runner, query, changeSql, key]);

  // 比べ直している間は、前のSQLの結果を出さない
  const current = state?.key === key ? state : null;
  return (
    <section
      className={styles.panel}
      aria-label="インデックスあり・なしの比較"
      data-testid="index-race-panel"
    >
      <h2 className={styles.heading}>見える化：インデックスあり・なしの比較</h2>
      <p className={styles.query}>
        比べる問い合わせ：<code>{query}</code>
      </p>
      {/* 読み上げの枠は先に置いておき、中身だけを変える（中身ごと出すと読み上げない環境があるため） */}
      <p className={current === null ? styles.status : styles.srOnly} role="status">
        {current === null && '実行計画を取っています…'}
        {current &&
          'result' in current &&
          current.result.ok &&
          `読んだ行は ${current.result.before.rowsRead} 行から ${current.result.after.rowsRead} 行になりました。`}
      </p>
      {current && 'error' in current && (
        <p className={styles.error} role="alert">
          比べられませんでした（{current.error}）
        </p>
      )}
      {current && 'result' in current && !current.result.ok && (
        <p className={styles.error} role="alert">
          {current.result.stage === 'change'
            ? `書いたSQLを実行できなかったので、比べられませんでした（${current.result.message}）`
            : `問い合わせを実行できませんでした（${current.result.message}）`}
        </p>
      )}
      {current && 'result' in current && current.result.ok && (
        <IndexRace before={current.result.before} after={current.result.after} />
      )}
    </section>
  );
}
