import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import styles from './ReorderIntro.module.css';

/** 書いた順で見せる長さ。このあと実行順へ入れ替わり始める */
const ARRANGE_AT_MS = 400;
/** 入れ替わる動きの長さ（秒） */
const MOVE_SECONDS = 0.7;
/** 全体の長さ。入れ替わったあと少し止めてから終わる */
const DONE_AT_MS = 1500;

/**
 * 見える化B（実行順の並び替え）。書いた順に並んだ句のチップが、実行順へ入れ替わる（全体で1.5秒）。
 * 終わったら onDone。モード3・4で、実行してから判定の結果を見せるまでのあいだに流す。
 * @param {{
 *   chips: import('../../core/reorder.js').ReorderChip[],
 *   onDone: () => void,
 * }} props
 */
export function ReorderIntro({ chips, onDone }) {
  const [arranged, setArranged] = useState(false);
  // 親が描き直しても時計を作り直さないよう、最新の onDone を ref で持つ
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const arrange = setTimeout(() => setArranged(true), ARRANGE_AT_MS);
    const done = setTimeout(() => onDoneRef.current(), DONE_AT_MS);
    return () => {
      clearTimeout(arrange);
      clearTimeout(done);
    };
  }, []);

  const order = arranged ? 'execOrder' : 'writtenOrder';
  const sorted = [...chips].sort((a, b) => a[order] - b[order]);

  return (
    <section
      className={styles.intro}
      aria-label="実行順の並び替え"
      data-testid="reorder-intro"
      data-arranged={arranged ? 'true' : 'false'}
    >
      <p className={styles.caption} aria-live="polite">
        {arranged ? 'DBが実行する順' : '書いた順'}
      </p>
      <ol className={styles.chips}>
        {sorted.map((chip, index) => (
          <motion.li
            // 1つのSQLに同じ句は1つだけ（ClauseSplitter）なので、句の種類を key にできる
            key={chip.kind}
            layout
            transition={{ duration: MOVE_SECONDS, ease: 'easeInOut' }}
            className={styles.chip}
            data-testid="reorder-chip"
            data-kind={chip.kind}
          >
            {/* 番号は ol が読み上げるので、見た目だけ */}
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <code className={styles.label}>{chip.label}</code>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
