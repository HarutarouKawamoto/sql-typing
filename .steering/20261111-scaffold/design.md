# 設計書

## アーキテクチャ概要

アーキテクチャ設計書のレイヤー構造（`src/ui` → `src/core` / `src/data` → `src/schema`）の、入れ物と柵だけを作る。中身のあるのは `src/schema/` だけ。

```
npm run check
  ├─ eslint .                       … 依存のルール・禁止事項
  └─ vitest run
       ├─ unit         tests/unit/**          … cross-checks・check-review-files の部品
       └─ integration  tests/integration/**   … data/ の検証（validate:data はここだけ）
npm run test:e2e
  └─ vite build（prebuild: validate:data）→ vite preview → playwright
node scripts/check-review-files.js <記録> [作業前のコミット]
```

## コンポーネント設計

### 1. `src/schema/`（Zod スキーマ）

**責務**:
- 機能設計書のデータモデル（Chapter・Problem・Character・Keyword・Progress）を Zod で書く
- JSDoc の型をスキーマから作る

**実装の要点**:
- `zod` 以外を `import` しない
- 機能設計書に書いた「1ファイルの中で決まる制約」はスキーマの中（`refine`）、「ファイルをまたぐ制約」は `cross-checks.js` に分ける

### 2. `src/schema/cross-checks.js`

**責務**:
- ファイルをまたぐ決まりを、純粋な関数で確かめ、見つかった問題を文字列の配列で返す
  - 問題IDとファイル名の一致、IDの重なり
  - `chapters.yaml` の `problemIds` と問題ファイルの対応、`chapterId`・`order` の一致
  - ターニングポイントは章に1つまでで、あるなら最後
  - `keywords` が用語辞典にある、`speaker` が登場人物にある
  - モード2：空欄の正解が表示用SQLに1回だけ出る、選択肢が2〜4個、どれも別の選択肢の先頭部分でない

**実装の要点**:
- 文字の比べ方は、大文字・小文字と連続する空白の違いを無視する（TypingEngine より厳しめに判定し、紛らわしい選択肢を確実に止める）
- PGlite を使う検証（正解SQLが動くか、間違いの選択肢が不正解になるか、順番が1つに決まるか）は次の作業で `tests/integration/data-validation/` に足す

### 3. `scripts/check-review-files.js`

**責務**:
- レビュー用の記録の「変更したファイル一覧」の表と、git の差分を照らし合わせる

**実装の要点**:
- 差分 ＝ `git diff --name-status -M <作業前>`（作業前から作業ツリーまで）＋ 追跡されていないファイル（`git ls-files --others --exclude-standard`、すべて「追加」）
- 作業前のコミットを省いたとき：コミットがあれば `HEAD`、まだ1つもなければ空のツリー（`4b825dc642cb6eb9a060e54bf8d69288fbee4904`）
- `docs/review/` と `.steering/` は比べない
- 区分は A=追加、M/T=変更、D=削除、R=名前変更（新しいパスで比べる）
- 一覧にないファイル・差分にないファイル・区分の違いを出して、1つでもあれば終了コード1
- 部品（表の読み取り、`--name-status` の読み取り、比べる処理）は `export` して単体テストする

### 4. ESLint（`eslint.config.js`）

**責務**:
- 依存のルールを `no-restricted-imports` で止める

| ファイル | 禁止する import |
|---|---|
| `src/core/**` | `**/ui/**`・`**/data/**`・`react`・`react-dom`・`@electric-sql/pglite` |
| `src/data/**` | `**/ui/**`・`**/core/**`・`react`・`react-dom` |
| `src/schema/**` | `**/ui/**`・`**/core/**`・`**/data/**` と、`zod` 以外のパッケージ |

- `dangerouslySetInnerHTML` を `no-restricted-syntax` でエラーにする
- `src/` で `fetch`・`XMLHttpRequest`・`WebSocket` を `no-restricted-globals` で警告する

**実装の要点**:
- `no-unused-vars` は、JSX でだけ使う大文字の名前を誤って報告しないよう `varsIgnorePattern: '^[A-Z_]'`

### 5. 画面（最小）

- `index.html` → `src/main.jsx` → `src/ui/App.jsx`。「SQL Typing」と「準備中」を表示
- `src/ui/styles/tokens.css`（ライト／ダークの色の変数）、`global.css`

