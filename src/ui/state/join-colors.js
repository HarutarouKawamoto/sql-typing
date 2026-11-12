/**
 * JOIN の段階の色分け（React に依存しない。単体テストする）。つながる行どうしを同じ色にする。
 * - 多対1（注文 → 顧客）：右の行ごとの色。左の行は、つながる右の行の色
 * - それ以外（1対多：顧客 → 注文、多対多）：左の行ごとの色。右の行は、つながる左の行の色
 * - 多対多で、2つ以上の色の左の行につながる右の行は、1つの色に決められないので色を付けず multi にする
 */

/** 色の数（StepTable.module.css の .group0〜.group5） */
export const JOIN_COLORS = 6;

/**
 * @param {{ rows: { rid: string }[], pairs: Record<string, string[]> }} join - Step の diff.join
 * @param {{ rid: string }[]} leftRows - 前の段階の行（左）
 */
export function joinColors(join, leftRows) {
  const allPairs = Object.values(join.pairs);
  /** つながる相手のいる右の行 */
  const used = new Set(allPairs.flat());
  const manyToOne = allPairs.every((rights) => rights.length <= 1);
  /** @type {Map<string, number>} */
  const left = new Map();
  /** @type {Map<string, number>} */
  const right = new Map();
  /** @type {Set<string>} */
  const multi = new Set();

  if (manyToOne) {
    let next = 0;
    for (const row of join.rows) {
      if (used.has(row.rid)) right.set(row.rid, next++ % JOIN_COLORS);
    }
    for (const [leftRid, rights] of Object.entries(join.pairs)) {
      if (rights.length > 0) left.set(leftRid, /** @type {number} */ (right.get(rights[0])));
    }
  } else {
    let next = 0;
    /** @type {Map<string, Set<number>>} 右の行 → つながる左の行の色 */
    const colorsOfRight = new Map();
    for (const row of leftRows) {
      const rights = join.pairs[row.rid] ?? [];
      if (rights.length === 0) continue;
      const color = next++ % JOIN_COLORS;
      left.set(row.rid, color);
      for (const rightRid of rights) {
        if (!colorsOfRight.has(rightRid)) colorsOfRight.set(rightRid, new Set());
        colorsOfRight.get(rightRid)?.add(color);
      }
    }
    for (const [rightRid, colors] of colorsOfRight) {
      if (colors.size === 1) right.set(rightRid, [...colors][0]);
      else multi.add(rightRid);
    }
  }

  /**
   * 合体した行（左の目印+右の目印）の色
   * @param {string} rid
   */
  const joined = (rid) => {
    const at = rid.lastIndexOf('+');
    return manyToOne ? right.get(rid.slice(at + 1)) : left.get(rid.slice(0, at));
  };
  return { left, right, multi, used, joined };
}
