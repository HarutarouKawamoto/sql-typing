# 設計書

## `src/ui/state/plan-layout.js`
```js
export const PLAN_LAYOUT = { nodeWidth: 220, nodeHeight: 84, gapX: 24, gapY: 56 };
/**
 * @returns {{
 *   nodes: { id: string, node: PlanNode, x: number, y: number, depth: number }[],
 *   edges: { from: string, to: string, rows: number, width: number }[],
 *   width: number, height: number,
 * }}
 */
export function layoutPlan(plan) {}
export function edgeWidth(rows) {} // 1 + log10(rows + 1) * 2（最大 10）
```
- id は根から子の番号の並び（`0`・`0.1`・`0.1.0`）
- 葉は左から順に横へ並べる。親の x は子の真ん中。深さ d の y は d ×（高さ＋間）＝ 根が上（SVG は下へ向かって y が増える）
- 線は子 → 親。行の数は子の rows

## `src/core/explain.js`
- `explainQuery({ runner, query })` → `{ ok: true, summary } | { ok: false, message }`。SELECT 以外は断る。前と後に reset

## 画面
- `src/ui/components/PlanTree.jsx`：SVG（viewBox は layout の幅と高さ、横に長ければスクロール）。線は子の上の辺から親の下の辺へ、太さ `width`、上に向かう矢印、横に「N行」。箱は foreignObject を使わず rect と text（2〜3行）。loops 0 は薄く。読み上げ用の入れ子の ul（見た目は隠す）
- 節の一言（`NODE_WORDS`）：Seq Scan・Index Scan・Index Only Scan・Bitmap Heap Scan・Bitmap Index Scan・Hash Join・Nested Loop・Merge Join・Hash・Sort・Aggregate・HashAggregate・GroupAggregate・Limit・Memoize・Materialize・Unique・Result・Subquery Scan・CTE Scan・WindowAgg・Append
- `src/ui/components/PlanTreePanel.jsx`：runDbJob で explainQuery。読み込み中・失敗・木。読み上げの枠は先に置く
- PlayMode34：`visual.kind === 'plan'` で、判定がエラー・打ち切りでなく、書いたSQLが SELECT のとき
- 見本：`{ title: '上級：実行計画の木', kind: 'plan', query: 地域ごとのアクセス数（JOIN と GROUP BY） }`

## テスト
- 単体：`plan-layout.test.js`（1つの節、2つの子、深い木、太さ）
- 統合：`compare-change.test.js` に explainQuery（`explain-query` として同じファイル）
- E2E：`tests/e2e/visualization/plan-tree.spec.js`
