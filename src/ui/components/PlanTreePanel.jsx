import { useEffect, useState } from 'react';
import { explainQuery } from '../../core/explain.js';
import { runDbJob } from '../state/db-jobs.js';
import { PlanTree } from './PlanTree.jsx';
import styles from './PlanTreePanel.module.css';

/**
 * 実行計画の木を作って見せる枠。初期状態の DB で query を EXPLAIN ANALYZE する。
 * DB を使う仕事は runDbJob の列に入れる（判定・問題の準備と入り混じらないように）。
 * @param {{ runner: import('../../core/explain.js').Runner, query: string }} props
 */
export function PlanTreePanel({ runner, query }) {
  const [state, setState] = useState(
    /** @type {{ query: string, result: Awaited<ReturnType<typeof explainQuery>> } | { query: string, error: string } | null} */ (
      null
    ),
  );

  useEffect(() => {
    let active = true;
    runDbJob(() => explainQuery({ runner, query })).then(
      (result) => active && setState({ query, result }),
      (error) => {
        console.error(error);
        if (active) setState({ query, error: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [runner, query]);

  // 取り直している間は、前のSQLの木を出さない
  const current = state?.query === query ? state : null;
  const summary =
    current && 'result' in current && current.result.ok ? current.result.summary : null;
  return (
    <section className={styles.panel} aria-label="実行計画の木" data-testid="plan-tree-panel">
      <h2 className={styles.heading}>見える化：実行計画の木</h2>
      <p className={styles.query}>
        問い合わせ：<code>{query}</code>
      </p>
      {/* 読み上げの枠は先に置いておき、中身だけを変える（中身ごと出すと読み上げない環境があるため） */}
      <p className={current === null ? styles.status : styles.srOnly} role="status">
        {current === null && '実行計画を取っています…'}
        {summary &&
          `実行計画ができました。テーブルから ${summary.rowsRead.toLocaleString('ja-JP')} 行を読みました。`}
      </p>
      {current && 'error' in current && (
        <p className={styles.error} role="alert">
          実行計画を取れませんでした（{current.error}）
        </p>
      )}
      {current && 'result' in current && !current.result.ok && (
        <p className={styles.error} role="alert">
          実行計画を取れませんでした（{current.result.message}）
        </p>
      )}
      {summary && <PlanTree summary={summary} />}
    </section>
  );
}
