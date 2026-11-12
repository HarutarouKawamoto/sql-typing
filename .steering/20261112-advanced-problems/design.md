# 設計書

## 判定 `compareQuery`

- `src/schema/problem-schema.js`：`judge.compareQuery`（SQL の文字、SELECT で始まる）。`compareTable` と一緒なら失敗
- `src/core/judge.js` の `runForTable`：`compareTable` か `compareQuery` があれば、学習者の SQL のあとにそれを流して比べる。並びと列の名前は比べない（`compareTable` と同じ）。テーブルがない（42P01）を `tableMissing` にするのは `compareTable` のときだけ
- `tests/helpers/answer-checks.js` の `checkAnswersRun`：`compareQuery` の問題は、正解 SQL のあと `compareQuery` が1行以上

### 問題で使う compareQuery
- インデックス：`pg_index`・`pg_class`・`pg_attribute` から、access_logs の（主キー以外の）インデックスの列。名前は人によって違うので読まない
- テーブル：`pg_attribute` の列（名前・型・NOT NULL）と、`pg_constraint` の主キー・CHECK（`pg_get_constraintdef`）。`to_regclass` を使い、テーブルがないときもエラーにせず0行（不正解）にする

## タイムライン

- `PRODUCT_ID = 28`
- `TX_SCENARIOS.atomic`：手順は BEGIN → `UPDATE ... AND stock > 0` → INSERT → COMMIT。UPDATE は鍵を取り、確定した最新の在庫（自分の変更があればそれ）が1未満なら1行も変えずに ROLLBACK へ
- `outcomeText`：atomic は「UPDATE の WHERE で確かめ直した」

## 問題データ

- WITH を使う問題は `ordered: false`（`checkOrderDetermined` は WITH の形を確かめられないため）。並べる ORDER BY は書いておく
- 4・7・TP 以外の SELECT は `ordered: true`（並びが1つに決まるよう2つ目の並びを入れる）
- 8：`compareQuery`（インデックスの列）、`visual: { kind: index, query: "SELECT * FROM access_logs WHERE session_id = 's-31337'" }`
- 9：`compareQuery`（列と制約）
- 10：`require: [FOR UPDATE]`（FOR UPDATE がなくても結果は同じなので）、`visual: { kind: transaction }`
- TP：`compareTable: products`、`visual: { kind: transaction }`。注文19（Mug Cup White は在庫0、Mug Rack Wood は在庫8）を出荷する。条件がないと在庫が -1 になる

## E2E

- `tests/e2e/helpers/seed-progress.js`：`advancedUpTo(n)`（中級まで全部クリアし、上級の1〜n問目をモード1で）
- `tests/e2e/progression/advanced.spec.js`
