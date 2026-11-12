import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import styles from './StepTable.module.css';

const MAX_ROWS = 50;
/** DISTINCT でまとまる組の色の数（StepTable.module.css の .group0〜.group5） */
const GROUP_COLORS = 6;

/**
 * ステップ再生の1段階の表。
 * - 印の場面（mark）：前の段階の表に、消える行（赤）・まとまる行（組ごとの色）・消える列（灰色の打ち消し線）の印を付ける
 * - GROUP BY・HAVING の段階は、印・変化の両方の場面で、行をグループの色で塗る（どの行が同じグループかが見えるように）
 * - 変化の場面（apply）：この段階の表。行は行の目印（rid）を key にして、並び替え・消える動きを Motion で見せる
 *
 * @param {{
 *   step: import('../../core/stepper/index.js').Step,
 *   previous: import('../../core/stepper/index.js').Step | null,
 *   phase: 'mark' | 'apply',
 * }} props
 */
export function StepTable({ step, previous, phase }) {
  const marking = phase === 'mark' && previous;
  const shown = marking ? previous : step;
  const removed = new Set(step.diff.removed);
  const mergedAway = new Set(Object.values(step.diff.merged).flat());
  const mergedKeep = new Set(Object.keys(step.diff.merged));
  // まとまる組ごとに色を分ける（どの行とどの行がまとまるかが見えるように）。
  // 前の段階が GROUP BY・HAVING なら、そのグループの色のまま（段階が変わっても同じグループは同じ色）
  const previousGroups = previous?.diff.groups ?? {};
  const groupOf = new Map();
  Object.entries(step.diff.merged).forEach(([keep, absorbed], index) => {
    const color = (previousGroups[keep] ?? index) % GROUP_COLORS;
    for (const rid of [keep, ...absorbed]) groupOf.set(rid, color);
  });
  // グループの色：GROUP BY・HAVING の段階はその段階の番号。集計の SELECT の印の場面は、前の段階の色のまま
  // （1行だけのグループは「まとまる」に入らないので、ここで色を残す）
  const groups =
    Object.keys(step.diff.groups ?? {}).length > 0
      ? step.diff.groups
      : marking && step.diff.aggregated
        ? previousGroups
        : {};
  const removedColumns = new Set(step.diff.removedColumns);
  const renamedTo = new Map(
    Object.entries(step.diff.renamedColumns).map(([from, to]) => [to, from]),
  );

  // 印の種類（data-mark にも出して、E2E で数えられるようにする）
  // removing：消える行／merging：まとまって消える行／merging-keep：まとまって残る行
  const rowMark = (rid) => {
    if (!marking) return undefined;
    if (removed.has(rid)) return 'removing';
    if (mergedAway.has(rid)) return 'merging';
    if (mergedKeep.has(rid)) return 'merging-keep';
    return undefined;
  };
  const rowClass = (rid) => {
    const mark = rowMark(rid);
    const group = groups[rid];
    const groupClass = group === undefined ? '' : styles[`group${group % GROUP_COLORS}`];
    if (mark === 'removing') return `${groupClass} ${styles.removing}`;
    if (mark === 'merging' || mark === 'merging-keep') {
      return `${styles[`group${groupOf.get(rid)}`]} ${
        mark === 'merging' ? styles.mergingAway : styles.mergingKeep
      }`;
    }
    return groupClass || undefined;
  };
  const columnMark = (column) =>
    marking && removedColumns.has(column) ? 'removing-column' : undefined;
  const columnClass = (column) => (columnMark(column) ? styles.removingColumn : undefined);

  const rows = shown.rows.slice(0, MAX_ROWS);
  const hidden = shown.rows.length - rows.length;
  const changed = step.rowCountBefore !== null && step.rowCountBefore !== step.rows.length;

  return (
    <div className={styles.wrap} data-testid="step-table">
      <p className={styles.count} aria-live="polite">
        {changed ? `${step.rowCountBefore}行 → ${step.rows.length}行` : `${step.rows.length}行`}
      </p>
      <MotionConfig reducedMotion="user">
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {shown.columns.map((column, index) => (
                  <th
                    key={`${column}-${index}`}
                    className={columnClass(column)}
                    data-mark={columnMark(column)}
                    data-renamed={!marking && renamedTo.has(column) ? 'true' : undefined}
                  >
                    {!marking && renamedTo.has(column) ? (
                      <>
                        <span className={styles.renamedFrom}>{renamedTo.get(column)}</span>
                        {' → '}
                        {column}
                      </>
                    ) : (
                      column
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((row) => (
                  <motion.tr
                    key={row.rid}
                    layout
                    className={rowClass(row.rid)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.3 }}
                    data-rid={row.rid}
                    data-mark={rowMark(row.rid)}
                    data-group={groups[row.rid]}
                  >
                    {row.values.map((value, index) => (
                      <td
                        key={index}
                        className={[
                          columnClass(shown.columns[index]),
                          value === null ? styles.null : '',
                          typeof value === 'number' ? styles.number : '',
                        ].join(' ')}
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
