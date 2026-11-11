import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import styles from './ResultTable.module.css';

const MAX_ROWS = 50;

/**
 * 行に、内容から作る key を付ける（同じ内容の行は何番目かを足して区別する）。
 * 行が消える・増えるときに、残った行が同じ要素のまま動くようにするため。
 * @param {import('../../data/sql-runner/sql-runner.js').SqlValue[][]} rows
 */
function keyedRows(rows) {
  const seen = new Map();
  return rows.map((row) => {
    const base = JSON.stringify(row);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: `${base}#${n}`, row };
  });
}

/**
 * SQLの結果の表。行数（変わったときは「前 → 今」）、NULL の見せ方、50行までの表示。
 * @param {{
 *   result: import('../../data/sql-runner/sql-runner.js').QueryResult | null,
 *   previousRowCount?: number | null,
 *   emptyMessage?: string,
 * }} props
 */
export function ResultTable({
  result,
  previousRowCount = null,
  emptyMessage = 'まだ結果はありません',
}) {
  if (!result) {
    return (
      <div className={styles.empty} data-testid="result-table">
        {emptyMessage}
      </div>
    );
  }
  const shown = keyedRows(result.rows.slice(0, MAX_ROWS));
  const hidden = result.rows.length - shown.length;
  const changed = previousRowCount !== null && previousRowCount !== result.rows.length;

  return (
    <div className={styles.wrap} data-testid="result-table">
      <p className={styles.count} aria-live="polite">
        {changed ? `${previousRowCount}行 → ${result.rows.length}行` : `${result.rows.length}行`}
      </p>
      {/* OS で「視差効果を減らす」にしている人には動きを付けない */}
      <MotionConfig reducedMotion="user">
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {result.columns.map((column, index) => (
                  <th key={`${column}-${index}`}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {shown.map(({ key, row }) => (
                  <motion.tr
                    key={key}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {row.map((value, index) => (
                      <td
                        key={index}
                        className={
                          value === null
                            ? styles.null
                            : typeof value === 'number'
                              ? styles.number
                              : undefined
                        }
                      >
                        {value === null ? 'NULL' : String(value)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </MotionConfig>
      {hidden > 0 && <p className={styles.more}>ほか {hidden} 行</p>}
    </div>
  );
}
