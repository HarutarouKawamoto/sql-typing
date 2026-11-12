# 設計書

## コア

### `src/core/stepper/group-by.js`
```js
/** @returns {{ items: string[] } | { unsupported: string }} */
export function splitGroupBy(clauseText) {}
```
- 先頭の `GROUP BY` を除き、括弧・文字列の外のカンマで分ける（`tokenize`）
- 項目が整数だけ → `unsupported`（列の番号）。`ROLLUP`・`CUBE`・`GROUPING` の語 → `unsupported`
  - （実装検証のあと）列の番号（括弧つきも）と SELECT の別名は、`resolveGroupItems` で SELECT の項目の式に置き換えて扱う。集計関数かは `aggregates.js`（サブクエリの中は数えない）。SELECT の段階で「グループごとに1行」を確かめ、外れたら mismatch

### 段階のSQL（`t` FROM、`w` WHERE、`g` GROUP BY 句、`h` HAVING 句、`p` 選ぶ列、`k` グループの鍵）

- グループの鍵 `k`：GROUP BY があれば `ROW(<項目>)::text`、なければ `'all'`
- GROUP BY：`SELECT *, ctid::text AS __rid, k AS __grp t w` → 行の目印 → グループ。前の段階の並びのまま、グループの最初に出てきた順で安定に並べ替える。`diff.groups = { rid: グループの番号 }`、`reordered`
- HAVING：`SELECT k AS __grp t w g h` → 残るグループ。前の段階の行のうち、残るグループの行だけ。`diff.removed`・`diff.groups`
- SELECT（集計）：`SELECT p, k AS __grp t w g h` → 各行のグループの最初の行（前の段階の並びで）の目印を新しい目印にする。その組のほかの行を `diff.merged[目印]` に。前の段階に行がないグループ（0行の集計）は `group:<鍵>`。並びはグループの番号の順
- ORDER BY：`SELECT p, k AS __grp t w g h o` → 鍵で目印に直す
- LIMIT：同じく `... o l`。並びが続いていること（今までと同じ確かめ）
- 最後の表が元のSQLの結果と一致すること（今までと同じ）

### `Step` の形
- `label` に `'GROUP BY' | 'HAVING'`
- `StepDiff` に `groups: Record<string, number>`（GROUP BY・HAVING の段階だけ。ほかは `{}`）

## 画面
- `StepTable`：`diff.groups` があれば、行を `group0〜5` の色で塗り `data-group` を付ける（印・変化の両方）。HAVING で消える行は赤の印を重ねる
- `needsMark`：`groups` があれば印の場面を作る（色が付いてから寄る）
- `DURATIONS`：`GROUP BY: [1800, 800]`、`HAVING: [1800, 800]`
- `EXPLANATIONS`：上の一言。集計の SELECT は、`diff.merged` があり段階が SELECT のとき「1つのグループが1行にまとまる」
  - （実装検証のあと）集計したかは `diff.aggregated` で決める（まとまる行がない集計もあるため）。並び替わらない GROUP BY は「同じグループの行が同じ色になる（もう寄って並んでいる）」
- `ReplayDemoScreen`：見本を3つ足す（GROUP BY と count、WHERE・HAVING・ORDER BY・LIMIT、GROUP BY のない集計）

## テスト
- 単体：`tests/unit/core/group-by.test.js`、`step-replay-timing.test.js` に GROUP BY
- 統合：`tests/integration/stepper/group-by-steps.test.js`（受け入れ条件の3つと作れない形）。`beginner-steps.test.js` の作れない形から GROUP BY・集計・string_agg を外す
- E2E：`tests/e2e/visualization/step-replay-marks.spec.js` に GROUP BY の見本（色の付いた行の数・まとまる行）
