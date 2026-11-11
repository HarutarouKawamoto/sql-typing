import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTarget, createTypingState, pressKey } from '../../core/typing-engine.js';
import { canRunWhileTyping, splitClauses } from '../../core/clause-splitter.js';
import { countTypedKeys, weakPointKey } from '../../core/scoring.js';
import { classifyKeyEvent, createLatestOnlyRunner } from './typing-keys.js';

/**
 * なぞり書き（モード1）の1回分。キー入力は window の keydown を1か所で受ける（部品ごとに受けると二重に反応するため）。
 * - 最初のキー（ok か miss）で時計を始める
 * - 句を打ち終えたら、そこまでのSQLを実行して結果の表を変える（見える化C）。実行中なら最新の1つだけ予約する
 * - 長押しの繰り返しは数えない。日本語入力がオンなら知らせる
 * - 最後まで打ったら onDone を呼ぶ
 * 問題が変わるときは、このフックを使う部品ごと作り直す（key に問題IDを入れる）。
 *
 * @param {{
 *   displaySql: string,
 *   keywords: string[],
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   onDone: (summary: { okCount: number, missCount: number, elapsedMs: number, mistakes: Record<string, number>, typed: Record<string, number> }) => void,
 *   onExit: () => void,
 * }} options
 */
export function useTypingSession({ displaySql, keywords, runner, onDone, onExit }) {
  const target = useMemo(() => buildTarget(displaySql), [displaySql]);
  const clauses = useMemo(() => splitClauses(displaySql).clauses, [displaySql]);
  // 書き換え系や SELECT ... INTO を途中で実行すると DB が変わるので、読み取りの SELECT だけ実行する。
  // 問題データの検証（checkClausePrefixes）と同じ関数で判定する
  const liveEnabled = useMemo(() => canRunWhileTyping(displaySql), [displaySql]);

  const [typing, setTyping] = useState(() => createTypingState(target));
  const [missPulse, setMissPulse] = useState(0);
  const [startedAt, setStartedAt] = useState(/** @type {number | null} */ (null));
  const [finishedAt, setFinishedAt] = useState(/** @type {number | null} */ (null));
  const [now, setNow] = useState(0);
  const [imeWarning, setImeWarning] = useState(false);
  const [live, setLive] = useState(
    /** @type {{ result: import('../../data/sql-runner/sql-runner.js').QueryResult | null, previousRowCount: number | null }} */ ({
      result: null,
      previousRowCount: null,
    }),
  );

  const typingRef = useRef(typing);
  const startedRef = useRef(/** @type {number | null} */ (null));
  const doneRef = useRef(false);
  const mistakesRef = useRef(/** @type {Record<string, number>} */ ({}));
  const schedulerRef = useRef(
    /** @type {ReturnType<typeof createLatestOnlyRunner> | null} */ (null),
  );
  const onDoneRef = useRef(onDone);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onDoneRef.current = onDone;
    onExitRef.current = onExit;
  });

  // 経過時間の表示を進める
  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return undefined;
    const timer = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(timer);
  }, [startedAt, finishedAt]);

  // 打ちながらの実行。作り直したら古い方は捨てる（古い結果が新しい表を上書きしない・予約が止まらない）
  useEffect(() => {
    const scheduler = createLatestOnlyRunner(
      (sql) => runner.run(sql),
      (outcome) => {
        // 途中のSQL（SELECT * だけ など）はエラーになるのが普通なので、前の表のままにする
        if (!outcome.ok || outcome.result.columns.length === 0) return;
        setLive((current) => ({
          result: outcome.result,
          previousRowCount: current.result ? current.result.rows.length : null,
        }));
      },
    );
    schedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, [runner]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const kind = classifyKeyEvent(event);
      if (kind === 'exit') {
        onExitRef.current();
        return;
      }
      if (kind === 'ime') {
        if (!doneRef.current) setImeWarning(true);
        return;
      }
      if (kind === 'skip' || doneRef.current) return;

      const { state, result, clauseEnded, done } = pressKey(typingRef.current, target, event.key);
      if (result === 'ignored') return;
      // Space でのスクロール、' での検索バーなどを止める
      event.preventDefault();
      setImeWarning(false);

      const time = performance.now();
      if (startedRef.current === null) {
        startedRef.current = time;
        setStartedAt(time);
        setNow(time);
      }
      if (result === 'miss') {
        const key = weakPointKey(target, state.position, keywords);
        if (key) mistakesRef.current[key] = (mistakesRef.current[key] ?? 0) + 1;
        setMissPulse((n) => n + 1);
      }
      typingRef.current = state;
      setTyping(state);

      if (clauseEnded !== undefined && liveEnabled) {
        schedulerRef.current?.request(displaySql.slice(0, clauses[clauseEnded].end));
      }
      if (done) {
        doneRef.current = true;
        setFinishedAt(time);
        onDoneRef.current({
          okCount: state.okCount,
          missCount: state.missCount,
          elapsedMs: time - startedRef.current,
          mistakes: { ...mistakesRef.current },
          typed: countTypedKeys(target, keywords),
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [target, clauses, keywords, liveEnabled, displaySql]);

  const elapsedMs = startedAt === null ? 0 : (finishedAt ?? Math.max(now, startedAt)) - startedAt;

  return { target, typing, missPulse, elapsedMs, live, imeWarning, done: finishedAt !== null };
}
