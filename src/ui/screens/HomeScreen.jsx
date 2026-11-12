import { useState } from 'react';
import { loadCharacters } from '../../data/problem-loader.js';
import { isUnlocked } from '../../data/progress-store.js';
import { MODE_LABELS } from '../state/best-text.js';
import { Stamp } from '../components/Stamp.jsx';
import styles from './HomeScreen.module.css';

const MODES = /** @type {const} */ (['1', '2', '3', '4']);

/**
 * 章と問題の一覧。事務所の「依頼の綴り」の形で、問題ごとに番号・依頼（題名）・依頼人・承認欄（モードごとのクリアの判子）。
 * ターニングポイントには朱の角印。
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
 *   onOpenDictionary: () => void,
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
  onOpenDictionary,
}) {
  const [characters] = useState(() => new Map(loadCharacters().map((c) => [c.id, c.name])));
  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>SQL Typing</h1>
          <p className={styles.subtitle}>打って、動きを見て、覚えるSQL</p>
        </div>
        <div className={styles.headerButtons}>
          <button
            type="button"
            className={styles.settings}
            onClick={onOpenDictionary}
            data-testid="open-dictionary"
          >
            用語辞典
          </button>
          <button
            type="button"
            className={styles.settings}
            onClick={onOpenSettings}
            data-testid="open-settings"
          >
            設定
          </button>
        </div>
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
            {/* 綴りの見出しの行（各行のボタンは読み上げ用の名前を持つので、見出しは読み上げない） */}
            <div className={styles.ledgerHead} aria-hidden="true">
              <span>番</span>
              <span>依頼</span>
              <span>依頼人</span>
              <span className={styles.approvalHead}>
                {MODES.map((mode) => (
                  <span key={mode} title={`モード${mode} ${MODE_LABELS[mode]}`}>
                    {mode}
                  </span>
                ))}
              </span>
            </div>
            <ol className={styles.problems}>
              {chapter.problemIds.map((problemId, index) => {
                const unlocked = isUnlocked(progress, chapters, problemId, turningPointIds);
                const modes = progress.problems[problemId]?.modes ?? {};
                const problem = problems.get(problemId);
                const title = problem?.title ?? problemId;
                // 依頼人は、依頼の会話で最初に話す人（主人公でない人）
                const requester = problem?.story.before.find((line) => line.speaker !== 'player');
                const turning = turningPointIds.has(problemId);
                const clearedCount = MODES.filter((mode) => modes[mode]?.cleared === true).length;
                // 読み上げ用の名前（判子の「済」を4つ並べて読ませない）
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
                        {title}
                        {turning && <span className={styles.turning}>ターニングポイント</span>}
                      </span>
                      <span className={styles.requester}>
                        {requester ? (characters.get(requester.speaker) ?? requester.speaker) : ''}
                      </span>
                      <span className={styles.approval} aria-hidden="true">
                        {MODES.map((mode) => {
                          const cleared = modes[mode]?.cleared === true;
                          return (
                            <span
                              key={mode}
                              className={styles.approvalCell}
                              title={`モード${mode} ${MODE_LABELS[mode]}：${cleared ? 'クリア' : 'まだ'}`}
                              data-testid={`star-${problemId}-${mode}`}
                              data-cleared={cleared ? 'true' : 'false'}
                            >
                              {cleared && <Stamp mode={mode} />}
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
