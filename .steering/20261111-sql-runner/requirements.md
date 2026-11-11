# 要求内容

## 概要

ブラウザの中で PostgreSQL（PGlite）を動かす `SqlRunner` を作る。初級の初期データ（`products` 30行）を流し、いつでも初期状態に戻せて、5秒で打ち切れる状態にする。問題データの検証に「正解SQLが PGlite で実行できるか」を足す。

## 背景

- 判定（Judge）・ステップ再生（Stepper）・見える化C・問題データの検証は、すべて「SQLを実行して結果を得る」ことが前提。その窓口がまだない
- 土台づくりの記録で「PGlite が Vite で本当に動くか」「PGlite を入れたあとの配る量」を検証していないことにしていた

## 実装対象の機能

### 1. SqlRunner（`src/data/sql-runner/`）
- `ready()`：PGlite を起動する（失敗したら3回まで試す）
- `prepare({ seedSql, extraSql })`：章の初期データ＋問題の追加SQLを「初期状態」として覚え、その状態にする
- `reset()`：初期状態に戻す（学習者が `UPDATE`・`DROP TABLE`・`BEGIN` のままにしても戻る）
- `run(sql, { timeoutMs })`：SQLを1つ実行し、結果・エラー・打ち切りのどれかを返す。実行は1つずつ順番に
- ブラウザ用（Web Worker）とテスト用（Node）の2つの中身（バックエンド）を同じ形で持つ

### 2. 初級の初期データ（`data/seeds/beginner.sql`）
- `products` 30行。機能設計書の「初期データの決まり」を満たす

### 3. 問題データの検証の追加
- 初期データの決まり（行数・カテゴリごとの数・在庫0・仕入れ先 NULL・`Mug`・値段の重なり）
- 全問の正解SQLが、その章の初期データ＋`extraSql` の上で実行でき、0行でない

### 4. 画面から起動する
- アプリを開くと裏で PGlite を起動し、初級の初期データを流す。「データベース：準備中…」→「準備完了（products 30行）」を表示する

## 受け入れ条件

### SqlRunner
- [ ] `SELECT` の結果が `{ columns, rows }`（行は配列）で返る。日付は `YYYY-MM-DD` の文字列、`NUMERIC`・`BIGINT` は数値
- [ ] エラーは `{ code（SQLSTATE）, message, position }` で返り、例外にならない
- [ ] `;` で区切った2つの文は実行されず、「複数の文」とわかる印付きのエラーで返る
- [ ] `UPDATE`・`DELETE`・`DROP TABLE`・`BEGIN`（閉じていない）のあとでも、`reset()` で初期状態に戻る。`SERIAL` の次の番号も戻る
- [ ] 5秒を超えたら `{ ok: false, timeout: true }` を返し、中身を作り直して初期状態に戻す。後に並んでいた実行はそのあと順番に動く
- [ ] 起動が失敗しても3回まで試し、だめなら例外にする
- [ ] `src/data/` の依存のルールを守る（ESLint）

### 初期データと検証
- [ ] `npm run validate:data` で、初期データの決まりと正解SQLの実行を確かめる
- [ ] 正解SQLが動かない問題（テスト用のデータ）を検証が見つける

### 画面
- [ ] `npm run test:e2e` で「準備完了（products 30行）」が表示される（ビルドしたものの上で PGlite が動く）
- [ ] 配る量（gzip 後）を測って記録する（目標：初回 5MB 以内）

## 成功指標

- 次の作業（判定・ステップ再生・モード1）が、`SqlRunner` だけを使ってSQLを実行できる

## スコープ外

- 判定（Judge）・エラーの和訳（ErrorTranslator）・ステップ再生（Stepper）
- 「間違いの選択肢が判定で不正解になるか」「順番が1つに決まるか」の検証（Judge と並び順の比べ方が必要なため、Judge の作業で足す）
- 問題データの中身（初級9問）
- 中級・上級の初期データ

## 参照ドキュメント

- `docs/functional-design.md` - SqlRunner、お店のDB、初期データの決まり、エラーハンドリング
- `docs/architecture.md` - 実行のしくみ（スレッド）、打ち切り、パフォーマンス要件
- `docs/development-guidelines.md` - 完了条件、レビュー用の記録
