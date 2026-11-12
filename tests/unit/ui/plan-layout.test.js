import { describe, it, expect } from 'vitest';
import { edgeWidth, layoutPlan, PLAN_LAYOUT } from '../../../src/ui/state/plan-layout.js';

const node = (nodeType, rows, children = [], extra = {}) => ({
  nodeType,
  relation: null,
  alias: null,
  index: null,
  rows,
  removed: 0,
  loops: 1,
  totalMs: 0,
  subplan: false,
  children,
  ...extra,
});

describe('layoutPlan', () => {
  const { nodeWidth, nodeHeight, gapX, gapY } = PLAN_LAYOUT;
  const step = nodeHeight + gapY;

  it('節が1つなら左上。線はない', () => {
    const layout = layoutPlan(node('Seq Scan', 30));
    expect(layout.nodes).toEqual([
      { id: '0', node: expect.objectContaining({ nodeType: 'Seq Scan' }), x: 0, y: 0, depth: 0 },
    ]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(nodeWidth);
    expect(layout.height).toBe(nodeHeight);
  });

  it('葉が下、根が上。親は子の真ん中。線は子 → 親で、行の数は子の rows', () => {
    const plan = node('Hash Join', 20, [
      node('Seq Scan', 50000),
      node('Hash', 10, [node('Seq Scan', 10)]),
    ]);
    const { nodes, edges, width, height } = layoutPlan(plan);
    const at = (id) => nodes.find((n) => n.id === id);
    // 一番深いのは depth 2（customers の Seq Scan）なので、そこが一番下
    expect(at('0.1.0')).toMatchObject({ y: step * 2, depth: 2 });
    expect(at('0.0')).toMatchObject({ y: step, depth: 1 });
    expect(at('0')).toMatchObject({ y: 0, depth: 0 });
    // 葉は左から順。Hash は子（0.1.0）の真上、Hash Join は2つの子の真ん中
    expect(at('0.0').x).toBe(0);
    expect(at('0.1.0').x).toBe(nodeWidth + gapX);
    expect(at('0.1').x).toBe(at('0.1.0').x);
    expect(at('0').x).toBe((at('0.0').x + at('0.1').x) / 2);
    expect(edges.map(({ from, to, rows, width }) => ({ from, to, rows, width }))).toEqual([
      { from: '0.0', to: '0', rows: 50000, width: edgeWidth(50000) },
      { from: '0.1', to: '0', rows: 10, width: edgeWidth(10) },
      { from: '0.1.0', to: '0.1', rows: 10, width: edgeWidth(10) },
    ]);
    expect(width).toBe(nodeWidth * 2 + gapX);
    expect(height).toBe(step * 2 + nodeHeight);
  });

  it('子が1つの鎖は、まっすぐ縦に並ぶ', () => {
    const { nodes, edges } = layoutPlan(
      node('Limit', 5, [node('Sort', 30, [node('Seq Scan', 30)])]),
    );
    expect(nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['0', 0, 0],
      ['0.0', 0, step],
      ['0.0.0', 0, step * 2],
    ]);
    expect(edges.map((e) => e.toOffset)).toEqual([0, 0]);
  });

  it('子が3つなら、親は最初と最後の子の真ん中。線の入る位置は親の真ん中を中心に左右へずらす', () => {
    const { nodes, edges } = layoutPlan(
      node('Append', 3, [node('Seq Scan', 1), node('Seq Scan', 1), node('Seq Scan', 1)]),
    );
    const root = nodes.find((n) => n.id === '0');
    expect(root?.x).toBe(nodeWidth + gapX);
    const offsets = edges.map((e) => e.toOffset);
    expect(offsets[1]).toBe(0);
    expect(offsets[0]).toBe(-offsets[2]);
    expect(offsets[0]).toBeLessThan(0);
    // 矢印は親の箱の中に収まる
    expect(Math.abs(offsets[0])).toBeLessThan(nodeWidth / 2);
  });

  it('深さの違う葉が混ざっても、同じ深さは同じ高さ。葉は横に重ならない', () => {
    const { nodes } = layoutPlan(
      node('Nested Loop', 1, [node('Seq Scan', 1), node('Hash', 1, [node('Seq Scan', 1)])]),
    );
    const leaves = nodes.filter((n) => n.node.children.length === 0);
    expect(leaves.map((n) => n.y)).toEqual([step, step * 2]);
    expect(leaves[1].x - leaves[0].x).toBe(nodeWidth + gapX);
  });

  it('副問い合わせ（SubPlan）の線には subplan が付く', () => {
    const { edges } = layoutPlan(
      node('Seq Scan', 10, [node('Aggregate', 0, [], { subplan: true, loops: 0 })]),
    );
    expect(edges[0]).toMatchObject({ subplan: true, rows: 0 });
  });
});

describe('edgeWidth', () => {
  it('行が多いほど太い（対数。1行と5万行が両方見える）。0行でも見える細さ、上限あり', () => {
    expect(edgeWidth(0)).toBe(1);
    expect(edgeWidth(10)).toBeGreaterThan(edgeWidth(1));
    expect(edgeWidth(50000)).toBeGreaterThan(edgeWidth(10));
    expect(edgeWidth(10 ** 12)).toBe(10);
  });
});
