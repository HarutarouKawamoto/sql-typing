import { useEffect, useMemo, useRef, useState } from 'react';
import { splitClauses } from '../../core/clause-splitter.js';
import { buildRowCountQuiz } from '../../core/prediction.js';
import { buildSteps } from '../../core/stepper/index.js';
import { runDbJob } from '../state/db-jobs.js';
import { isInteractiveTarget, isTextEntryTarget } from '../state/typing-keys.js';
import { useStepReplay } from '../state/use-step-replay.js';
import { KeywordText } from './KeywordText.jsx';
import { predictionFlowText, predictionVerdict } from '../state/prediction-text.js';
import { PredictionQuiz, PredictionResult } from './PredictionQuiz.jsx';
import { StepTable } from './StepTable.jsx';
import styles from './StepPlayer.module.css';

/** 段階ごとの一言（何が起きる段階か） */
const EXPLANATIONS = {
  FROM: 'テーブルの全部の行を読む',
  WHERE: '条件に合わない行が消える',
  'GROUP BY': '同じグループの行が同じ色になり、寄って並ぶ',
  HAVING: '条件に合わないグループが、行ごと消える',
  SELECT: '使う列だけが残る',
  DISTINCT: '同じ値の行が1つにまとまる',
  'ORDER BY': '行が並び替わる',
  LIMIT: '指定した行数だけが残る',
};

/**
 * 段階の一言。集計した SELECT は「1グループが1行に」、もう寄って並んでいる GROUP BY は「同じ色になる」と言う。
 * @param {import('../../core/stepper/index.js').Step} step
 */
function explanationOf(step) {
  if (step.label === 'SELECT' && step.diff.aggregated) {
    return '1つのグループが1行にまとまり、集計した値が出る';
  }
  if (step.label === 'JOIN' && step.diff.join) {
    return step.diff.join.kind === 'LEFT'
      ? '左の行は全部残り、つながる相手のない行は右の列が NULL になる'
      : 'つながる相手のある行どうしが1行に合体する（相手が複数なら行が増え、相手のない行は消える）';
  }
  if (step.label === 'GROUP BY' && !step.diff.reordered) {
    return '同じグループの行が同じ色になる（もう寄って並んでいる）';
  }
  return EXPLANATIONS[step.label];
}

/**
 * 見える化A（ステップ再生）。SQLの句に実行順の番号を付け、今の段階の句を光らせながら、
 * その時点の表を見せる。→ 次へ・← 戻る・Space 再生／一時停止・Home 最初から。
 * @param {{
 *   sql: string,
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   speed: number,
 *   predict?: boolean,
 *   onFinished?: () => void,
 * }} props
 *   predict：段階ができたら、再生の前に結果の行の数を予想するクイズを出す（見える化D）
 * SQL が変わったら、呼ぶ側で key を変えて作り直す（段階と予想の答えを引き継がないため）
 */
