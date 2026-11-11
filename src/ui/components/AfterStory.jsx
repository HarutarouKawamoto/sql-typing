import { useEffect } from 'react';
import { classifyResultKey } from '../state/typing-keys.js';
import { StoryLines } from './StoryLines.jsx';
import styles from './AfterStory.module.css';

/**
 * クリアの結果の下に出す、反応の会話と次への道。結果を出しているときのキーはここで受ける（本人の決定）。
 * - Enter・J：次の問題へ（次があって開いているときだけ）
 * - R：もう一度
 * - Esc：一覧へ（遊ぶ画面が受ける）
 * @param {{
 *   lines: { speaker: string, text: string }[],
 *   next: { problemId: string, unlocked: boolean } | null,
 *   note: string | null,
 *   onNext: () => void,
 *   onRestart: () => void,
 *   onHome: () => void,
 * }} props
 *   next：次の問題（なければ null）。note：添え書き（ターニングポイントをモード1・2でクリアしたときなど）
 */
export function AfterStory({ lines, next, note, onNext, onRestart, onHome }) {
  const canNext = next !== null && next.unlocked;

  useEffect(() => {
    const onKeyDown = (event) => {
      const action = classifyResultKey(event);
      if (action === 'restart') {
        event.preventDefault();
        onRestart();
      } else if (action === 'next' && canNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canNext, onNext, onRestart]);

  return (
    <section className={styles.after} aria-label="クリア後の会話" data-testid="after-story">
      <StoryLines lines={lines} />
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.controls}>
        <button type="button" className={styles.next} onClick={onNext} disabled={!canNext}>
          {next === null
            ? '次の問題はまだありません'
            : canNext
              ? '次の問題へ（Enter / J）'
              : '次の問題はまだ開いていません'}
        </button>
        <button type="button" className={styles.home} onClick={onRestart}>
          もう一度（R）
        </button>
        <button type="button" className={styles.home} onClick={onHome}>
          一覧へ（Esc）
        </button>
      </div>
    </section>
  );
}
