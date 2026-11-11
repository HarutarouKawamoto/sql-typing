import { useEffect, useMemo, useState } from 'react';
import { splitClauses } from '../../core/clause-splitter.js';
import { buildSteps } from '../../core/stepper/index.js';
import { isInteractiveTarget } from '../state/typing-keys.js';
import { useStepReplay } from '../state/use-step-replay.js';
import { StepTable } from './StepTable.jsx';
import styles from './StepPlayer.module.css';

/** 段階ごとの一言（何が起きる段階か） */
const EXPLANATIONS = {
  FROM: 'テーブルの全部の行を読む',
  WHERE: '条件に合わない行が消える',
  SELECT: '使う列だけが残る',
  DISTINCT: '同じ値の行が1つにまとまる',
  'ORDER BY': '行が並び替わる',
  LIMIT: '指定した行数だけが残る',
};

/**
 * 見える化A（ステップ再生）。SQLの句に実行順の番号を付け、今の段階の句を光らせながら、
 * その時点の表を見せる。→ 次へ・← 戻る・Space 再生／一時停止・Home 最初から。
 * @param {{
 *   sql: string,
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   speed: number,
 *   onFinished?: () => void,
 * }} props
 */
export function StepPlayer({ sql, runner, speed, onFinished }) {
  const [built, setBuilt] = useState(
    /** @type {import('../../core/stepper/index.js').BuildResult | null} */ (null),
  );

  useEffect(() => {
    let active = true;
    buildSteps(sql, runner).then(
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
  return <StepPlayerView sql={sql} steps={built.steps} speed={speed} onFinished={onFinished} />;
}

/**
 * @param {{ sql: string, steps: import('../../core/stepper/index.js').Step[], speed: number, onFinished?: () => void }} props
 */
function StepPlayerView({ sql, steps, speed, onFinished }) {
  const replay = useStepReplay({ steps, speed, onFinished });
  const clauses = useMemo(() => splitClauses(sql).clauses, [sql]);
  const { next, back, first, togglePlay } = replay;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
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
            <span key={index}>{segment.text}</span>
          ) : (
            <span
              key={index}
              className={segment.active ? `${styles.clause} ${styles.active}` : styles.clause}
              data-active={segment.active ? 'true' : undefined}
            >
              <span className={styles.order}>{segment.order}</span>
              {segment.text}
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
        <button type="button" onClick={togglePlay}>
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
        <span className={styles.explanation}> ― {EXPLANATIONS[replay.step.label]}</span>
      </p>

      <StepTable step={replay.step} previous={replay.previous} phase={replay.phase} />
    </div>
  );
}