## データフロー

### 問題データの検証
```
1. tests/integration/data-validation/problems.test.js が data/ の YAML を fs と yaml で読む
2. 各ファイルを src/schema/ の Zod スキーマで検証する
3. cross-checks.js でファイルをまたぐ決まりを確かめる
4. 1つでも問題があればテストが失敗し、prebuild で build が止まる
```

## エラーハンドリング戦略

- スキーマの検証の失敗は、どのファイルのどの項目かを `path` 付きでテストの失敗メッセージに出す
- `check-review-files.js` は、git が使えない・記録に表がないときに、理由を出して終了コード2で終わる（照合の不一致の1と区別する）

## テスト戦略

### ユニットテスト
- `cross-checks.js`：正しいデータで問題0件、各決まりの違反で1件ずつ
- `check-review-files.js` の部品：表の読み取り、`--name-status` の読み取り（名前変更を含む）、抜け・余分・区分違い

### 統合テスト
- `data/` の実ファイルの検証（今は章1つ・問題0問）
- テスト用の壊れたデータ（`tests/helpers/fixtures/`）で、スキーマが失敗すること

### E2E
- トップページを開くと「SQL Typing」が見える

## 依存ライブラリ

アーキテクチャ設計書の表のとおり。ESLint 10 のフラット設定のために `@eslint/js`・`globals`・`eslint-plugin-react-hooks` を追加する。

```json
{
  "dependencies": {
    "react": "^19.3", "react-dom": "^19.3",
    "@electric-sql/pglite": "~0.5", "pgsql-ast-parser": "^12",
    "motion": "^14", "@xyflow/react": "^12", "zod": "^4"
  },
  "devDependencies": {
    "vite": "^8", "@vitejs/plugin-react": "^6", "@rollup/plugin-yaml": "^5", "yaml": "^2",
    "vitest": "^5", "@playwright/test": "^1",
    "eslint": "^10", "@eslint/js": "^10", "globals": "^17", "eslint-plugin-react-hooks": "^7",
    "prettier": "^3"
  }
}
```

（`yaml` は検証テストで Node から読むために使う。アプリは `@rollup/plugin-yaml` で読むので devDependencies に置く）

## ディレクトリ構造

```
.gitignore / .prettierrc.json / .prettierignore / jsconfig.json
package.json / package-lock.json / index.html
vite.config.js / vitest.config.js / playwright.config.js / eslint.config.js
CLAUDE.md
src/main.jsx
src/ui/App.jsx
src/ui/styles/tokens.css, global.css
src/schema/index.js, chapter-schema.js, problem-schema.js, character-schema.js,
           keyword-schema.js, progress-schema.js, cross-checks.js
data/chapters.yaml, characters.yaml, keywords.yaml
scripts/check-review-files.js
tests/unit/schema/cross-checks.test.js
tests/unit/scripts/check-review-files.test.js
tests/integration/data-validation/problems.test.js
tests/helpers/load-data.js
tests/helpers/fixtures/broken-problem.yaml
tests/e2e/smoke/app-boot.spec.js
```

## 実装の順序

1. 骨組みの設定ファイルと依存のインストール
2. 最小の画面 → `npm run dev` / `npm run build`
3. スキーマ → cross-checks → 単体テスト → 検証テスト
4. ESLint → わざと違反して確かめる
5. Playwright
6. check-review-files.js と単体テスト
7. CLAUDE.md
8. ドキュメントの更新（リポジトリ構造に `tests/e2e/smoke/` と `cross-checks.js` を足す）

## セキュリティ考慮事項

- 外部に送る処理を書かない。ESLint で `fetch` などを警告する
- `check-review-files.js` は git を `execFileSync` で呼び、引数をシェルに通さない

## パフォーマンス考慮事項

- `optimizeDeps.exclude` に `@electric-sql/pglite` を入れる（PGlite の WebAssembly を Vite の事前バンドルに巻き込まないため。次の作業で使う）

## 将来の拡張性

- 次の作業で `tests/integration/data-validation/` に PGlite を使う検証を足す
- `src/core/` のカバレッジ測定（`@vitest/coverage-v8`）は、`src/core/` に最初のモジュールを置く作業で入れる
