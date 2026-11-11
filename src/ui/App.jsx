import { useCallback, useState } from 'react';
import { getSqlRunner, useDatabaseStatus } from './state/database.js';
import { useProgress } from './state/progress.js';
import { PlayScreen } from './screens/PlayScreen.jsx';

/**
 * アプリの入口のコンポーネント。
 * 今は仮の入口（1問目をなぞり書きで遊ぶ）と、遊ぶ画面の切り替えだけ。一覧画面・会話は後の作業で足す。
 */
export function App() {
  const database = useDatabaseStatus();
  const { progress, record, recoveredNotice, dismissRecoveredNotice, saveFailed } = useProgress();
  const [playing, setPlaying] = useState(
    /** @type {{ problemId: string, mode: '1' } | null} */ (null),
  );
  const exit = useCallback(() => setPlaying(null), []);

  if (playing) {
    return (
      <main className="app app-wide">
        <PlayScreen
          // 別の問題を開いたら、前の問題の読み込み結果を残さないように作り直す
          key={`${playing.problemId}:${playing.mode}`}
          problemId={playing.problemId}
          mode={playing.mode}
          runner={getSqlRunner()}
          onRecord={record}
          onExit={exit}
          saveFailed={saveFailed}
        />
      </main>
    );
  }

  const best = progress.problems['beginner-01']?.modes['1']?.best;
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
      <button
        type="button"
        className="app-start"
        disabled={database.status !== 'ready'}
        onClick={() => setPlaying({ problemId: 'beginner-01', mode: '1' })}
      >
        1問目をなぞり書きで遊ぶ
      </button>
      {best && (
        <p className="app-best">
          これまでの最高：{best.cpm} 文字/分・正確さ {best.accuracy}%・ランク {best.rank}
        </p>
      )}
    </main>
  );
}
