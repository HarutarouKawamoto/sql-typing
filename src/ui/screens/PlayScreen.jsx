import { useCallback, useEffect, useState } from 'react';
import { loadChapters, loadKeywords, loadProblem } from '../../data/problem-loader.js';
import { loadSeed } from '../../data/seed-loader.js';
import { PlayMode1 } from '../components/PlayMode1.jsx';

/**
 * 1問を遊ぶ画面。問題を読み、DBをその問題の初期状態にしてから、モードの中身を出す。
 * 今はモード1（なぞり書き）だけ。
 * @param {{
 *   problemId: string,
 *   mode: '1',
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   replaySpeed: number,
 *   onRecord: (play: object) => import('../../schema/progress-schema.js').Progress,
 *   onReplayFinished: (problemId: string) => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 * }} props
 */
export function PlayScreen({
  problemId,
  mode,
  runner,
  replaySpeed,
  onRecord,
  onReplayFinished,
  onExit,
  saveFailed,
}) {
  const [loaded, setLoaded] = useState(
    /** @type {{ problem: import('../../schema/problem-schema.js').Problem } | { error: string } | null} */ (
      null
    ),
  );
  const [attempt, setAttempt] = useState(0);
  const [keywords] = useState(() => loadKeywords().map((k) => k.word));

  useEffect(() => {
    let active = true;
    (async () => {
      const problem = await loadProblem(problemId);
      const chapter = loadChapters().find((c) => c.id === problem.chapterId);
      await runner.prepare({
        seedSql: await loadSeed(chapter.seed),
        extraSql: problem.setup.extraSql,
      });
      return problem;
    })().then(
      (problem) => active && setLoaded({ problem }),
      (error) => {
        console.error(error);
        if (active) setLoaded({ error: String(error?.message ?? error) });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId, runner]);

  // 読み込み中・失敗でも Esc でもどれる
  useEffect(() => {
    if (loaded && 'problem' in loaded) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && onExit();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loaded, onExit]);

  const restart = useCallback(() => setAttempt((n) => n + 1), []);

  if (!loaded) return <p role="status">問題を準備しています…</p>;
  if ('error' in loaded) {
    return <p role="alert">問題を開けませんでした（{loaded.error}）。Esc でもどります。</p>;
  }
  if (mode !== '1') return <p role="alert">このモードはまだありません。</p>;
  return (
    <PlayMode1
      // 問題が変わったら、打っている状態・時計・記録を引き継がないように作り直す
      key={`${loaded.problem.id}:${attempt}`}
      problem={loaded.problem}
      keywords={keywords}
      runner={runner}
      replaySpeed={replaySpeed}
      onRecord={onRecord}
      onReplayFinished={onReplayFinished}
      onRestart={restart}
      onExit={onExit}
      saveFailed={saveFailed}
    />
  );
}
