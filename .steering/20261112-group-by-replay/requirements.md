# 要求内容

## 概要

ステップ再生（見える化A）を、中級の集計の句に広げる。`GROUP BY` で同じグループの行が同じ色になって寄り、`HAVING` で条件に合わないグループが消え、`SELECT` の集計（`count`・`sum`・`avg` など）で1グループが1行に縮む動きを見せる。今は「GROUP BY のステップ再生はまだありません」になっている。

## 背景

- PRD「中級の章」：見える化A を中級の句に広げる（GROUP BY で同じグループの行が同じ色になって寄る、集計で1グループが1行に縮む）
- 本人の「上級まで作って」（2026-11-12）の中級の1つ目。JOIN（2つ以上のテーブル）は次の作業。ここでは1つのテーブルの集計だけを扱う（初級の products で作って確かめられる）

## 実装対象の機能

### 1. GROUP BY 句の項目（`src/core/stepper/group-by.js`）
- `splitGroupBy(clauseText)`：`GROUP BY` の後ろを、括弧・文字列の外のカンマで項目に分ける
- 列の番号（`GROUP BY 1`）・`ROLLUP`・`CUBE`・`GROUPING SETS` は扱わない（理由を返す）

### 2. 段階（`src/core/stepper/index.js`）
- 実行順：FROM → WHERE → **GROUP BY** → **HAVING** → SELECT → ORDER BY → LIMIT
- **GROUP BY**：WHERE のあとの行を、グループごとに寄せて並べる（最初に出てきた順、グループの中は元の順）。各行のグループの番号を持つ
- **HAVING**：条件に合わないグループの行がすべて消える
- **SELECT（集計あり）**：1グループが1行になる。グループの最初の行の目印を新しい行の目印にし、ほかの行は「まとまって消える」（DISTINCT と同じ印）。並びはグループの番号の順
- GROUP BY がなく集計関数だけのとき（`SELECT count(*) FROM products`）：全部の行が1つのグループ。行が0行でも、集計は1行になる
- ORDER BY・LIMIT は、集計のあとの行で今までどおり
- 扱わない（unsupported）：DISTINCT と集計を一緒に使う、ウィンドウ関数（`OVER`）、上の 1 の形

### 3. 画面
- `StepTable`：GROUP BY・HAVING の段階は、行をグループの色で塗る（印の場面と変化の場面の両方）。`data-group` を付ける
- 段階の長さ（`step-replay-timing.js`）：GROUP BY・HAVING
- 段階の一言（`StepPlayer`）：GROUP BY「同じ値の行が、グループごとに寄る」、HAVING「条件に合わないグループが消える」、SELECT（集計）「1つのグループが1行にまとまる」
- 見本のページ（`/?demo`）に GROUP BY・HAVING・集計の見本を足す

## 受け入れ条件

- [ ] `SELECT category, count(*) FROM products GROUP BY category` の段階が FROM → GROUP BY → SELECT で、GROUP BY で30行が4つのグループに寄り、SELECT で4行になる（統合テスト）
- [ ] WHERE・HAVING・ORDER BY・LIMIT を全部使ったSQLでも、最後の段階が元のSQLの結果と一致する（統合テスト）
- [ ] GROUP BY のない集計（0行になるときも）（統合テスト）
- [ ] 見本のページで、GROUP BY の印（グループの色）と集計でまとまる行が見える（E2E）

## スコープ外

- JOIN（次の作業）
- DISTINCT と集計を一緒に使うSQL・ウィンドウ関数（上級）
