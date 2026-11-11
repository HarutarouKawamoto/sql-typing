# 要求内容

## 概要

アプリを作り始めるための土台をつくる。Vite + React（JavaScript）が起動し、ESLint・テスト・問題データの検証・レビュー記録の照合という「安全柵」が `npm run check` 1つで動く状態にする。

## 背景

- 永続ドキュメント6つ（`docs/`）はそろったが、コード・git・`CLAUDE.md` がまだない
- 開発ガイドラインの「作業の完了条件」は `npm run check` と `scripts/check-review-files.js` を前提にしている。次の作業（DBを動かす、モード1…）から完了条件を守れるように、先に柵を立てる

## 実装対象の機能

### 1. プロジェクトの骨組み
- `package.json`（npm スクリプト）、Vite + React の最小の画面（タイトルと「準備中」）
- `.gitignore`・`.prettierrc.json`・`.prettierignore`・`jsconfig.json`
- アーキテクチャ設計書の依存ライブラリをすべて入れ、`package-lock.json` で固定する

### 2. 安全柵
- ESLint：依存のルール（`ui → core / data → schema`）、`dangerouslySetInnerHTML` の禁止、`src/` での `fetch` の警告
- Vitest：単体（`tests/unit/`）と統合（`tests/integration/`）の2つのプロジェクト
- 問題データの検証：Zod スキーマ（`src/schema/`）と、ファイルをまたぐ決まりのチェック（`src/schema/cross-checks.js`）。`npm run validate:data`
- Playwright：アプリが開くことだけを確かめる最初のE2E
- `scripts/check-review-files.js`：レビュー用の記録の「変更したファイル一覧」と git の差分の照合

### 3. Claude Code 向けの決まり
- `CLAUDE.md`：完了条件、レビュー用の記録、依存のルール、問題データのルール、コマンド

### 4. 最小のデータ
- `data/chapters.yaml`（初級の章。問題はまだ0問）、`data/characters.yaml`（仮の4人）、`data/keywords.yaml`（空）

## 受け入れ条件

### プロジェクトの骨組み
- [ ] `npm run dev` で画面が開き、「SQL Typing」と表示される
- [ ] `npm run build` が通る（前に `validate:data` が走る）

### 安全柵
- [ ] `npm run check` が通る
- [ ] `src/core/` から `src/data/` や `react` を `import` すると ESLint がエラーにする（わざと違反するファイルで確かめてから消す）
- [ ] `dangerouslySetInnerHTML` を書くと ESLint がエラーにする
- [ ] 形の合わない問題YAMLがあると `npm run validate:data` が失敗する（テスト用のデータで確かめる）
- [ ] `npm run test:e2e` が通る
- [ ] `check-review-files.js` が、一覧の抜け・余分・区分の違いを見つけて失敗する（単体テスト）。この作業の記録で実際に通る

### Claude Code 向けの決まり
- [ ] `CLAUDE.md` に、完了条件・レビュー用の記録・依存のルール・問題データのルール・コマンドが書いてある

## 成功指標

- 次の作業から、`npm run check` と `check-review-files.js` だけで完了条件を機械的に確かめられる

## スコープ外

以下はこのフェーズでは実装しません:

- PGlite を動かす `SqlRunner`（次の作業「DBが動く」で作る）。そのため「正解SQLが PGlite で実行できるか」の検証も次の作業で足す
- 問題データの中身（初級9問）、用語辞典の中身
- 画面の中身（一覧・遊ぶ画面など）
- GitHub Actions（公開と同じ P1）
- コミット（本人に頼まれたときだけ行う）

## 参照ドキュメント

- `docs/architecture.md` - 依存ライブラリ、レイヤーと依存のルール、テスト戦略
- `docs/repository-structure.md` - フォルダとファイル名
- `docs/development-guidelines.md` - 完了条件、レビュー用の記録、コーディング規約
- `docs/functional-design.md` - データモデル（スキーマの元）
