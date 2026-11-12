import { useEffect, useState } from 'react';
import { isSelectQuery } from '../../core/explain.js';
import { buildReorderChips } from '../../core/reorder.js';
import { prefersReducedMotion } from '../state/reduced-motion.js';
import { useWriteSession } from '../state/use-write-session.js';
import { escapeAction } from '../state/write-session-machine.js';
import { HintPanel } from './HintPanel.jsx';
import { IndexRacePanel } from './IndexRacePanel.jsx';
import { JudgePanel } from './JudgePanel.jsx';
import { PlanTreePanel } from './PlanTreePanel.jsx';
import { ReorderIntro } from './ReorderIntro.jsx';
import { SchemaMapPanel } from './SchemaMapPanel.jsx';
import { ResultTable } from './ResultTable.jsx';
import { SqlEditor } from './SqlEditor.jsx';
import { StoryLines } from './StoryLines.jsx';
import { StepPlayer } from './StepPlayer.jsx';
import { TxTimeline } from './TxTimeline.jsx';
import { WriteResult } from './WriteResult.jsx';
import styles from './PlayMode34.module.css';

const MODE_NAMES = { 3: 'モード3 ヒントありで書く', 4: 'モード4 ヒントなしで書く' };
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/**
 * モード3（ヒントありで書く）・モード4（ヒントなしで書く）。
 * 依頼とテーブルの一覧を見て、白紙からSQLを書き、Ctrl+Enter で判定する。
 * 実行のたびに、書いたSQLの結果の表と、ステップ再生（見える化A）に切り替えるボタンを出す。
 * 設定が on なら、実行してから判定の結果を見せるまでに、句が実行順に入れ替わる動き（見える化B）を流す。
 * 判定は動きと同時に始め、動きが終わるまで結果は見せない。
 * 正解でクリア。クリアのあとのキー（次の問題へ・もう一度）は afterClear（AfterStory）が受け、Esc で一覧へ。
 * 書きかけのSQLがあるときの Esc は、1回目は確かめを出し、もう一度 Esc でもどる。
 * @param {{
 *   problem: import('../../schema/problem-schema.js').Problem,
 *   chapter: import('../../schema/chapter-schema.js').Chapter,
 *   mode: '3' | '4',
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   replaySpeed: number,
 *   reorderAnimation: boolean,
 *   onRecord: (play: object) => unknown,
 *   onReplayFinished: (problemId: string) => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 *   afterClear?: import('react').ReactNode,
 * }} props
 */
