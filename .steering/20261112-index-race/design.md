# 設計書

## `src/core/explain.js`

```js
/**
 * @typedef {{
 *   nodeType: string, relation: string | null, alias: string | null, index: string | null,
 *   rows: number,          // Actual Rows × Actual Loops（この節が返した行）
 *   removed: number,       // (Rows Removed by Filter + by Index Recheck + by Join Filter) × loops
 *   loops: number, totalMs: number, children: PlanNode[],
 * }} PlanNode
 * @returns {{ plan: PlanNode, executionMs: number, planningMs: number }}
 */
export function parseExplain(raw) {}     // raw は JSON の文字列か、解いたもの（PGlite は文字列で返す）
export function rowsRead(plan) {}         // テーブルを読む節（Seq Scan・Index Scan・Index Only Scan・Bitmap Heap Scan・Tid Scan）の rows + removed の合計
export function scanKinds(plan) {}        // 読み方の一覧 [{ nodeType, relation, index }]
export async function compareChange({ runner, query, changeSql }) {}
// → { ok: true, before: Summary, after: Summary } | { ok: false, stage: 'before'|'change'|'after', message }
// Summary = { plan, executionMs, rowsRead, scans }
```
- `compareChange` は judge と同じく、前後で `runner.reset()`。query は SELECT だけ（問題データ・見本が決める。EXPLAIN ANALYZE は実際に実行するため）

## 画面
- `src/ui/components/IndexRace.jsx`：props `{ before, after, labels? }`。2つの列（見出し・読み方の一言・カウンター・棒・時間）。カウンターは `src/ui/state/use-count-up.js`（requestAnimationFrame、動きを減らす設定ならすぐ最後の数）
- 読み方の一言：Seq Scan「全部の行を、上から順に読む」、Index Scan・Index Only Scan「索引で、目的の行だけを探す」、Bitmap Heap Scan「索引で場所を集めてから、まとめて読む」
- `src/ui/components/IndexRacePanel.jsx`：`runDbJob` で `compareChange` を呼び、読み込み中・失敗・結果を出す。`changeSql` が変わったら比べ直す
- `PlayMode34`：問題に `visual.kind === 'index'` があり、判定が終わって学習者のSQLがエラーでなければ、`IndexRacePanel`（query は問題の、changeSql は学習者のSQL）
- 問題の形（`problem-schema.js`）：`visual: { kind: 'index' | 'plan' | 'transaction', query?: string }`（任意）
- 見本のページ：上の見本の切り替えに「上級：インデックス」を足す。開いたら上級の初期データで準備する

## テスト
- 単体：`tests/unit/core/explain.test.js`（PGlite の実際の出力から作った JSON：Seq Scan・Index Scan・Bitmap・JOIN の入れ子）
- 統合：`tests/integration/explain/compare-change.test.js`、`problems.test.js` に上級の初期データの決まり
- E2E：`tests/e2e/visualization/index-race.spec.js`
