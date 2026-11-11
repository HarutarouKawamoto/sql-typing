import { useCallback, useReducer, useState } from 'react';
import { loadChapters } from '../data/problem-loader.js';
import { isUnlocked, nextProblemId } from '../data/progress-store.js';
import { getSqlRunner, useDatabaseStatus } from './state/database.js';
import { HOME, navigationReducer } from './state/navigation.js';
import { useProgress } from './state/progress.js';
import { useNarrowScreen } from './state/use-narrow-screen.js';
import { useProblems } from './state/use-problems.js';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { ModeSelect } from './screens/ModeSelect.jsx';
import { PlayScreen } from './screens/PlayScreen.jsx';
import { ReplayDemoScreen } from './screens/ReplayDemoScreen.jsx';
import { StoryScreen } from './screens/StoryScreen.jsx';

/**
 * `?demo`（ステップ再生の見本）と `speed`（再生の速さ）を読む。
 * @param {string} search - location.search
 * @returns {{ speed: number } | null}
 */
function readDemoParams(search) {
  const params = new URLSearchParams(search);
  if (!params.has('demo')) return null;
  const speed = Number(params.get('speed'));
  return { speed: Number.isFinite(speed) && speed > 0 ? speed : 1 };
}

/**
 * アプリの入口のコンポーネント。画面の切り替え（navigation.js）と、学習記録・データベースの状態を配る。
 * 一覧 → モード選択 → 依頼の会話 → 遊ぶ（クリア後の会話から次の問題・一覧へ）。`/?demo` はステップ再生の見本。
 */
export function App() {
  const database = useDatabaseStatus();
  const {
    progress,
    record,
    markReplayFinished,
    recoveredNotice,
    dismissRecoveredNotice,
    saveFailed,
  } = useProgress();
  const [chapters] = useState(() => loadChapters());
  const { problems, turningPointIds, error: loadError } = useProblems(chapters);
  const [navigation, dispatch] = useReducer(navigationReducer, HOME);
  const narrow = useNarrowScreen();
  const goHome = useCallback(() => dispatch({ type: 'home' }), []);
  const [demo, setDemo] = useState(() => readDemoParams(window.location.search));
  const exitDemo = useCallback(() => {
    setDemo(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  if (demo && database.status === 'ready') {
    return (
      <main className="app app-wide">
        <ReplayDemoScreen runner={getSqlRunner()} speed={demo.speed} onExit={exitDemo} />
      </main>
    );
  }

  if (navigation.screen === 'play') {
    const { problemId, mode } = navigation;
    const nextId = nextProblemId(chapters, problemId);
    return (
      <main className="app app-wide">
        <PlayScreen
          // 別の問題・モードを開いたら、前の読み込み結果を残さないように作り直す
          key={`${problemId}:${mode}`}
          problemId={problemId}
          mode={mode}
          runner={getSqlRunner()}
          replaySpeed={progress.settings.replaySpeed}
          onRecord={record}
          onReplayFinished={markReplayFinished}
          onExit={goHome}
          saveFailed={saveFailed}
          next={
            nextId === null
              ? null
              : {
                  problemId: nextId,
                  unlocked: isUnlocked(progress, chapters, nextId, turningPointIds),
                }
          }
          turningPoint={turningPointIds.has(problemId)}
          onNext={() => dispatch({ type: 'next', problemId: nextId })}
        />
      </main>
    );
  }

  if (navigation.screen === 'story') {
    return (
      <main className="app">
        <StoryScreen
          key={`${navigation.problemId}:${navigation.mode}`}
          problemId={navigation.problemId}
          mode={navigation.mode}
          // 会話のあいだに幅が狭くなっていたら、遊ぶ画面へ進まずモード選択（遊べないことを知らせる）へ
          onDone={() =>
            dispatch(
              narrow && navigation.mode !== null ? { type: 'modeSelect' } : { type: 'storyDone' },
            )
          }
          onHome={goHome}
        />
      </main>
    );
  }

  if (navigation.screen === 'mode') {
    return (
      <main className="app">
        <ModeSelect
          key={navigation.problemId}
          problemId={navigation.problemId}
          title={problems?.get(navigation.problemId)?.title ?? navigation.problemId}
          progress={progress}
          turningPoint={turningPointIds.has(navigation.problemId)}
          databaseStatus={database.status}
          narrow={narrow}
          onChoose={(mode) => dispatch({ type: 'chooseMode', mode })}
          onRead={() => dispatch({ type: 'readStory' })}
          onHome={goHome}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <HomeScreen
        chapters={chapters}
        progress={progress}
        problems={problems}
        turningPointIds={turningPointIds}
        loadError={loadError}
        databaseStatus={database}
        recoveredNotice={recoveredNotice}
        onDismissRecovered={dismissRecoveredNotice}
        onOpen={(problemId) => dispatch({ type: 'openProblem', problemId })}
      />
    </main>
  );
}
