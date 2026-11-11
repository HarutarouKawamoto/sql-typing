import { useCallback, useState } from 'react';
import { getSqlRunner, useDatabaseStatus } from './state/database.js';
import { useProgress } from './state/progress.js';
import { PlayScreen } from './screens/PlayScreen.jsx';
import { ReplayDemoScreen } from './screens/ReplayDemoScreen.jsx';

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
 * アプリの入口のコンポーネント。
 * 今は仮の入口（1問目をなぞり書き・打って選ぶ・ヒントありで書く・ヒントなしで書く）と、遊ぶ画面・ステップ再生の見本の切り替えだけ。
 * 一覧画面・会話は後の作業で足す。
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
  const [playing, setPlaying] = useState(
    /** @type {{ problemId: string, mode: '1' | '2' | '3' | '4' } | null} */ (null),
  );
  const exit = useCallback(() => setPlaying(null), []);
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

  if (playing) {
    return (
      <main className="app app-wide">
        <PlayScreen
          // 別の問題を開いたら、前の問題の読み込み結果を残さないように作り直す
          key={`${playing.problemId}:${playing.mode}`}
          problemId={playing.problemId}
          mode={playing.mode}
          runner={getSqlRunner()}
          replaySpeed={progress.settings.replaySpeed}
          onRecord={record}
          onReplayFinished={markReplayFinished}
          onExit={exit}
          saveFailed={saveFailed}
        />
      </main>
    );
  }

  const modes = progress.problems['beginner-01']?.modes ?? {};
  const best = modes['1']?.best;
  const ready = database.status === 'ready';
  return (
    <main className="app">
      <h1 className="app-title">SQL Typing</h1>
      <p className="app-subtitle">打って、動きを見て、覚えるSQL</p>
      {recoveredNotice && (
        <p className="app-notice" role="alert">
          学習記録を読み込めなかったため、最初からになりました。{' '}
          <button type="button" onClick={dismissRecoveredNotice}>
            閉じる
          </button>
        </p>
      )}
      <p className="app-status" role="status">
        {database.status === 'starting' && 'データベース：準備中…'}
        {database.status === 'ready' &&
          `データベース：準備完了（products ${database.productCount}行）`}
        {database.status === 'error' &&
          'データベースを起動できませんでした。ページを読み込み直してください'}
      </p>
      <div className="app-starts">
        <button
          type="button"
          className="app-start"
          disabled={!ready}
          onClick={() => setPlaying({ problemId: 'beginner-01', mode: '1' })}
        >
          1問目をなぞり書きで遊ぶ
        </button>
        <button
          type="button"
          className="app-start"
          disabled={!ready}
          onClick={() => setPlaying({ problemId: 'beginner-01', mode: '2' })}
        >
          1問目を打って選ぶ
        </button>
        <button
          type="button"
          className="app-start"
          disabled={!ready}
          onClick={() => setPlaying({ problemId: 'beginner-01', mode: '3' })}
        >
          1問目をヒントありで書く
        </button>
        <button
          type="button"
          className="app-start"
          disabled={!ready}
          onClick={() => setPlaying({ problemId: 'beginner-01', mode: '4' })}
        >
          1問目をヒントなしで書く
        </button>
      </div>
      {best && (
        <p className="app-best">
          これまでの最高：{best.cpm} 文字/分・正確さ {best.accuracy}%・ランク {best.rank}
        </p>
      )}
      {modes['2']?.best && (
        <p className="app-best" data-testid="best-mode2">
          モード2の最高：{modes['2'].best.cpm} 文字/分・正確さ {modes['2'].best.accuracy}%・ランク{' '}
          {modes['2'].best.rank}
        </p>
      )}
      {['3', '4'].map((mode) => {
        const record = modes[mode]?.best;
        if (!record) return null;
        return (
          <p key={mode} className="app-best" data-testid={`best-mode${mode}`}>
            モード{mode}の最高：{(record.timeMs / 1000).toFixed(1)} 秒・実行 {record.runs ?? '-'} 回
            {mode === '3' && `・ヒント ${record.hintsOpened ?? 0} 個`}
          </p>
        );
      })}
    </main>
  );
}
