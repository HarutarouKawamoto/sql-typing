import styles from './TypingArea.module.css';

/**
 * なぞり書きの表示。表示用SQLを元の改行・字下げのまま描き、スロットごとに
 * 「打った・今・まだ・ミスした」を色で分ける。区切りスロットは空白・改行そのものを描く。
 * モード2では、まだ埋まっていない空欄を「？」の箱1つで描く（文字数で答えがわからないように）。
 *
 * @param {{
 *   target: import('../../core/typing-engine.js').TypingTarget,
 *   typing: import('../../core/typing-engine.js').TypingState,
 *   missPulse: number,
 *   blanks?: { ranges: { start: number, end: number }[], filled: number, active: number | null },
 * }} props
 *   blanks：モード2の空欄（ranges は表示用SQLの中の順。前から filled 個が埋まっている）
 */
export function TypingArea({ target, typing, missPulse, blanks }) {
  // まだ埋まっていない空欄：始まりのスロット番号 → 空欄の番号
  const hiddenStarts = new Map();
  const hidden = new Set();
  blanks?.ranges.forEach((range, index) => {
    if (index < blanks.filled) return;
    hiddenStarts.set(range.start, index);
    for (let slot = range.start; slot < range.end; slot += 1) hidden.add(slot);
  });

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
        if (hiddenStarts.has(index)) {
          const active = blanks?.active === hiddenStarts.get(index);
          return (
            <span
              key={`blank-${index}`}
              className={active ? `${styles.blank} ${styles.blankActive}` : styles.blank}
              data-testid="blank-box"
              aria-label={active ? '今の空欄（下の選択肢から選ぶ）' : '空欄'}
              data-active={active ? 'true' : undefined}
            >
              ？
            </span>
          );
        }
        if (hidden.has(index)) return null;
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
