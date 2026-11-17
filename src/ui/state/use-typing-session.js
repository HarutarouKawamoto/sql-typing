import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTarget } from '../../core/typing-engine.js';
import { createBlankTypingState, pressBlankKey } from '../../core/blank-typing.js';
import { canRunWhileTyping, splitClauses } from '../../core/clause-splitter.js';
import { countTypedKeys, weakPointKey } from '../../core/scoring.js';
import { classifyKeyEvent, createLatestOnlyRunner } from './typing-keys.js';

/**
 * 空欄のスロット（苦手の「打った回数」から外す。空欄の中の miss は苦手に数えないので、分母もそろえる）
 * @param {{ start: number, end: number }[]} ranges
 */
function blankSlots(ranges) {
  const slots = new Set();
  for (const { start, end } of ranges) for (let i = start; i < end; i += 1) slots.add(i);
  return slots;
}

/** 空欄なし（モード1）。毎回新しい配列を作ると、空欄の状態を作り直してしまう */
const NO_BLANKS = [];

/**
 * なぞり書き（モード1）と、打って選ぶ（モード2）の1回分。キー入力は window の keydown を1か所で受ける（部品ごとに受けると二重に反応するため）。
 * - 判定は blank-typing.js（空欄がなければなぞり書きと同じ）。モード2は blanks を渡す
 * - 空欄の中の miss は苦手（記号・キーワード）に数えない（選び方の迷いと、打ち間違いを分けられないため）
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
 *   onDone: (summary: { okCount: number, missCount: number, elapsedMs: number, mistakes: Record<string, number>, typed: Record<string, number>, wrongChoices: number }) => void,
 *   onExit: () => void,
 *   blanks?: import('../../core/choice-engine.js').BlankLike[],
 *   randomFn?: () => number,
 * }} options
 *   blanks：モード2の空欄（省くとなぞり書き）。randomFn：選択肢の並び順の乱数（テスト以外は Math.random）
 */
export function useTypingSession({
  displaySql,
  keywords,
  runner,
  onDone,
  onExit,
  blanks = NO_BLANKS,
  randomFn = Math.random,
}) {
  const target = useMemo(() => buildTarget(displaySql), [displaySql]);
  const clauses = useMemo(() => splitClauses(displaySql).clauses, [displaySql]);
  // 書き換え系や SELECT ... INTO を途中で実行すると DB が変わるので、読み取りの SELECT だけ実行する。
  // 問題データの検証（checkClausePrefixes）と同じ関数で判定する
  const liveEnabled = useMemo(() => canRunWhileTyping(displaySql), [displaySql]);

  const [session, setSession] = useState(() => createBlankTypingState(target, blanks, randomFn));
  // 間違いの選択肢を選んだときの知らせ（何回目かも持ち、同じ間違いを続けて選んでも出し直す）
  const [lastWrong, setLastWrong] = useState(
    /** @type {{ text: string, why: string, count: number } | null} */ (null),
  );
  const [missPulse, setMissPulse] = useState(0);
  // 空欄の中の miss だけを数える（選択肢を揺らすため。空欄の外の miss で、出てきたばかりの選択肢を揺らさない）
  const [choiceMissPulse, setChoiceMissPulse] = useState(0);
  const [startedAt, setStartedAt] = useState(/** @type {number | null} */ (null));
  const [finishedAt, setFinishedAt] = useState(/** @type {number | null} */ (null));
  const [now, setNow] = useState(0);
  const [imeWarning, setImeWarning] = useState(false);
  // 文字列の中で大文字・小文字だけが違う、または Caps Lock がオンのまま打ち間違えた（理由が出ないと、先に進めず止まったように見える）
  const [caseWarning, setCaseWarning] = useState(false);
  const [live, setLive] = useState(
    /** @type {{ result: import('../../data/sql-runner/sql-runner.js').QueryResult | null, previousRowCount: number | null }} */ ({
      result: null,
      previousRowCount: null,
    }),
  );

  const sessionRef = useRef(session);
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

      const { state, result, inBlank, clauseEnded, done, why, text, caseOnly } = pressBlankKey(
        sessionRef.current,
        target,
        event.key,
        randomFn,
      );
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
      if (result === 'miss' && (caseOnly || event.getModifierState?.('CapsLock'))) {
        setCaseWarning(true);
      } else if (result !== 'miss') {
        setCaseWarning(false);
      }
      if (result === 'miss') {
        if (inBlank) {
          setChoiceMissPulse((n) => n + 1);
        } else {
          // 打ち間違いでも位置は進むので、苦手として数えるのは進む前の位置（間違えた文字）
          const key = weakPointKey(
            target,
            state.typing.lastMissAt ?? state.typing.position,
            keywords,
          );
          if (key) mistakesRef.current[key] = (mistakesRef.current[key] ?? 0) + 1;
          setMissPulse((n) => n + 1);
        }
      }
      if (result === 'decidedWrong') {
        setLastWrong({ text: text ?? '', why: why ?? '', count: state.wrongChoices });
      } else if (result === 'decidedCorrect') {
        setLastWrong(null);
        // 次の空欄の選択肢が、出てきた瞬間に揺れないように
        setChoiceMissPulse(0);
      }
      sessionRef.current = state;
      setSession(state);

      if (clauseEnded !== undefined && liveEnabled) {
        schedulerRef.current?.request(displaySql.slice(0, clauses[clauseEnded].end));
      }
      if (done) {
        doneRef.current = true;
        setFinishedAt(time);
        onDoneRef.current({
          okCount: state.typing.okCount,
          missCount: state.typing.missCount,
          elapsedMs: time - startedRef.current,
          mistakes: { ...mistakesRef.current },
          typed: countTypedKeys(target, keywords, blankSlots(state.ranges)),
          wrongChoices: state.wrongChoices,
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [target, clauses, keywords, liveEnabled, displaySql, randomFn]);

  const elapsedMs = startedAt === null ? 0 : (finishedAt ?? Math.max(now, startedAt)) - startedAt;

  return {
    target,
    typing: session.typing,
    blanks: session,
    lastWrong,
    missPulse,
    choiceMissPulse,
    elapsedMs,
    live,
    imeWarning,
    caseWarning,
    done: finishedAt !== null,
  };
}
