import { isUnlocked } from '../../data/progress-store.js';
import { MODE_LABELS } from '../state/best-text.js';
import styles from './HomeScreen.module.css';

const MODES = /** @type {const} */ (['1', '2', '3', '4']);

/**
 * 章と問題の一覧。問題ごとに番号・題名・ターニングポイントの印・星4つ（モードごとのクリア）。
 * 開いていない問題は題名だけ見えて選べない（決定7）。問題は App が読み込んで渡す（読み終えるまでは一覧を出さない）。
 * @param {{
 *   chapters: import('../../schema/chapter-schema.js').Chapter[],
 *   progress: import('../../schema/progress-schema.js').Progress,
 *   problems: Map<string, import('../../schema/problem-schema.js').Problem> | null,
 *   turningPointIds: Set<string>,
 *   loadError: string | null,
 *   databaseStatus: import('../state/database.js').DatabaseStatus,
 *   recoveredNotice: boolean,
 *   onDismissRecovered: () => void,
 *   onOpen: (problemId: string) => void,
 *   onOpenSettings: () => void,
 * }} props
 */
export function HomeScreen({
  chapters,
  progress,
  problems,
  turningPointIds,
  loadError,
  databaseStatus,
  recoveredNotice,
  onDismissRecovered,
  onOpen,
  onOpenSettings,
}) {
  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>SQL Typing</h1>
          <p className={styles.subtitle}>打って、動きを見て、覚えるSQL</p>
        </div>
        <button
          type="button"
          className={styles.settings}
          onClick={onOpenSettings}
          data-testid="open-settings"
        >
          設定
        </button>
      </header>
      {recoveredNotice && (
        <p className={styles.notice} role="alert">
          学習記録を読み込めなかったため、最初からになりました。{' '}
          <button type="button" onClick={onDismissRecovered}>
            閉じる
          </button>
        </p>
      )}
      <p className={styles.status} role="status">
        {databaseStatus.status === 'starting' && 'データベース：準備中…'}
        {databaseStatus.status === 'ready' &&
          `データベース：準備完了（products ${databaseStatus.productCount}行）`}
        {databaseStatus.status === 'error' &&
          'データベースを起動できませんでした。ページを読み込み直してください'}
      </p>
      {loadError && <p className={styles.notice}>問題を読み込めませんでした（{loadError}）</p>}
      {!problems && !loadError && <p className={styles.status}>問題を読み込んでいます…</p>}
      {problems &&
        chapters.map((chapter) => (
          <section
            key={chapter.id}
            className={styles.chapter}
            aria-labelledby={`chapter-${chapter.id}`}
          >
            <h2 id={`chapter-${chapter.id}`} className={styles.chapterTitle}>
              {chapter.title}
            </h2>
            <ol className={styles.problems}>
              {chapter.problemIds.map((problemId, index) => {
                const unlocked = isUnlocked(progress, chapters, problemId, turningPointIds);
                const modes = progress.problems[problemId]?.modes ?? {};
                const title = problems.get(problemId)?.title ?? problemId;
                const turning = turningPointIds.has(problemId);
                const clearedCount = MODES.filter((mode) => modes[mode]?.cleared === true).length;
                // 読み上げ用の名前（🔒・★☆ の記号の羅列を読ませない）
                const label = [
                  `${index + 1}. ${title}`,
                  turning ? 'ターニングポイント' : null,
                  `クリア ${clearedCount}/4`,
                  unlocked ? null : 'まだ開いていません',
                ]
                  .filter(Boolean)
                  .join('、');
                return (
                  <li key={problemId}>
                    <button
                      type="button"
                      className={styles.problem}
                      disabled={!unlocked}
                      onClick={() => onOpen(problemId)}
                      aria-label={label}
                      data-testid={`problem-${problemId}`}
                    >
                      <span className={styles.number}>{index + 1}</span>
                      <span className={styles.problemTitle}>
                        {unlocked ? title : `🔒 ${title}`}
                        {turning && <span className={styles.turning}>ターニングポイント</span>}
                      </span>
                      <span className={styles.stars} aria-hidden="true">
                        {MODES.map((mode) => {
                          const cleared = modes[mode]?.cleared === true;
                          return (
                            <span
                              key={mode}
                              className={cleared ? styles.starOn : styles.starOff}
                              title={`モード${mode} ${MODE_LABELS[mode]}：${cleared ? 'クリア' : 'まだ'}`}
                              data-testid={`star-${problemId}-${mode}`}
                              data-cleared={cleared ? 'true' : 'false'}
                            >
                              {cleared ? '★' : '☆'}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
    </div>
  );
}
