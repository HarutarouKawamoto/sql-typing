import { useEffect } from 'react';
import { SchemaMapPanel } from '../components/SchemaMapPanel.jsx';
import { formatBest, MODE_LABELS } from '../state/best-text.js';
import styles from './ModeSelect.module.css';

const MODES = /** @type {const} */ (['1', '2', '3', '4']);

/**
 * 問題のモードを選ぶ。4つのモードのボタン（星・最高記録）、1〜4のキー、Esc で一覧へ。
 * データベースの準備中・幅の狭い画面では選べない（狭い画面でも依頼の会話とDBの地図は見られる）。
 * DBの地図は、開いたときに DB を章の初期状態にしてから読む（前に遊んだ問題の DB のままにしない）。
 * 光らせるテーブルはない（モード4の答えのヒントにならないように）。
 * @param {{
 *   problemId: string,
 *   title: string,
 *   progress: import('../../schema/progress-schema.js').Progress,
 *   turningPoint: boolean,
 *   databaseStatus: 'starting' | 'ready' | 'error',
 *   narrow: boolean,
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   chapter: import('../../schema/chapter-schema.js').Chapter | null,
 *   prepareDb: () => Promise<void>,
 *   onChoose: (mode: '1' | '2' | '3' | '4') => void,
 *   onRead: () => void,
 *   onHome: () => void,
 * }} props
 */
export function ModeSelect({
  problemId,
  title,
  progress,
  turningPoint,
  databaseStatus,
  narrow,
  runner,
  chapter,
  prepareDb,
  onChoose,
  onRead,
  onHome,
}) {
  const playable = databaseStatus === 'ready' && !narrow;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key === 'Escape') {
        onHome();
        return;
      }
      if (playable && MODES.includes(event.key)) {
        event.preventDefault();
        onChoose(/** @type {'1' | '2' | '3' | '4'} */ (event.key));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playable, onChoose, onHome]);

  const modes = progress.problems[problemId]?.modes ?? {};
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>モードを選びましょう（1〜4のキーでも選べます）。Esc で一覧へ。</p>
        {turningPoint && (
          <p className={styles.turning}>
            ターニングポイント：モード3・4でクリアすると、次の章が開きます。
          </p>
        )}
      </header>
      {narrow && (
        <p className={styles.notice} role="alert" data-testid="narrow-notice">
          画面の幅が狭いため、ここでは遊べません。PCで遊んでください（依頼の会話は読めます）。
        </p>
      )}
      {!narrow && databaseStatus === 'starting' && (
        <p className={styles.notice}>データベースを準備しています…</p>
      )}
      {!narrow && databaseStatus === 'error' && (
        <p className={styles.notice} role="alert">
          データベースを起動できませんでした。ページを読み込み直してください。
        </p>
      )}
      <ul className={styles.modes}>
        {MODES.map((mode) => {
          const record = modes[mode];
          const best = formatBest(mode, record?.best);
          return (
            <li key={mode}>
              <button
                type="button"
                className={styles.mode}
                disabled={!playable}
                onClick={() => onChoose(mode)}
                data-testid={`mode-${mode}`}
              >
                <span className={styles.key}>{mode}</span>
                <span className={styles.name}>{MODE_LABELS[mode]}</span>
                <span className={record?.cleared ? styles.starOn : styles.starOff}>
                  {record?.cleared ? '★ クリア' : '☆'}
                </span>
                <span className={styles.best} data-testid={`best-mode${mode}`}>
                  {best ? `最高：${best}` : 'まだ記録はありません'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {chapter && (
        <SchemaMapPanel
          runner={runner}
          chapter={chapter}
          prepareDb={prepareDb}
          databaseStatus={databaseStatus}
        />
      )}
      <div className={styles.footer}>
        <button type="button" className={styles.link} onClick={onRead}>
          依頼の会話を読む
        </button>
        <button type="button" className={styles.link} onClick={onHome}>
          一覧へもどる（Esc）
        </button>
      </div>
    </div>
  );
}
