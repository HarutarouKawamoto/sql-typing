import styles from './TypingArea.module.css';

/**
 * なぞり書きの表示。表示用SQLを元の改行・字下げのまま描き、スロットごとに
 * 「打った・今・まだ・ミスした」を色で分ける。区切りスロットは空白・改行そのものを描く。
 *
 * @param {{
 *   target: import('../../core/typing-engine.js').TypingTarget,
 *   typing: import('../../core/typing-engine.js').TypingState,
 *   missPulse: number,
 * }} props
 */
export function TypingArea({ target, typing, missPulse }) {
  const missed = new Set(typing.missedSlots);
  const first = target.slots[0];
  const lastSlot = target.slots.at(-1);
  const before = first ? target.text.slice(0, first.start) : target.text;
  const after = lastSlot
    ? target.text.slice(lastSlot.kind === 'separator' ? lastSlot.end : lastSlot.start + 1)
    : '';

  return (
    <pre className={styles.area} aria-label="打つSQL" data-testid="typing-area">
      {before}
      {target.slots.map((slot, index) => {
        const state =
          index < typing.position ? 'typed' : index === typing.position ? 'current' : 'pending';
        const isMissNow = index === typing.position && typing.lastMissAt === index;
        const className = [
          styles.slot,
          styles[state],
          slot.kind === 'separator' ? styles.separator : '',
          missed.has(index) ? styles.missed : '',
          isMissNow ? styles.missNow : '',
        ].join(' ');
        const text =
          slot.kind === 'separator' ? target.text.slice(slot.start, slot.end) : slot.expected;
        return (
          <span
            // 同じスロットで続けて間違えても光り直すように、ミスのたびに key を変える
            key={isMissNow ? `${index}-${missPulse}` : index}
            className={className}
            data-state={state}
          >
            {text}
          </span>
        );
      })}
      {after}
    </pre>
  );
}
