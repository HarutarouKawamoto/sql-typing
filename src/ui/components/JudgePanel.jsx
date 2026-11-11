import styles from './JudgePanel.module.css';

/** 判定の結果ごとの見出し（正解は WriteResult が出す） */
const HEADINGS = {
  wrong: '不正解',
  ruleViolation: 'あと一歩',
  timeout: '打ち切り',
};

/**
 * 判定の結果：不正解の理由・条件違反・和訳したエラー（英語の原文は折りたたみ）・打ち切り。
 * @param {{ result: import('../../core/judge.js').JudgeResult | null, judging: boolean, run: number }} props
 *   run：何回目の実行の結果か（同じ説明が続いても、新しい結果だとわかるように出す）
 */
export function JudgePanel({ result, judging, run }) {
  if (judging) {
    return (
      <p className={styles.status} role="status" data-testid="judge-panel" data-status="judging">
        判定しています…
      </p>
    );
  }
  if (!result || result.status === 'correct') return null;

  if (result.status === 'error' && result.error) {
    const { title, causes, original, code } = result.error;
    return (
      <section
        className={`${styles.panel} ${styles.error}`}
        role="alert"
        data-testid="judge-panel"
        data-status="error"
      >
        <h2 className={styles.heading}>
          エラー：{title}
          <span className={styles.run}>（{run}回目の実行）</span>
        </h2>
        {causes.length > 0 && (
          <>
            <p className={styles.label}>よくある原因</p>
            <ul className={styles.causes}>
              {causes.map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          </>
        )}
        <details className={styles.original}>
          <summary>PostgreSQL のメッセージ（英語）</summary>
          <code>
            {code ? `${code}: ` : ''}
            {original}
          </code>
        </details>
        <p className={styles.next}>直して、もう一度 Ctrl+Enter で実行しましょう。</p>
      </section>
    );
  }

  return (
    <section
      className={`${styles.panel} ${result.status === 'ruleViolation' ? styles.almost : styles.error}`}
      role="alert"
      data-testid="judge-panel"
      data-status={result.status}
      data-reason={result.reason}
    >
      <h2 className={styles.heading}>
        {HEADINGS[result.status] ?? result.status}
        <span className={styles.run}>（{run}回目の実行）</span>
      </h2>
      <p className={styles.message}>{result.message}</p>
      <p className={styles.next}>直して、もう一度 Ctrl+Enter で実行しましょう。</p>
    </section>
  );
}
