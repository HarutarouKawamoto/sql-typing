import { useEffect, useState } from 'react';
import { computeTypingStats, topWeakPoints } from '../../core/scoring.js';
import { useTypingSession } from '../state/use-typing-session.js';
import { ResultTable } from './ResultTable.jsx';
import { TypingArea } from './TypingArea.jsx';
import { TypingResult } from './TypingResult.jsx';
import styles from './PlayMode1.module.css';

/** 'YYYY-MM-DD'（その人のタイムゾーンの日付。日ごとの記録に使う） */
function localDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * モード1（なぞり書き）。左に打つSQL、右に結果の表（句を打ち終えるたびに変わる）。
 * 打ち終えたら記録して結果を出す。結果で Enter を押すともう一度。
 * @param {{
 *   problem: import('../../schema/problem-schema.js').Problem,
 *   keywords: string[],
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   onRecord: (play: object) => import('../../schema/progress-schema.js').Progress,
 *   onRestart: () => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 * }} props
 */
export function PlayMode1({ problem, keywords, runner, onRecord, onRestart, onExit, saveFailed }) {
  const [summary, setSummary] = useState(null);
  const session = useTypingSession({
    displaySql: problem.display ?? problem.answer,
    keywords,
    runner,
    onExit,
    onDone: ({ okCount, missCount, elapsedMs, mistakes, typed }) => {
      const stats = computeTypingStats({ okCount, missCount, elapsedMs });
      const progress = onRecord({
        problemId: problem.id,
        mode: '1',
        cleared: true,
        date: localDate(new Date()),
        best: { timeMs: Math.round(elapsedMs), ...stats },
        mistakes,
        typed,
      });
      setSummary({
        stats,
        elapsedMs,
        missCount,
        mistakes,
        weakPoints: topWeakPoints(progress.mistakes, progress.typed),
      });
    },
  });

  // 結果を出しているときの Enter でもう一度
  useEffect(() => {
    if (!summary) return undefined;
    const onKeyDown = (event) => {
      // 最後のキーを押しっぱなしにしたときの繰り返しで、すぐにやり直しにならないように
      if (event.key === 'Enter' && !event.repeat && !event.isComposing) {
        event.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [summary, onRestart]);

  const live = computeTypingStats({
    okCount: session.typing.okCount,
    missCount: session.typing.missCount,
    elapsedMs: session.elapsedMs,
  });

  return (
    <div className={styles.play}>
      <header className={styles.bar}>
        <span className={styles.badge}>モード1 なぞり書き</span>
        <span className={styles.problemTitle}>{problem.title}</span>
        <span className={styles.meter} data-testid="meter">
          {(session.elapsedMs / 1000).toFixed(1)}秒 ・ {live.cpm} 文字/分 ・ 正確さ {live.accuracy}%
        </span>
      </header>
      {/* 打っている間に目が行く入力エリアを真ん中に大きく。表はすぐ下に置き、打った瞬間の変化が視線を少し下げるだけで見えるようにする */}
      <section className={styles.stage} aria-label="打つところ">
        <p className={styles.guide}>
          表示されたSQLをそのまま打ちましょう（大文字・小文字はどちらでも）。Esc でもどる。
        </p>
        {session.imeWarning && (
          <p className={styles.warning} role="alert">
            日本語入力がオンになっています。半角英数に切り替えてください。
          </p>
        )}
        <TypingArea target={session.target} typing={session.typing} missPulse={session.missPulse} />
      </section>
      {summary && (
        <TypingResult
          stats={summary.stats}
          elapsedMs={summary.elapsedMs}
          missCount={summary.missCount}
          thisTimeMistakes={summary.mistakes}
          weakPoints={summary.weakPoints}
          saveFailed={saveFailed}
        />
      )}
      <section className={styles.results} aria-label="結果の表">
        <h2 className={styles.heading}>実行結果（句を打ち終えるたびに変わる）</h2>
        <ResultTable
          result={session.live.result}
          previousRowCount={session.live.previousRowCount}
          emptyMessage="FROM まで打つと、ここに表が出ます"
        />
      </section>
    </div>
  );
}
