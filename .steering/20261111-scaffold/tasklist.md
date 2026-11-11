# タスクリスト

## 🚨 タスク完全完了の原則

- 全タスクが `[x]` になるまで作業を続ける
- スキップは技術的な理由があるときだけ。理由を書く

## フェーズ1：骨組み
- [x] `.gitignore`・`.prettierrc.json`・`.prettierignore`・`jsconfig.json` を作る
- [x] `package.json`（スクリプト）を作り、依存をインストールする
- [x] `vite.config.js`・`index.html`・`src/main.jsx`・`src/ui/App.jsx`・CSS を作る
- [x] `npm run build` が通ることを確かめる（`prebuild` の検証テストはフェーズ2で作るので、ここでは `vite build` 単体で確認）

## フェーズ2：スキーマと問題データの検証
- [x] `src/schema/` の5つのスキーマと `index.js` を作る
- [x] `src/schema/cross-checks.js` を作る
- [x] `tests/unit/schema/cross-checks.test.js` を作る（テスト用データを作る `tests/helpers/problem-factory.js` も追加）
- [x] `data/chapters.yaml`・`characters.yaml`・`keywords.yaml` を作る
- [x] `vitest.config.js`（unit / integration）と `tests/helpers/load-data.js` を作る
- [x] `tests/integration/data-validation/problems.test.js` と壊れたデータのテストを作る

## フェーズ3：ESLint
- [x] `eslint.config.js` を作る
- [x] わざと違反するファイルで、依存のルールと `dangerouslySetInnerHTML` の禁止が効くことを確かめ、ファイルを消す（schema の「zod と ./ だけ許す」が `group` の `!` 除外では効かなかったため `regex` に変更）

## フェーズ4：E2E
- [x] `playwright.config.js` と `tests/e2e/smoke/app-boot.spec.js` を作る
- [x] Chromium を入れ、`npm run test:e2e` が通ることを確かめる

## フェーズ5：レビュー記録の照合
- [x] `scripts/check-review-files.js` を作る
- [x] `tests/unit/scripts/check-review-files.test.js` を作る

## フェーズ6：Claude Code 向けの決まり
- [x] `CLAUDE.md` を作る

## フェーズ7：検証と記録
- [x] `npm run check` が通る（Prettier で整形し直したあとも通ることを確認。Markdown は `.prettierignore` で対象外にした）
- [x] 実装検証（implementation-validator）→ 指摘への対応
  - [x] [必須] check-review-files.js：ルートで git を実行（サブフォルダ対策）、`-z` で日本語・空白のパス、未知の状態は例外、追跡解除を上書きしない、除外フォルダとの名前変更、表の区分・重複・0行のチェック、`--end-of-options`
  - [x] [必須] ESLint：core で fetch の禁止が上書きで消える問題（共通の定数にまとめる）。core の乱数・時刻、ui の PGlite・localStorage、`./../` の抜け道、`**/ui`、`varsIgnorePattern` を狭める
  - [x] [必須] tokens.css に登場人物の色を定義し、定義があるかを検証テストで確かめる
  - [x] [推奨] cross-checks：display と answer の整合、章・用語・登場人物の id の重なり、文字列の中の大文字・小文字を区別した照合、ファイル名が違ってもIDの重なりを確かめる
  - [x] [推奨] 会話の行数を kind 別に（通常8行・ターニングポイント12行）、keywords の重複禁止
  - [x] [推奨] load-data：読めないファイル・.yml・置き場所の違うファイルを報告。検証テストは safeParse で組み直す
  - [x] [推奨] スキーマ単体テスト、cross-checks の抜けていたケース、git を使う統合テスト
  - [x] [提案] `format:check` を `npm run check` に入れる、E2E で画面のエラーを拾う
  - [x] ~~[提案] `.strict()` を `z.strictObject` へ、カバレッジ計測~~（理由：`.strict()` は Zod 4 でも同じ動き。カバレッジは src/core/ に最初のモジュールを置く作業で入れると design.md の「将来の拡張性」に書いた）
- [x] 永続ドキュメントを今回の内容に合わせて直す（repository-structure・architecture・development-guidelines・functional-design）
- [x] `docs/review/20261111-scaffold.md` を書き、`check-review-files.js` が通る（ルートと `docs/` の中の両方から OK、43ファイル）
- [x] 振り返りを書く

## 実装後の振り返り

**実装完了日**：2026-11-11

**計画と実績の差分**：
- 計画になかったもの：`tests/helpers/problem-factory.js`、`tests/unit/schema/schemas.test.js`、`tests/integration/scripts/check-review-files.test.js`、`npm run format:check`（`check` に含めた）、`tokens.css` の登場人物の色
- 計画から変えたもの：`fetch` などを ESLint の警告ではなくエラーにした（フラット設定でルールが置き換わるため）。会話の行数の上限を kind 別にした。`.prettierignore` に `*.md` を足した
- やらなかったもの：PGlite を使う検証（スコープ外のまま）。`.strict()` → `z.strictObject`、カバレッジ計測（理由は上のタスク）

**学んだこと**：
- ESLint のフラット設定では、同じルールを後のブロックに書くと前の指定が「置き換わる」。共通の禁止は定数にまとめ、全ブロックで並べ直す必要がある
- `no-restricted-imports` の `group` の `!` 除外は `./` に効かない。細かい許可は `regex` で書く
- `git diff` はルート基準、`git ls-files` は今いるフォルダ基準でパスを出す。日本語のパスは `-z` なしだと8進エスケープになる
- 自分でわざと違反を置いて確かめても、実装検証で「本物の git の一時リポジトリ」で試されるまで、サブフォルダ・日本語のパスの不具合に気づかなかった。照合のような道具は、実際の環境の差（実行場所・文字）でテストする

**次回への改善提案**：
- 次の作業「DBが動く」で、PGlite を使う問題データの検証（正解SQLが動く・0行でない・間違いの選択肢が不正解・順番が1つに決まる）と、配る量の確認を入れる
- `src/core/` に最初のモジュールを置く作業で `@vitest/coverage-v8` を入れ、90% の目標を `npm run check` で確かめる
- 次の作業から `feature/<作業名>` ブランチで作る
