import { useCallback, useEffect, useState } from 'react';
import { isInteractiveTarget, isPlainEnter } from '../state/typing-keys.js';
import { StoryLines } from './StoryLines.jsx';
import styles from './StoryPanel.module.css';

/**
 * 依頼の会話を1行ずつ出す。Enter かクリックで次の行、最後の行の次で onDone。「スキップ」で飛ばす。
 * ボタンにフォーカスがあるときの Enter は、そのボタンに任せる（スキップを Tab で選んで Enter、など）。
 * @param {{ lines: { speaker: string, text: string }[], onDone: () => void, doneLabel: string }} props
 *   doneLabel：最後の行のあとに何が始まるか（例「打ち始める」）
 */
export function StoryPanel({ lines, onDone, doneLabel }) {
  const [shown, setShown] = useState(Math.min(1, lines.length));
  const finished = shown >= lines.length;

  const advance = useCallback(() => {
    if (finished) onDone();
    else setShown((n) => n + 1);
  }, [finished, onDone]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isPlainEnter(event) || isInteractiveTarget(event.target)) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance]);

  return (
    <section className={styles.panel} aria-label="会話" data-testid="story-panel">
      {/* 行の上をクリックしても次の行へ（キーボードでは Enter）。最後の行では、うっかりのクリックで始めないようにボタンか Enter だけ */}
      <div
        className={finished ? styles.log : `${styles.log} ${styles.clickable}`}
        onClick={finished ? undefined : advance}
        aria-live="polite"
      >
        <StoryLines lines={lines.slice(0, shown)} />
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.next} onClick={advance}>
          {finished ? `${doneLabel}（Enter）` : `次へ（Enter） ${shown}/${lines.length}`}
        </button>
        {!finished && (
          <button type="button" className={styles.skip} onClick={onDone}>
            スキップ
          </button>
        )}
      </div>
    </section>
  );
}
