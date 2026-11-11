# 要求内容

## 概要

判定（Judge）とエラーの和訳（ErrorTranslator）を作る。書いたSQLと正解SQLの実行結果を比べ、別解も正解にし、問題ごとの「必ず使う／使ってはいけない」条件を確かめる。PostgreSQL のエラーは日本語の題名とよくある原因にする。問題データの検証に「間違いの選択肢が不正解になる」「行の順番が1つに決まる」を足す。

## 背景

- 開発ガイドラインの順番は「… → 見える化A → 判定 → モード2〜4 → …」。モード3・4（自分で書く）とモード2の不正解の確かめに、判定が要る
- 前の作業で「Judge の作業で足す」と残していた問題データの検証が2つある

## 実装対象の機能

### 1. ErrorTranslator（`src/core/error-translator.js`・`error-messages.js`）
- SQLSTATE ごとの和訳（機能設計書の表の12種類）と、よくある原因
- 2つ以上の文（`multipleStatements`）は「1回に実行できるSQLは1つです」
- 当てはまらないコードは「エラーが起きました」＋英語の原文

### 2. Judge（`src/core/judge.js`）
- `computeExpected({ problem, runner })`：正解の結果を作る（問題を開いたときに1回）
- `judge({ sql, problem, runner, expected })`：`correct` / `wrong`（理由つき）/ `ruleViolation` / `error` / `timeout`
- 比べ方：列の数 → （`checkColumnNames` なら）列の名前 → 行の数 → 値（`ordered` でなければ並びを無視）→ 並び（`ordered` のとき）→ 条件
- 書き換え系（`compareTable`）は、実行後のテーブルの中身を比べる
- 判定の前とあとに DB を初期状態に戻す

### 3. 問題データの検証の追加
- モード2の間違いの選択肢を空欄に入れたSQLが、判定で正解にならない
- `ordered: true` の問題は ORDER BY があり、並びが1つに決まる（同じ並びの値の行がない）

## 受け入れ条件

- [ ] 別解（`IN` と `OR`、列の順番が同じで書き方が違う WHERE など）が正解になる
- [ ] 列の数・列の名前・行の数・値・並びの違いを、それぞれの理由と日本語の説明で返す
- [ ] `require`・`forbid` に合わなければ、結果が正しくても `ruleViolation`（結果が正しいことも伝える）
- [ ] エラーは和訳つきで `error`、5秒を超えたら `timeout`
- [ ] 判定のあと、DB は初期状態に戻っている
- [ ] 数値は `1000` と `1000.0` を同じに、`NULL` は `NULL` どうしだけ同じに扱う
- [ ] 間違いの選択肢が正解になる問題、並びが1つに決まらない問題を、問題データの検証が見つける
- [ ] `src/core/` の行カバレッジ 90% 以上

## スコープ外

- モード2〜4の画面（次の作業）
- 判定の結果を見せる画面（JudgePanel）
- 中級の書き換え系の問題データ

## 参照ドキュメント

- `docs/functional-design.md` - Judge・ErrorTranslator・問題データの検証
- `docs/product-requirements.md` - 機能7（判定）
