import { useCallback, useEffect, useState } from 'react';
import { loadChapters, loadKeywords, loadProblem } from '../../data/problem-loader.js';
import { loadSeed } from '../../data/seed-loader.js';
import { AfterStory } from '../components/AfterStory.jsx';
import { PlayMode12 } from '../components/PlayMode12.jsx';
import { PlayMode34 } from '../components/PlayMode34.jsx';
import { runDbJob } from '../state/db-jobs.js';

/**
 * 1問を遊ぶ画面。問題を読み、DBをその問題の初期状態にしてから、モードの中身を出す。
 * モード1・2（なぞり書き・打って選ぶ）は PlayMode12、モード3・4（書いて判定）は PlayMode34。
 * @param {{
 *   problemId: string,
 *   mode: '1' | '2' | '3' | '4',
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   replaySpeed: number,
 *   onRecord: (play: object) => import('../../schema/progress-schema.js').Progress,
 *   onReplayFinished: (problemId: string) => void,
 *   onExit: () => void,
 *   saveFailed: boolean,
 *   next: { problemId: string, unlocked: boolean } | null,
 *   turningPoint: boolean,
 *   onNext: () => void,
 * }} props
 *   next：次の問題（クリア後の会話の「次の問題へ」）。turningPoint：この問題がターニングポイントか
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
  next,
  turningPoint,
  onNext,
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
      const seedSql = await loadSeed(chapter.seed);
      // 前の画面に残った判定などが終わってから、この問題の初期状態を作る
      await runDbJob(() => runner.prepare({ seedSql, extraSql: problem.setup.extraSql }));
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
  // クリアの結果の下に出す、反応の会話と次への道
  const afterClear = (
    <AfterStory
      lines={loaded.problem.story.after}
      next={next}
      note={
        // 次の章がまだ開いていないときだけ（モード3・4で一度クリアしていれば、もう開いている）
        turningPoint && (mode === '1' || mode === '2') && next !== null && !next.unlocked
          ? 'ターニングポイントは、モード3・4でクリアすると次の章が開きます。'
          : null
      }
      onNext={onNext}
      onRestart={restart}
      onHome={onExit}
    />
  );
  if (mode === '3' || mode === '4') {
    return (
      <PlayMode34
        // 問題・モード・やり直しが変わったら、書いたSQL・時計・判定を引き継がないように作り直す
        key={`${loaded.problem.id}:${mode}:${attempt}`}
        problem={loaded.problem}
        mode={mode}
        runner={runner}
        replaySpeed={replaySpeed}
        onRecord={onRecord}
        onReplayFinished={onReplayFinished}
        onExit={onExit}
        saveFailed={saveFailed}
        afterClear={afterClear}
      />
    );
  }
  return (
    <PlayMode12
      // 問題・モード・やり直しが変わったら、打っている状態・時計・記録・選択肢の並びを引き継がないように作り直す
      key={`${loaded.problem.id}:${mode}:${attempt}`}
      problem={loaded.problem}
      mode={mode}
      keywords={keywords}
      runner={runner}
      replaySpeed={replaySpeed}
      onRecord={onRecord}
      onReplayFinished={onReplayFinished}
      onExit={onExit}
      saveFailed={saveFailed}
      afterClear={afterClear}
    />
  );
}
