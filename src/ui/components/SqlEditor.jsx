import { useLayoutEffect, useRef, useState } from 'react';
import { classifyEditorKey, insertIndent } from '../state/editor-keys.js';
import styles from './SqlEditor.module.css';

/**
 * モード3・4の入力欄（複数行）。Ctrl / ⌘ + Enter で実行、Tab でスペース2つ。
 * 日本語入力がオンなら知らせる（SQLの値は英語と数字だけ）。
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   onRun: () => void,
 *   readOnly: boolean,
 *   autoFocus?: boolean,
 * }} props
 */
export function SqlEditor({ value, onChange, onRun, readOnly, autoFocus = false }) {
  const ref = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  // Tab で値を変えたあと、描き直してからカーソルを置く（値を差し替えるとカーソルが末尾に飛ぶため）
  const pendingCursor = useRef(/** @type {number | null} */ (null));
  const [imeWarning, setImeWarning] = useState(false);

  useLayoutEffect(() => {
    if (pendingCursor.current === null || !ref.current) return;
    ref.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
    pendingCursor.current = null;
  }, [value]);

  /** @param {import('react').KeyboardEvent<HTMLTextAreaElement>} event */
  const onKeyDown = (event) => {
    if (!event.nativeEvent.isComposing && event.key !== 'Process') setImeWarning(false);
    if (readOnly) return;
    const kind = classifyEditorKey(event.nativeEvent);
    if (kind === 'run') {
      event.preventDefault();
      onRun();
    } else if (kind === 'indent') {
      event.preventDefault();
      const target = event.currentTarget;
      const next = insertIndent(target.value, target.selectionStart, target.selectionEnd);
      pendingCursor.current = next.cursor;
      onChange(next.value);
    }
  };

  return (
    <div className={styles.wrap}>
      <textarea
        ref={ref}
        className={styles.editor}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setImeWarning(true)}
        onBlur={() => setImeWarning(false)}
        readOnly={readOnly}
        // 書く画面を開いたらすぐ打てるように（キーボードだけで遊ぶ前提）
        autoFocus={autoFocus}
        rows={6}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label="SQLを書くところ"
        data-testid="sql-editor"
        placeholder="SELECT ..."
      />
      {imeWarning && (
        <p className={styles.warning} role="alert">
          日本語入力がオンになっています。SQLは半角英数で書きましょう。
        </p>
      )}
    </div>
  );
}
