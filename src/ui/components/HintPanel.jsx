import styles from './HintPanel.module.css';

/** ヒントの段階の名前（問題データの hints の順。docs/development-guidelines.md の「ヒント3段階」） */
const STAGE_NAMES = ['使う句', '句の順番', '骨組み'];

/**
 * モード3のヒント。ボタンで1つずつ開く（開いた数は学習記録に残る）。
 * @param {{ hints: string[], opened: number, onOpen: () => void, disabled: boolean }} props
 */
export function HintPanel({ hints, opened, onOpen, disabled }) {
  const allOpened = opened >= hints.length;
  return (
    <section className={styles.panel} aria-label="ヒント" data-testid="hint-panel">
      {opened > 0 && (
        <ol className={styles.list}>
          {hints.slice(0, opened).map((hint, index) => (
            <li key={index}>
              <span className={styles.stage}>{STAGE_NAMES[index] ?? `ヒント${index + 1}`}</span>
              <span className={index === 2 ? styles.code : undefined}>{hint}</span>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={onOpen}
        disabled={disabled || allOpened}
      >
        {allOpened
          ? `ヒントは全部開きました（${hints.length}/${hints.length}）`
          : `ヒントを開く（${opened}/${hints.length}）`}
      </button>
    </section>
  );
}
