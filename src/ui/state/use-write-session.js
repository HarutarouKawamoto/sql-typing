import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { computeExpected, judge } from '../../core/judge.js';
import { loadTableList } from '../../data/table-list.js';
import { runDbJob } from './db-jobs.js';
import { localDate } from './local-date.js';
import { canRun, createWriteState, elapsedMs, writeReducer } from './write-session-machine.js';

/**
 * 書く画面（モード3・4）の1回分。
 * - 開いたら、テーブルの一覧を読み、正解の結果を作る（1回だけ。StrictMode で effect が2回動いても作り直さない）
 * - run(sql, onStart)：判定中・クリアのあと・空白だけなら何もしない。判定が終わるまで次の実行を受けない。
 *   判定を始めたときだけ onStart を呼ぶ
 * - 正解なら学習記録に残す（時間・実行した回数・モード3は開いたヒントの数）
 * 問題やモードが変わるときは、このフックを使う部品ごと作り直す（key に問題IDとモードを入れる）。
 *
 * @param {{
 *   problem: import('../../schema/problem-schema.js').Problem,
 *   mode: '3' | '4',
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   onRecord: (play: object) => unknown,
 * }} options
 */
export function useWriteSession({ problem, mode, runner, onRecord }) {
  const [state, dispatch] = useReducer(writeReducer, undefined, createWriteState);
  const [prepared, setPrepared] = useState(
    /** @type {{ tables: { table: string, columns: string[] }[], expected: import('../../core/judge.js').Expected } | { error: string } | null} */ (
      null
    ),
  );
  const [now, setNow] = useState(0);

  // 判定中かどうかは dispatch の反映より先に知りたい（続けて押した Ctrl+Enter を止めるため）ので ref でも持つ
  const judgingRef = useRef(false);
  const mountedRef = useRef(true);
  const preparingRef = useRef(
    /** @type {Promise<{ tables: { table: string, columns: string[] }[], expected: import('../../core/judge.js').Expected }> | null} */ (
      null
    ),
  );
  const recordedRef = useRef(false);
  const onRecordRef = useRef(onRecord);
  useEffect(() => {
    onRecordRef.current = onRecord;
  });

  useEffect(() => {
    mountedRef.current = true;
    // 1回だけ作って使い回す（StrictMode で effect が2回動いても作り直さない）。
    // 問題が変わるときは部品ごと作り直す前提（PlayScreen の key）なので、problem が変わっても作り直さない
    preparingRef.current ??= runDbJob(async () => {
      // テーブルの一覧は書くための手がかりで、なくても判定はできる。読めなくても遊べるようにする
      const tables = await loadTableList(runner).catch((error) => {
        console.error(error);
        return [];
      });
      const expected = await computeExpected({ problem, runner });
      return { tables, expected };
    });
    preparingRef.current.then(
      (value) => mountedRef.current && setPrepared(value),
      (error) => {
        console.error(error);
        if (mountedRef.current) setPrepared({ error: String(error?.message ?? error) });
      },
    );
    return () => {
      mountedRef.current = false;
    };
  }, [problem, runner]);

  // 経過時間の表示を進める
  useEffect(() => {
    if (state.startedAt === null || state.finishedAt !== null) return undefined;
    const timer = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(timer);
  }, [state.startedAt, state.finishedAt]);

  // クリアしたら1回だけ記録する
  useEffect(() => {
    if (!state.cleared || recordedRef.current) return;
    recordedRef.current = true;
    onRecordRef.current({
      problemId: problem.id,
      mode,
      cleared: true,
      date: localDate(new Date()),
      best: {
        timeMs: Math.round(elapsedMs(state, state.finishedAt ?? 0)),
        runs: state.runs,
        ...(mode === '3' ? { hintsOpened: state.hintsOpened } : {}),
      },
    });
  }, [state, problem.id, mode]);

  const expected = prepared && 'expected' in prepared ? prepared.expected : null;

  const run = useCallback(
    /**
     * @param {string} sql
     * @param {() => void} [onStart] - 判定を始めたときだけ、その場で呼ぶ（見える化B を、判定しない実行で流さないため）
     */
    async (sql, onStart) => {
      if (!expected?.ok || judgingRef.current || !canRun(state, sql)) return;
      judgingRef.current = true;
      onStart?.();
      dispatch({ type: 'runStart', time: performance.now() });
      /** @type {import('../../core/judge.js').JudgeResult} */
      let result;
      try {
        // 画面を離れても判定は最後まで流れる（途中で止める手段がない）。仕事の列に入れて、
        // 次の問題の準備がこの判定の reset と入り混じらないようにする
        result = await runDbJob(() => judge({ sql, problem, runner, expected }));
      } catch (error) {
        console.error(error);
        result = {
          status: 'error',
          error: {
            code: '',
            original: String(error?.message ?? error),
            title: '判定できませんでした',
            causes: [],
          },
        };
      } finally {
        judgingRef.current = false;
      }
      if (mountedRef.current) dispatch({ type: 'runEnd', result, sql });
    },
    [expected, state, problem, runner],
  );

  const edit = useCallback(() => dispatch({ type: 'edit', time: performance.now() }), []);
  const openHint = useCallback(
    () => dispatch({ type: 'openHint', max: problem.hints.length }),
    [problem.hints.length],
  );

  return {
    state,
    prepared,
    elapsedMs: elapsedMs(state, Math.max(now, state.startedAt ?? 0)),
    run,
    edit,
    openHint,
  };
}
