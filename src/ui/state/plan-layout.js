/**
 * 実行計画の木の置き方。葉（テーブルを読む節）を下、根（結果）を上に置き、子 → 親へ線を引く。
 * 元：docs/functional-design.md の PlanTree
 */

/** @typedef {import('../../core/explain.js').PlanNode} PlanNode */
/**
 * @typedef {{ id: string, node: PlanNode, x: number, y: number, depth: number }} PlacedNode
 * @typedef {{ from: string, to: string, rows: number, width: number, toOffset: number, subplan: boolean }} PlanEdge
 *   toOffset：線が親の箱に入る位置の、箱の真ん中からのずれ（子が2つ以上のとき、矢印が1点に重ならないように）
 * @typedef {{ nodes: PlacedNode[], edges: PlanEdge[], width: number, height: number }} PlanLayout
 */

export const PLAN_LAYOUT = Object.freeze({ nodeWidth: 240, nodeHeight: 104, gapX: 24, gapY: 56 });

const MAX_EDGE_WIDTH = 10;
/** 矢印どうしの間の最大（子が少ないときに広がりすぎないように） */
const MAX_ARROW_GAP = 48;

/**
 * 線の太さ。行の数の対数にする（そのままだと、1行の線と5万行の線が両方見える太さにできない）。
 * @param {number} rows
 */
export function edgeWidth(rows) {
  return Math.min(MAX_EDGE_WIDTH, 1 + Math.log10(Math.max(0, rows) + 1) * 2);
}

/**
 * @param {PlanNode} plan
 * @returns {PlanLayout}
 */
export function layoutPlan(plan) {
  const { nodeWidth, nodeHeight, gapX, gapY } = PLAN_LAYOUT;
  /** @type {{ id: string, node: PlanNode, x: number, depth: number }[]} */
  const placed = [];
  /** @type {PlanEdge[]} */
  const edges = [];
  let nextLeaf = 0;
  let maxDepth = 0;

  /**
   * 子を先に置き、親は子の真ん中に置く（葉は左から順に1つずつ横へ）。
   * @param {PlanNode} node
   * @param {string} id
   * @param {number} depth
   * @returns {number} 置いた x
   */
  function place(node, id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const entry = { id, node, x: 0, depth };
    placed.push(entry);
    if (node.children.length === 0) {
      entry.x = nextLeaf * (nodeWidth + gapX);
      nextLeaf += 1;
      return entry.x;
    }
    const count = node.children.length;
    const gap = count > 1 ? Math.min(MAX_ARROW_GAP, (nodeWidth - 60) / (count - 1)) : 0;
    const xs = node.children.map((child, i) => {
      const childId = `${id}.${i}`;
      edges.push({
        from: childId,
        to: id,
        rows: child.rows,
        width: edgeWidth(child.rows),
        toOffset: (i - (count - 1) / 2) * gap,
        subplan: child.subplan,
      });
      return place(child, childId, depth + 1);
    });
    entry.x = (xs[0] + xs[xs.length - 1]) / 2;
    return entry.x;
  }

  place(plan, '0', 0);
  const step = nodeHeight + gapY;
  return {
    nodes: placed.map((p) => ({ ...p, y: p.depth * step })),
    edges,
    width: nextLeaf * nodeWidth + (nextLeaf - 1) * gapX,
    height: maxDepth * step + nodeHeight,
  };
}
