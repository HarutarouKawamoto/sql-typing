import { useDatabaseStatus } from './state/database.js';

/**
 * アプリの入口のコンポーネント。
 * 今はデータベースの起動の状態だけを出す。画面の切り替え・学習記録の配布は後の作業で足す。
 */
export function App() {
  const database = useDatabaseStatus();
  return (
    <main className="app">
      <h1 className="app-title">SQL Typing</h1>
      <p className="app-subtitle">打って、動きを見て、覚えるSQL</p>
      <p className="app-status" role="status">
        {database.status === 'starting' && 'データベース：準備中…'}
        {database.status === 'ready' &&
          `データベース：準備完了（products ${database.productCount}行）`}
        {database.status === 'error' &&
          'データベースを起動できませんでした。ページを読み込み直してください'}
      </p>
    </main>
  );
}