export function StepPlayer({ sql, runner, speed, predict = false, onFinished }) {
  const [built, setBuilt] = useState(
    /** @type {import('../../core/stepper/index.js').BuildResult | null} */ (null),
  );
  // 予想の答え（null は予想しないで再生する）。まだ答えていなければ undefined
  const [prediction, setPrediction] = useState(
    /** @type {number | null | undefined} */ (undefined),
  );

  useEffect(() => {
    let active = true;
    // 段階づくりは何回も実行するので、判定の reset などと入り混じらないように1つの仕事として流す
    runDbJob(() => buildSteps(sql, runner)).then(
      (result) => active && setBuilt(result),
      (error) => {
        console.error(error);
        if (active)
          setBuilt({ ok: false, reason: 'error', message: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [sql, runner]);

  if (!built) return <p role="status">ステップ再生を準備しています…</p>;
  if (!built.ok) {
    return (
      <p className={styles.notice} role="status" data-testid="step-unsupported">
        {built.reason === 'unsupported'
          ? `この形のステップ再生はまだありません（${built.message}）`
          : `ステップ再生を作れませんでした（${built.message}）`}
      </p>
    );
  }
  if (!predict) {
    return <StepPlayerView sql={sql} steps={built.steps} speed={speed} onFinished={onFinished} />;
  }
  const quiz = buildRowCountQuiz(built.steps);
  const answered = prediction !== undefined;
  const verdict = typeof prediction === 'number' ? predictionVerdict(quiz, prediction) : null;
  return (
    <div className={styles.predicted}>
      {/* 読み上げの枠は先に置いておき、答えたら中身を入れる（中身ごと出すと読み上げない環境があるため） */}
      <p className={styles.srOnly} role="status">
        {verdict && `${verdict.title}${verdict.detail}${predictionFlowText(quiz)}`}
      </p>
      {!answered && <PredictionQuiz quiz={quiz} onAnswer={setPrediction} />}
      {typeof prediction === 'number' && <PredictionResult quiz={quiz} choice={prediction} />}
      {/* 答えるまで再生しない（先に再生すると、最後の段階の行の数が見えてしまう） */}
      {answered && (
        <StepPlayerView
          sql={sql}
          steps={built.steps}
          speed={speed}
          onFinished={onFinished}
          focusOnStart
        />
      )}
    </div>
  );
}

/**
 * @param {{ sql: string, steps: import('../../core/stepper/index.js').Step[], speed: number, onFinished?: () => void, focusOnStart?: boolean }} props
 *   focusOnStart：出たら再生・一時停止のボタンにフォーカスする（予想クイズの選択肢が消えたあと、
 *   フォーカスがページに落ちて Enter が「次の問題へ」にならないように）
 */
function StepPlayerView({ sql, steps, speed, onFinished, focusOnStart = false }) {
  const replay = useStepReplay({ steps, speed, onFinished });
  const playButton = useRef(/** @type {HTMLButtonElement | null} */ (null));
  useEffect(() => {
    if (focusOnStart) playButton.current?.focus();
  }, [focusOnStart]);
  const clauses = useMemo(() => splitClauses(sql).clauses, [sql]);
  const { next, back, first, togglePlay } = replay;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      // 書く画面（モード3・4）の入力欄では、矢印・Home はカーソル移動、Space は空白
      if (isTextEntryTarget(event.target)) return;
      // ボタンにフォーカスがあるときの Space は、そのボタンに任せる（二重に動かさない）
      if (event.key === ' ' && isInteractiveTarget(event.target)) return;
      const actions = { ArrowRight: next, ArrowLeft: back, Home: first, ' ': togglePlay };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      if (!event.repeat || event.key !== ' ') action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, back, first, togglePlay]);

  const [activeStart, activeEnd] = replay.step.range;
  const segments = [];
  let cursor = 0;
  for (const clause of clauses) {
    if (clause.start > cursor) segments.push({ text: sql.slice(cursor, clause.start) });
    segments.push({
      text: sql.slice(clause.start, clause.end),
      order: clause.execOrder,
      active: clause.start < activeEnd && activeStart < clause.end,
    });
    cursor = clause.end;
  }
  if (cursor < sql.length) segments.push({ text: sql.slice(cursor) });

  return (
    <div className={styles.player} data-testid="step-player">
      <pre className={styles.sql} aria-label="実行順の番号を付けたSQL">
        {segments.map((segment, index) =>
          segment.order === undefined ? (
            <span key={index}>
              <KeywordText text={segment.text} />
            </span>
          ) : (
            <span
              key={index}
              className={segment.active ? `${styles.clause} ${styles.active}` : styles.clause}
              data-active={segment.active ? 'true' : undefined}
            >
              <span className={styles.order}>{segment.order}</span>
              <KeywordText text={segment.text} />
            </span>
          ),
        )}
      </pre>

      <div className={styles.controls}>
        <button type="button" onClick={first} aria-label="最初から">
          ⏮
        </button>
        <button type="button" onClick={back} disabled={replay.index === 0} aria-label="戻る">
          ◀ 戻る
        </button>
        <button type="button" onClick={togglePlay} ref={playButton}>
          {replay.playing ? '⏸ 一時停止' : '▶ 再生'}
        </button>
        <button
          type="button"
          onClick={next}
          disabled={replay.index === steps.length - 1}
          aria-label="次へ"
        >
          次へ ▶
        </button>
        <span className={styles.keys}>→ 次へ ／ ← 戻る ／ Space 再生</span>
      </div>

      <p className={styles.stepTitle} data-testid="step-title">
        段階 {replay.index + 1}/{steps.length}：<strong>{replay.step.label}</strong>
        <span className={styles.explanation}> ― {explanationOf(replay.step)}</span>
      </p>

      <StepTable step={replay.step} previous={replay.previous} phase={replay.phase} />
    </div>
  );
}
