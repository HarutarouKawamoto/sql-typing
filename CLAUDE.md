# sql-typing

SQLを「打ち慣れる」ことと「DBの中の動きをイメージできる」ことを目的にした、ストーリー付きのタイピング＆クイズ学習サイト。ブラウザの中だけで動く静的サイト（Vite + React、**JavaScript**）で、PostgreSQL（PGlite）を Web Worker の中で実際に動かす。

## 最初に読むもの

| 知りたいこと | ドキュメント |
|---|---|
| 何を作るか・受け入れ条件 | `docs/product-requirements.md` |
| どう作るか（データモデル・コンポーネント・判定・見える化） | `docs/functional-design.md` |
| 技術・レイヤー・依存のルール | `docs/architecture.md` |
| どこに何を置くか・ファイル名 | `docs/repository-structure.md` |
| 書き方・完了条件・レビュー用の記録の型 | `docs/development-guidelines.md` |
| 言葉の意味とコードでの名前 | `docs/glossary.md` |
| 壁打ちで決めたこと（決定1〜18） | `docs/ideas/initial-requirements.md` |

仕様を変えたら、同じ作業の中で上のドキュメントも直す。

## 作業の完了条件（必ず守る）

1つの作業は、次の**すべて**を満たすまで「完了」と言わない。

1. `npm run check` が通る（ESLint ＋ Prettier の確認 ＋ 単体テスト ＋ 統合テスト ＋ 問題データの検証）
2. `src/ui/` を変えたら `npm run test:e2e` も通る
3. 仕様を変えたら `docs/` を直している
4. **`docs/review/YYYYMMDD-<作業名>.md` にレビュー用の記録を書き、`node scripts/check-review-files.js <記録> <作業前のコミット>` が OK になる**
5. 検証できなかったことを、記録の「検証していないこと」に書いている

テストが通らないのに完了と報告しない。通らないなら、そのまま通らないと書いて報告する。

## レビュー用の記録（`docs/review/`）

- `/add-feature` 1回（`.steering/` の1フォルダ）ごとに1ファイル。名前は `.steering/` のフォルダ名と同じ
- 作成・変更・削除・名前変更した**すべての**ファイルを「変更したファイル一覧」に載せ、それぞれ何をしたかを書く。パスはバッククォートで囲む
- **長さの上限なし**。抜けをなくすことを優先する。「その他」でまとめない
- 実際の差分（`git diff`）から書く。理由がわからない変更は、理由を作らず「判断してほしいこと」に書く
- 型は `docs/development-guidelines.md` の「レビュー用の記録」
- このプロジェクトの開発ログは、保管庫の `F000_DEVLOG/` ではなくここに書く

## 依存のルール（ESLint で止まる）

```
src/ui → src/core / src/data → src/schema
```

- `src/core/`：学習のルール（判定・スコアなど）。React・PGlite・DOM・localStorage を使わない。`SqlRunner`・乱数・現在時刻は引数で受け取る（`Math.random`・`Date.now`・`new Date()` は ESLint で止まる）。純粋な関数で書き、テストを先に書く
- `src/ui/`：PGlite・localStorage を直接使わない（`src/data/` を通す）
- `src/data/`：PGlite・問題データ・学習記録の入出力。React と `src/core/` を使わない
- `src/schema/`：Zod スキーマ。`zod` と同じフォルダの中だけを `import` する
- `dangerouslySetInnerHTML` は禁止。外部に送る処理（`fetch` など）は書かない（ESLint のエラー。どうしても必要なら `eslint-disable-next-line` と理由のコメント）
- ESLint のフラット設定では、同じルールを後のブロックに書くと前の指定が置き換わる。`eslint.config.js` の共通の定数を必ず一緒に並べる

## 問題データ（`data/`）

- 1問1ファイル：`data/problems/<章id>/<2桁>-<英語>.yaml`、`id` は `<章id>-<2桁>`。形は `src/schema/problem-schema.js`
- SQL・選択肢・データの値は英語と数字だけ（日本語は `title`・`story`・`hints`・`why` だけ）
- モード2の選択肢は「似ているが意味が違う」もの。どの選択肢も別の選択肢の先頭部分にしない
- 新しいキーワードは同じ作業で `data/keywords.yaml` に足す
- 中身のルールは `docs/development-guidelines.md` の「問題データの書き方」。足したら `npm run validate:data`

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run check` | ESLint ＋ Vitest（単体・統合・問題データの検証） |
| `npm run validate:data` | 問題データの検証だけ |
| `npm run test:e2e` | ビルド ＋ Playwright |
| `npm run build` | ビルド（前に `validate:data` が走る） |
| `node scripts/check-review-files.js <記録> [作業前のコミット]` | レビュー用の記録と git の差分の照合 |

## 書き方の決まり（抜粋）

- JavaScript（ES Modules）。TypeScript は使わない。型は JSDoc、データの形は Zod から作る
- 名前付き `export` だけ（設定ファイルを除く）。ファイル名は React コンポーネントが PascalCase.jsx、それ以外は kebab-case.js
- コメントは日本語で「なぜ」だけ
- 言葉とコードの名前は `docs/glossary.md` に合わせる（例：「ボス」ではなく「ターニングポイント」＝ `turningPoint`、星＝モードごとのクリア印、ランク＝速さと正確さの評価）

## Git

- `main` はいつでも `npm run check` が通る状態。作業は `feature/<作業名>` で行い、完了条件を満たしてからマージする
- コミットは本人に頼まれたときだけ。メッセージは Conventional Commits（件名は日本語）。type に `content`（問題データ・会話・用語）がある
