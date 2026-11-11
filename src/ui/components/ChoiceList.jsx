import styles from './ChoiceList.module.css';

/**
 * モード2：今の空欄の選択肢。打った文字に合う候補は打った分を色付きで、候補でないものは薄く、
 * 選んだ間違いは打ち消し線で描く。間違いを選んだときは「なぜ違うか」を出す。
 * @param {{
 *   choice: import('../../core/choice-engine.js').ChoiceState | null,
 *   lastWrong: { text: string, why: string, count: number } | null,
 *   missPulse: number,
 * }} props
 */
export function ChoiceList({ choice, lastWrong, missPulse }) {
  if (!choice) return null;
  return (
    <section className={styles.panel} aria-label="選択肢" data-testid="choice-list">
      <p className={styles.guide}>空欄に入るものを、最後まで打って選びましょう。</p>
      {/* ミスのたびに key を変えて揺らし直す */}
      <ul
        key={missPulse}
        className={missPulse > 0 ? `${styles.list} ${styles.shake}` : styles.list}
      >
        {choice.choices.map((item, index) => {
          const rejected = choice.rejected.includes(index);
          const candidate = !rejected && choice.candidates.includes(index);
          const state = rejected ? 'rejected' : candidate ? 'candidate' : 'out';
          // 打った分：候補なら typed 個のスロットの終わりまで
          const typedSlot =
            candidate && choice.typed > 0 ? item.target.slots[choice.typed - 1] : null;
          const typedEnd =
            typedSlot === null
              ? 0
              : typedSlot.kind === 'separator'
                ? typedSlot.end
                : typedSlot.start + 1;
          return (
            <li key={item.text} className={`${styles.item} ${styles[state]}`} data-state={state}>
              <code>
                <span className={styles.typed}>{item.text.slice(0, typedEnd)}</span>
                {item.text.slice(typedEnd)}
              </code>
            </li>
          );
        })}
      </ul>
      {lastWrong && (
        <p className={styles.why} role="alert" data-testid="choice-why" key={lastWrong.count}>
          「<code>{lastWrong.text}</code>」ではありません：{lastWrong.why}
        </p>
      )}
    </section>
  );
}
