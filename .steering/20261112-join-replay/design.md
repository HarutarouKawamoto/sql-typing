# 設計書

## FROM 句の読み取り：`parseFrom(fromText)`

```js
/**
 * @typedef {{ name: string, alias: string, ref: string }} TableRef  ref は SQL の中でこのテーブルを指す名前（別名がなければ名前）
 * @typedef {{ kind: 'INNER' | 'LEFT', table: TableRef, start: number, end: number }} JoinPart  start〜end は fromText の中の JOIN の文字の範囲
 * @returns {{ base: TableRef, joins: JoinPart[] } | { unsupported: string }}
 */
export function parseFrom(fromText) {}
```
- 括弧の外の `JOIN` の語で区切る。JOIN の前の `INNER`・`LEFT`・`LEFT OUTER` を種類に。`RIGHT`・`FULL`・`CROSS`・`NATURAL`・`USING`・`LATERAL`・カンマ・括弧（サブクエリ）は `unsupported`
- テーブル：`名前`・`名前 別名`・`名前 AS 別名`。`ON` のあとの条件は次の JOIN（括弧の外）の手前まで

## 行の目印
- 1つのテーブル：今まで通り `ctid::text`
- JOIN があるとき：`r0.ctid::text || '+' || coalesce(r1.ctid::text, '-') || ...`（`r` は各テーブルの ref）。LEFT JOIN の相手のない行は `-`
- `buildSteps` の中の `ctid::text AS __rid` を、この式（`ridSql`）に置き換える

## 段階
- FROM：`SELECT r0.*, r0.ctid::text AS __rid FROM <base の文字>`（最初のテーブルだけ）
- JOIN k：`SELECT *, <k番目までの ridSql> AS __rid FROM <fromText の k 番目の JOIN の終わりまで>`。右の表：`SELECT *, ctid::text AS __rid FROM <右のテーブル名>`
  - 目印を最後の `+` で分けて、左の目印 → 右の目印の対応（`pairs`）を作る
  - `diff.join = { kind, table, columns, rows（右の表）, pairs: { 左の目印: [右の目印...] } }`、`diff.removed`（INNER で消える左の行。合体した表には入らない左の目印）
- WHERE 以降：今までと同じ（`*`・`ridSql`）。SELECT の段階の消えた列は、最後の JOIN の段階の列で比べる

## 画面
- `StepTable`：`diff.join` があり印の場面なら、左に前の段階の表、右に右の表を並べる。色：左の行の多くが右の1行につながる（多対1）なら右の行ごとの色、そうでなければ左の行ごとの色。印：`data-mark` に `join-removing`（INNER で消える）・`join-null`（LEFT で NULL がつく）・`join-unmatched`（つながらない右の行）、色は `data-pair`
- 変化の場面（合体した表）も、同じ色を `data-pair` で付ける
- 長さ：`JOIN: [2000, 900]`。一言：INNER「つながる相手のある行どうしが、1行に合体する（相手のない行は消える）」、LEFT「左の行は全部残り、相手のない行は右の列が NULL になる」
- 見本のページ：開いたら中級の初期データで DB を準備する（products は初級と同じなので、初級の見本もそのまま）

## テスト
- 単体：`from-clause.test.js`
- 統合：`join-steps.test.js`、`problems.test.js` に中級の初期データの決まり
- E2E：`step-replay-marks.spec.js` に JOIN