export function PlayMode34({
  problem,
  chapter,
  mode,
  runner,
  replaySpeed,
  reorderAnimation,
  onRecord,
  onReplayFinished,
  onExit,
  saveFailed,
  afterClear = null,
}) {
  const session = useWriteSession({ problem, mode, runner, onRecord });
  const { state, prepared } = session;
  const [sql, setSql] = useState('');
  // ステップ再生を開いた実行の番号。実行し直したら表に戻す（前のSQLの再生を新しい結果と並べない）
  const [replayRun, setReplayRun] = useState(/** @type {number | null} */ (null));

  // 見える化Bを流している間のチップ。流し終えるまで判定の結果を見せず、次の実行も受けない
  const [intro, setIntro] = useState(
    /** @type {import('../../core/reorder.js').ReorderChip[] | null} */ (null),
  );

  // 書きかけがあるときの1回目の Esc で出す確かめ（もう一度 Esc でもどる、ほかのキーで続ける）
  const [confirmExit, setConfirmExit] = useState(false);

  // Esc でもどる（変換中の Esc は変換の取り消しなので抜けない）
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if (event.key === 'Escape') {
        if (escapeAction(state, sql, confirmExit) === 'exit') onExit();
        else setConfirmExit(true);
        return;
      }
      // Shift などを押しただけでは確かめを閉じない
      if (!MODIFIER_KEYS.has(event.key)) setConfirmExit(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, sql, confirmExit, onExit]);

  const ready = prepared !== null && 'expected' in prepared && prepared.expected.ok;
  const last = state.last;
  const mine = last?.result.mine ?? null;
  // 判定中か、見える化Bを流している間（どちらも結果をまだ見せない）
  const busy = state.judging || intro !== null;
  // 判定を始めたら、前の実行のステップ再生は畳む（新しい判定と並べない）
  const showReplay = last !== null && replayRun === last.run && mine !== null && !busy;

  const runSql = () => {
    // 判定は動きより早く終わることがあるので、動きの間はセッションの判定中でなくても止める
    if (intro !== null) return;
    const chips = reorderAnimation && !prefersReducedMotion() ? buildReorderChips(sql) : null;
    // 動きは、セッションが判定を始めたときだけ流す（判定しない実行で動きだけ流れないように）
    session.run(sql, chips ? () => setIntro(chips) : undefined);
  };

  const onChange = (value) => {
    setSql(value);
    session.edit();
  };

  return (
    <div className={styles.play}>
      <header className={styles.bar}>
        <span className={styles.badge}>{MODE_NAMES[mode]}</span>
        <span className={styles.problemTitle}>{problem.title}</span>
        <span className={styles.meter} data-testid="meter">
          {(session.elapsedMs / 1000).toFixed(1)}秒 ・ 実行 {state.runs}回
          {mode === '3' && ` ・ ヒント ${state.hintsOpened}/${problem.hints.length}`}
        </span>
      </header>

      <section className={styles.request} aria-label="依頼">
        <StoryLines lines={problem.story.before} />
        {prepared && 'tables' in prepared && (
          <p className={styles.tables} data-testid="table-list">
            使えるテーブル：
            {prepared.tables.map(({ table, columns }) => (
              <span key={table} className={styles.table}>
                <code>{table}</code>（{columns.join(', ')}）
              </span>
            ))}
          </p>
        )}
      </section>
      {/* 書いているSQLが触るテーブルを、書くたびに光らせる */}
      <SchemaMapPanel runner={runner} chapter={chapter} sql={sql} databaseStatus="ready" />

      <section className={styles.stage} aria-label="書くところ">
        <p className={styles.guide}>
          依頼に合うSQLを書いて、Ctrl+Enter で実行しましょう。
          {mode === '3'
            ? 'ヒントは下のボタンで1つずつ開けます。'
            : 'このモードにヒントはありません。'}
          Esc でもどる。
        </p>
        {confirmExit && (
          <p className={styles.confirm} role="alert" data-testid="exit-confirm">
            書きかけのSQLは消えます。もどるなら、もう一度 Esc
            を押してください（ほかのキーで続けます）。
          </p>
        )}
        {prepared === null && <p role="status">正解の結果を準備しています…</p>}
        {prepared !== null && !ready && (
          <p className={styles.problemError} role="alert">
            この問題の正解を作れませんでした（
            {'error' in prepared
              ? prepared.error
              : !prepared.expected.ok && prepared.expected.message}
            ）。Esc でもどります。
          </p>
        )}
        <SqlEditor
          value={sql}
          onChange={onChange}
          onRun={runSql}
          readOnly={state.cleared}
          autoFocus
        />
        <button
          type="button"
          className={styles.runButton}
          onClick={runSql}
          disabled={!ready || busy || state.cleared || sql.trim() === ''}
        >
          {busy ? '判定しています…' : '実行して判定（Ctrl+Enter）'}
        </button>
        {mode === '3' && (
          <HintPanel
            hints={problem.hints}
            opened={state.hintsOpened}
            onOpen={session.openHint}
            disabled={state.cleared}
          />
        )}
      </section>

      {intro !== null ? (
        <ReorderIntro chips={intro} onDone={() => setIntro(null)} />
      ) : state.cleared ? (
        <>
          <WriteResult
            elapsedMs={session.elapsedMs}
            runs={state.runs}
            hintsOpened={mode === '3' ? state.hintsOpened : null}
            saveFailed={saveFailed}
          />
          {afterClear}
        </>
      ) : (
        <JudgePanel result={last?.result ?? null} judging={state.judging} run={last?.run ?? 0} />
      )}

      {mine !== null && !showReplay && !busy && (
        <button
          type="button"
          className={styles.replayButton}
          onClick={() => setReplayRun(last.run)}
        >
          ステップ再生を見る（書いたSQLがDBの中でどう動いたか）
        </button>
      )}

      {/* 上級の見える化：書いたSQLを、問題の問い合わせを実行する前と後の間に入れて比べる（エラーのときは比べない） */}
      {problem.visual?.kind === 'index' &&
        problem.visual.query &&
        last !== null &&
        !busy &&
        last.result.status !== 'error' &&
        last.result.status !== 'timeout' && (
          <IndexRacePanel
            key={last.run}
            runner={runner}
            query={problem.visual.query}
            changeSql={last.sql}
          />
        )}

      {/* 上級の見える化：書いた SELECT（問題に query があればそれ）の実行計画の木。エラーと SELECT 以外は出さない */}
      {problem.visual?.kind === 'plan' &&
        last !== null &&
        !busy &&
        last.result.status !== 'error' &&
        last.result.status !== 'timeout' &&
        isSelectQuery(problem.visual.query ?? last.sql) && (
          <PlanTreePanel key={last.run} runner={runner} query={problem.visual.query ?? last.sql} />
        )}

      {/* 上級の見える化：2人の同時の注文のシミュレーション。DB も書いたSQLも使わないので、1回実行したあとは
          判定中・エラーのときも出したままにする（実行し直しても、進めた順を消さない） */}
      {problem.visual?.kind === 'transaction' && last !== null && <TxTimeline />}

      {showReplay ? (
        <section className={styles.results} aria-label="ステップ再生">
          <h2 className={styles.heading}>ステップ再生（{last.run}回目に実行したSQL）</h2>
          <StepPlayer
            // 実行し直したら段階を作り直す（古い段階と新しいSQLを組み合わせない）
            key={last.run}
            sql={last.sql}
            runner={runner}
            speed={replaySpeed}
            onFinished={() => onReplayFinished(problem.id)}
          />
        </section>
      ) : (
        <section className={styles.results} aria-label="結果の表">
          <h2 className={styles.heading}>
            {last ? `${last.run}回目に実行したSQLの結果` : '実行結果'}
          </h2>
          <ResultTable
            result={busy ? null : mine}
            emptyMessage={
              busy
                ? '判定しています…'
                : last
                  ? 'このSQLの結果の表はありません（エラー・打ち切り・空のSQL）'
                  : 'Ctrl+Enter で実行すると、ここに書いたSQLの結果が出ます'
            }
          />
        </section>
      )}
    </div>
  );
}
