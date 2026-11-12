import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { JOIN_COLORS, joinColors } from '../state/join-colors.js';
import styles from './StepTable.module.css';

const MAX_ROWS = 50;
/** まとまる組・グループ・つながる組の色の数（StepTable.module.css の .group0〜.group5） */
const GROUP_COLORS = JOIN_COLORS;

/**
 * 表1つ。行は行の目印（rid）を key にして、並び替え・消える動きを Motion で見せる。
 * @param {{
 *   columns: string[],
 *   rows: import('../../core/stepper/index.js').StepRow[],
 *   rowClass: (rid: string) => string | undefined,
 *   rowAttrs: (rid: string) => Record<string, string | number | undefined>,
 *   columnClass?: (column: string, index: number) => string | undefined,
 *   columnMark?: (column: string, index: number) => string | undefined,
 *   renamedTo?: Map<string, string>,
 *   caption?: string,
 * }} props
 */
function RowsTable({
  columns,
  rows,
  rowClass,
  rowAttrs,
  columnClass = () => undefined,
  columnMark = () => undefined,
  renamedTo = new Map(),
  caption,
}) {
  const shownRows = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shownRows.length;
  return (
    <div className={styles.tableBox}>
      {caption && (
        <p className={styles.caption} aria-hidden="true">
          {caption}
        </p>
      )}
      <div className={styles.scroll}>
        {/* 見出しの文は読み上げでは表の名前として読む */}
        <table className={styles.table} aria-label={caption}>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={`${column}-${index}`}
                  className={columnClass(column, index)}
                  data-mark={columnMark(column, index)}
                  data-renamed={renamedTo.has(column) ? 'true' : undefined}
                >
                  {renamedTo.has(column) ? (
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
              {shownRows.map((row) => (
                <motion.tr
                  key={row.rid}
                  layout
                  className={rowClass(row.rid)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.3 }}
                  data-rid={row.rid}
                  {...rowAttrs(row.rid)}
                >
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className={[
                        columnClass(columns[index], index),
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
      {hidden > 0 && <p className={styles.more}>ほか {hidden} 行</p>}
    </div>
  );
}

const colorClass = (color) => (color === undefined ? '' : styles[`group${color % GROUP_COLORS}`]);

/**
 * ステップ再生の1段階の表。
 * - 印の場面（mark）：前の段階の表に、消える行（赤）・まとまる行（組ごとの色）・消える列（灰色の打ち消し線）の印を付ける
 * - GROUP BY・HAVING の段階は、印・変化の両方の場面で、行をグループの色で塗る（どの行が同じグループかが見えるように）
 * - JOIN の段階の印の場面は、左（前の段階の表）と右の表を並べ、つながる行どうしを同じ色にする。変化の場面は合体した表
 * - 変化の場面（apply）：この段階の表
 *
 * @param {{
 *   step: import('../../core/stepper/index.js').Step,
 *   previous: import('../../core/stepper/index.js').Step | null,
 *   phase: 'mark' | 'apply',
 * }} props
 */
export function StepTable({ step, previous, phase }) {
  const marking = Boolean(phase === 'mark' && previous);
  const shown = marking && previous ? previous : step;
  const changed = step.rowCountBefore !== null && step.rowCountBefore !== step.rows.length;
  const count = (
    <p className={styles.count} aria-live="polite">
      {changed ? `${step.rowCountBefore}行 → ${step.rows.length}行` : `${step.rows.length}行`}
    </p>
  );

  const join = step.diff.join;
  if (join) {
    const colors = joinColors(join, previous?.rows ?? []);
    if (marking && previous) {
      // 左の行の印：INNER で消える（join-removing）／LEFT で右が NULL になる（join-null）
      const leftMark = (rid) =>
        (join.pairs[rid] ?? []).length > 0
          ? undefined
          : join.kind === 'INNER'
            ? 'join-removing'
            : 'join-null';
      const markClass = {
        'join-removing': styles.removing,
        'join-null': styles.joinNull,
        'join-unmatched': styles.joinUnmatched,
      };
      return (
        <div className={styles.wrap} data-testid="step-table">
          {count}
          <MotionConfig reducedMotion="user">
            <div className={styles.joinPair}>
              <RowsTable
                caption="つなぐ前の表（左）"
                columns={previous.columns}
                rows={previous.rows}
                rowClass={(rid) =>
                  `${colorClass(colors.left.get(rid))} ${markClass[leftMark(rid)] ?? ''}`
                }
                rowAttrs={(rid) => ({
                  'data-mark': leftMark(rid),
                  'data-pair': colors.left.get(rid),
                })}
              />
              <RowsTable
                caption={`つなぐ表：${join.table}${join.alias ? ` ${join.alias}` : ''}（右）`}
                columns={join.columns}
                rows={join.rows}
                rowClass={(rid) => {
                  if (!colors.used.has(rid)) return styles.joinUnmatched;
                  return colors.multi.has(rid)
                    ? styles.joinMulti
                    : colorClass(colors.right.get(rid));
                }}
                rowAttrs={(rid) => ({
                  'data-mark': !colors.used.has(rid)
                    ? 'join-unmatched'
                    : colors.multi.has(rid)
                      ? 'join-multi'
                      : undefined,
                  'data-pair': colors.right.get(rid),
                  'data-side': 'right',
                })}
              />
            </div>
          </MotionConfig>
        </div>
      );
    }
    return (
      <div className={styles.wrap} data-testid="step-table">
        {count}
        <MotionConfig reducedMotion="user">
          <RowsTable
            columns={step.columns}
            rows={step.rows}
            rowClass={(rid) => colorClass(colors.joined(rid)) || undefined}
            rowAttrs={(rid) => ({ 'data-pair': colors.joined(rid) })}
          />
        </MotionConfig>
      </div>
    );
  }

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
  // 消える列は位置で見る（JOIN のあとは同じ名前の列があるため）。位置がない古い形は名前で見る
  const removedIndexes = new Set(step.diff.removedColumnIndexes ?? []);
  const removedNames = new Set(step.diff.removedColumnIndexes ? [] : step.diff.removedColumns);
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
    const groupClass = colorClass(groups[rid]);
    if (mark === 'removing') return `${groupClass} ${styles.removing}`;
    if (mark === 'merging' || mark === 'merging-keep') {
      return `${colorClass(groupOf.get(rid))} ${
        mark === 'merging' ? styles.mergingAway : styles.mergingKeep
      }`;
    }
    return groupClass || undefined;
  };
  const columnMark = (column, index) =>
    marking && (removedIndexes.has(index) || removedNames.has(column))
      ? 'removing-column'
      : undefined;
  const columnClass = (column, index) =>
    columnMark(column, index) ? styles.removingColumn : undefined;

  return (
    <div className={styles.wrap} data-testid="step-table">
      {count}
      <MotionConfig reducedMotion="user">
        <RowsTable
          columns={shown.columns}
          rows={shown.rows}
          rowClass={rowClass}
          rowAttrs={(rid) => ({ 'data-mark': rowMark(rid), 'data-group': groups[rid] })}
          columnClass={columnClass}
          columnMark={columnMark}
          renamedTo={marking ? new Map() : renamedTo}
        />
      </MotionConfig>
    </div>
  );
}
