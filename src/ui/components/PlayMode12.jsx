import { useMemo, useState } from 'react';
import { maskBlankAnswers } from '../../core/blank-typing.js';
import { computeTypingStats, topWeakPoints } from '../../core/scoring.js';
import { localDate } from '../state/local-date.js';
import { useTypingSession } from '../state/use-typing-session.js';
import { ResultTable } from './ResultTable.jsx';
import { StepPlayer } from './StepPlayer.jsx';
import { TypingArea } from './TypingArea.jsx';
import { TypingResult } from './TypingResult.jsx';
import { ChoiceList } from './ChoiceList.jsx';
import { SchemaMapPanel } from './SchemaMapPanel.jsx';
import { StoryLines } from './StoryLines.jsx';
import styles from './PlayMode12.module.css';

const MODE_NAMES = { 1: 'モード1 なぞり書き', 2: 'モード2 打って選ぶ' };
const GUIDES = {
  1: '表示されたSQLをそのまま打ちましょう（大文字・小文字はどちらでも）。Esc でもどる。',
  2: '空欄の外はそのまま打ち、「？」の空欄は下の選択肢を打って選びましょう。Esc でもどる。',
};

/**
 * モード1（なぞり書き）・モード2（打って選ぶ）。真ん中に打つSQL、すぐ下に結果の表（句を打ち終えるたびに変わる）。
 * モード2は空欄を「？」の箱で隠し、空欄に来たら選択肢を出す（判定は blank-typing.js）。
 * 打ち終えたら記録して結果を出す。結果のキー（次の問題へ・もう一度）は afterClear（AfterStory）が受ける。
 * 結果の「ステップ再生を見る」で、表の欄がステップ再生（見える化A）に変わる。
 * @param {{
 *   problem: import('../../schema/problem-schema.js').Problem,
 *   chapter: import('../../schema/chapter-schema.js').Chapter,
 *   mode: '1' | '2',
 *   keywords: string[],
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   replaySpeed: number,
 *   onRecord: (play: object) => import('../../schema/progress-schema.js').Progress,
 *   onReplayFinished: (problemId: string) => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 *   afterClear?: import('react').ReactNode,
 * }} props
 */
export function PlayMode12({
  problem,
  chapter,
  mode,
  keywords,
  runner,
  replaySpeed,
  onRecord,
  onReplayFinished,
  onExit,
  saveFailed,
  afterClear = null,
}) {
  const displaySql = problem.display ?? problem.answer;
  // DBの地図で光らせるSQL。モード2は空欄の答えを抜く（空欄にテーブル名があっても、地図で答えがわからないように）
  const mapSql = useMemo(
    () => (mode === '2' ? maskBlankAnswers(displaySql, problem.blanks) : displaySql),
    [mode, displaySql, problem.blanks],
  );
  const [summary, setSummary] = useState(null);
  const [showReplay, setShowReplay] = useState(false);
  const session = useTypingSession({
    displaySql,
    keywords,
    runner,
    onExit,
    // モード1は空欄なし（problem.blanks は毎回同じ配列なので、空欄の状態を作り直さない）
    blanks: mode === '2' ? problem.blanks : undefined,
    onDone: ({ okCount, missCount, elapsedMs, mistakes, typed, wrongChoices }) => {
      const stats = computeTypingStats({ okCount, missCount, elapsedMs });
      const progress = onRecord({
        problemId: problem.id,
        mode,
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
        wrongChoices,
        weakPoints: topWeakPoints(progress.mistakes, progress.typed),
      });
    },
  });

  const live = computeTypingStats({
    okCount: session.typing.okCount,
    missCount: session.typing.missCount,
    elapsedMs: session.elapsedMs,
  });

  return (
    <div className={styles.play}>
      <header className={styles.bar}>
        <span className={styles.badge}>{MODE_NAMES[mode]}</span>
        <span className={styles.problemTitle}>{problem.title}</span>
        <span className={styles.meter} data-testid="meter">
          {(session.elapsedMs / 1000).toFixed(1)}秒 ・ {live.cpm} 文字/分 ・ 正確さ {live.accuracy}%
        </span>
      </header>
      {/*
        打っている途中に、何を頼まれたかを見返せるように（本人の希望。2026-11-12）。
        入力エリアを下へ押し下げないよう、ふだんは閉じておく。Space・Enter は打つキーとして使われ、開け閉めにはならない
      */}
      <details className={styles.request} data-testid="request-story">
        <summary className={styles.requestSummary}>依頼の会話を見る</summary>
        <StoryLines lines={problem.story.before} />
      </details>
      <SchemaMapPanel runner={runner} chapter={chapter} sql={mapSql} databaseStatus="ready" />
      {/* 打っている間に目が行く入力エリアを真ん中に大きく。表はすぐ下に置き、打った瞬間の変化が視線を少し下げるだけで見えるようにする */}
      <section className={styles.stage} aria-label="打つところ">
        <p className={styles.guide}>{GUIDES[mode]}</p>
        {session.imeWarning && (
          <p className={styles.warning} role="alert">
            日本語入力がオンになっています。半角英数に切り替えてください。
          </p>
        )}
        <TypingArea
          target={session.target}
          typing={session.typing}
          missPulse={session.missPulse}
          blanks={mode === '2' ? session.blanks : undefined}
        />
        {mode === '2' && (
          <ChoiceList
            choice={session.blanks.choice}
            lastWrong={session.lastWrong}
            missPulse={session.choiceMissPulse}
          />
        )}
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
            wrongChoices={mode === '2' ? summary.wrongChoices : null}
          />
          {afterClear}
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
