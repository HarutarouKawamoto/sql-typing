import { useEffect, useState } from 'react';
import { computeTypingStats, topWeakPoints } from '../../core/scoring.js';
import { localDate } from '../state/local-date.js';
import { isInteractiveTarget, isPlainEnter } from '../state/typing-keys.js';
import { useTypingSession } from '../state/use-typing-session.js';
import { ResultTable } from './ResultTable.jsx';
import { StepPlayer } from './StepPlayer.jsx';
import { TypingArea } from './TypingArea.jsx';
import { TypingResult } from './TypingResult.jsx';
import styles from './PlayMode1.module.css';

/**
 * モード1（なぞり書き）。真ん中に打つSQL、すぐ下に結果の表（句を打ち終えるたびに変わる）。
 * 打ち終えたら記録して結果を出す。結果で Enter を押すともう一度。
 * 結果の「ステップ再生を見る」で、表の欄がステップ再生（見える化A）に変わる。
 * @param {{
 *   problem: import('../../schema/problem-schema.js').Problem,
 *   keywords: string[],
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   replaySpeed: number,
 *   onRecord: (play: object) => import('../../schema/progress-schema.js').Progress,
 *   onReplayFinished: (problemId: string) => void,
 *   onRestart: () => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 * }} props
 */
export function PlayMode1({
  problem,
  keywords,
  runner,
  replaySpeed,
  onRecord,
  onReplayFinished,
  onRestart,
  onExit,
  saveFailed,
}) {
  const displaySql = problem.display ?? problem.answer;
  const [summary, setSummary] = useState(null);
  const [showReplay, setShowReplay] = useState(false);
  const session = useTypingSession({
    displaySql,
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
      // ボタン（ステップ再生を見る・戻る など）にフォーカスがあるときの Enter は、そのボタンに任せる
      if (isInteractiveTarget(event.target)) return;
      if (isPlainEnter(event)) {
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
        <>
          <TypingResult
            stats={summary.stats}
            elapsedMs={summary.elapsedMs}
            missCount={summary.missCount}
            thisTimeMistakes={summary.mistakes}
            weakPoints={summary.weakPoints}
            saveFailed={saveFailed}
          />
          {!showReplay && (
            <button
              type="button"
              className={styles.replayButton}
              onClick={() => setShowReplay(true)}
            >
              ステップ再生を見る（DBの中でどう動いたか）
            </button>
          )}
        </>
      )}
      {showReplay ? (
        <section className={styles.results} aria-label="ステップ再生">
          <h2 className={styles.heading}>ステップ再生（実行順に1句ずつ）</h2>
          <StepPlayer
            // SQLが変わったら段階を作り直す（古い段階と新しいSQLを組み合わせない）
            key={displaySql}
            sql={displaySql}
            runner={runner}
            speed={replaySpeed}
            onFinished={() => onReplayFinished(problem.id)}
          />
        </section>
      ) : (
        <section className={styles.results} aria-label="結果の表">
          <h2 className={styles.heading}>実行結果（句を打ち終えるたびに変わる）</h2>
          <ResultTable
            result={session.live.result}
            previousRowCount={session.live.previousRowCount}
            emptyMessage="FROM まで打つと、ここに表が出ます"
          />
        </section>
      )}
    </div>
  );
}
