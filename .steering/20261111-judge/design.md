# 設計書

## コンポーネント設計

### 1. `src/core/error-messages.js`（データだけ）

SQLSTATE → `{ title, causes }`。機能設計書の表の12種類（42601・42P01・42703・42883・22P02・42804・42803・42702・22012・42P10・23502・23505）。

### 2. `src/core/error-translator.js`

```js
export function translateError(pgError) {} // { code, original, title, causes }
```
- `multipleStatements` なら題名を「1回に実行できるSQLは1つです」に
- 42601 で `at end of input` なら「SQLが途中で終わっています」を原因の先頭に足す
- 知らないコードは「エラーが起きました」

### 3. `src/core/judge.js`

```js
export async function computeExpected({ problem, runner }) {} // { ok: true, table } | { ok: false, message }
export async function judge({ sql, problem, runner, expected }) {} // JudgeResult
export function normalizeCell(value) {}       // 比べるための値
export function compareTables(mine, expected, { ordered, checkColumnNames }) {} // null | { reason, message }
export function findRuleViolation(sql, judgeRule) {} // null | message
```
- コアは data を import しないので、使う Runner の形（`run`・`reset`）をここで決める
- 書き換え系（`compareTable`）：実行後に `SELECT * FROM <テーブル>` の中身を比べる（並びは無視）
- 比べ方：
  - 数値は `Number` にし、小数の誤差（1e-9）をまるめる。`-0` は `0`
  - 真偽値・文字列はそのまま。`NULL` は `null`
  - 並びを比べないときは、行を JSON の文字列にして並べ替えてから比べる
  - 列の名前は小文字で比べる
- 違いの説明（例）：「行の数が違います（あなた：12行／正解：8行）」「行の順番が違います（中身は合っています）」
- 条件：`require`・`forbid` の語（2語もある）を、文字列・コメントの外の単語の並びで探す
- 判定の前とあとに `runner.reset()`

### 4. 問題データの検証（`tests/helpers/answer-checks.js`）

- `checkWrongChoices`：表示用SQL（display、なければ answer）の空欄の正解を、間違いの選択肢に置き換えたSQLを `judge` にかけ、`correct` なら問題。空欄の正解が表示用SQLにそのままの文字で見つからなければ問題（置き換えられない）
- `checkOrderDetermined`：`ordered: true` の問題で
  - ORDER BY がなければ問題
  - DISTINCT なし：`SELECT 項目, ctid … ORDER BY o, ctid` と `… ORDER BY o, ctid DESC`（LIMIT つき）の値が違えば問題（同じ並びの値の行があると、ctid の向きで並びが変わる）
  - DISTINCT あり：`SELECT * FROM (ORDER BY と LIMIT を除いたSQL) AS t ORDER BY o, t::text` と `DESC` で同じように確かめる

## テスト戦略

- 単体：error-translator（全コード・複数の文・途中で終わる・知らないコード）、normalizeCell・compareTables・findRuleViolation（純粋な関数）
- 統合（Node 版 PGlite・初級の初期データ）：judge の正解・別解・各 wrong・ruleViolation・error・timeout（作り物の runner）・書き換え系・DB が戻ること、computeExpected。問題データの検証の2つ（壊れた問題で見つけること）

## 実装の順序

1. error-messages・error-translator（テストを先に）
2. judge の純粋な関数（テストを先に）→ judge・computeExpected（統合テストを先に）
3. 問題データの検証の2つ
