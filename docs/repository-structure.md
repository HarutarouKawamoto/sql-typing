# リポジトリ構造定義書 (Repository Structure Document)

> 元にした資料：[architecture.md](architecture.md)（レイヤーと依存のルール）、[functional-design.md](functional-design.md)（コンポーネントとデータの形）。

## プロジェクト構造

```
sql-typing/
├── src/                        # ソースコード（JavaScript）
│   ├── main.jsx                # 入口。<App /> を描画するだけ
│   ├── ui/                     # 画面レイヤー（React）
│   │   ├── App.jsx
│   │   ├── screens/            # 画面単位のコンポーネント
│   │   ├── components/         # 画面の部品
│   │   ├── state/              # Context と reducer（画面の状態）
│   │   └── styles/             # CSS（変数・画面ごとのCSS）
│   ├── core/                   # コアレイヤー（React・PGlite・DOM に依存しない）
│   │   ├── stepper/            # ステップ再生の段階づくり（句ごとに1ファイル）
│   │   └── *.js                # typing-engine / choice-engine / judge など
│   ├── data/                   # データレイヤー（PGlite・問題データ・学習記録）
│   │   └── sql-runner/         # Worker 版と Node 版の SqlRunner
│   └── schema/                 # Zod スキーマ（全レイヤーと tests から使う）
├── data/                       # 問題データ（人が書くもの）
│   ├── chapters.yaml
│   ├── characters.yaml
│   ├── keywords.yaml
│   ├── seeds/                  # 章ごとの初期データSQL
│   └── problems/               # 1問1ファイルの YAML（章ごとのフォルダ）
├── tests/
│   ├── unit/                   # 単体テスト（src/ と同じ形）
│   ├── integration/            # PGlite を使う統合テスト・問題データの検証
│   ├── e2e/                    # Playwright
│   └── helpers/                # テスト用の部品（作り物の localStorage など）
├── scripts/                    # 開発の補助スクリプト
├── public/                     # そのまま配るファイル（ファビコンなど）
├── docs/                       # プロジェクトドキュメント
│   ├── ideas/                  # 壁打ちのメモ（setup-project の入力）
│   └── review/                 # レビュー用の記録（/add-feature 1回につき1ファイル）
├── .steering/                  # 作業ごとの計画（/add-feature が作る）
├── .claude/                    # Claude Code のプロジェクト設定
├── CLAUDE.md
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── eslint.config.js
├── jsconfig.json
└── .prettierrc.json
```

## ディレクトリ詳細

### src/ui/（画面レイヤー）

**役割**: 画面の表示、キー入力・クリックの受付、アニメーション、画面の状態の管理

**配置ファイル**:
- `screens/*.jsx`: 1つの画面（`HomeScreen.jsx`、`PlayScreen.jsx`、`DictionaryScreen.jsx`、`SettingsScreen.jsx`）
- `components/*.jsx`: 画面の部品（`TypingArea.jsx`、`ChoiceList.jsx`、`SqlEditor.jsx`、`StepPlayer.jsx`、`ResultTable.jsx`、`SchemaMap.jsx` など）
- `components/*.module.css`: 部品と同じ名前の CSS Modules
- `state/*.js`: Context・reducer・独自フック（`use-play-session.js` など）
- `styles/`: `tokens.css`（色・余白などの CSS 変数。ライト／ダーク）、`global.css`

**命名規則**:
- コンポーネントのファイルは PascalCase ＋ `.jsx`（中のコンポーネント名と同じ）
- フック・reducer は kebab-case ＋ `.js`（`use-` で始まるものはフック）

**依存関係**:
- 依存可能: `src/core/`、`src/data/`、`src/schema/`
- 依存禁止: なし（最上位のレイヤー）。ただし PGlite・localStorage を直接 `import` / 使用しない（`src/data/` を通す）

**例**:
```
ui/
├── App.jsx
├── screens/
│   ├── HomeScreen.jsx
│   └── PlayScreen.jsx
├── components/
│   ├── TypingArea.jsx
│   └── TypingArea.module.css
├── state/
│   ├── app-context.js
│   └── use-play-session.js
└── styles/
    ├── tokens.css
    └── global.css
```

### src/core/（コアレイヤー）

**役割**: 学習のルールそのもの。タイピングの判定、選択肢の確定、実行結果の比較、句の分解、段階ごとの表、スコア、エラーの和訳

**配置ファイル**:
- `typing-engine.js`: TypingEngine
- `choice-engine.js`: ChoiceEngine
- `clause-splitter.js`: ClauseSplitter
- `judge.js`: Judge
- `scoring.js`: Scoring（速さ・正確さ・ランク・苦手の集計）
- `error-translator.js`: ErrorTranslator
- `error-messages.js`: SQLSTATE ごとの和訳の表（データだけ）
- `stepper/index.js`: `buildSteps`（段階の関数を表で呼び分ける）
- `stepper/from-step.js`、`where-step.js`、`select-step.js`、`distinct-step.js`、`order-by-step.js`、`limit-step.js`: 句ごとの段階づくり
- `sql-text.js`: 文字列リテラル・コメントを見分ける小さな字句解析（TypingEngine・ClauseSplitter・Judge の `require`/`forbid` で共有）

**命名規則**:
- kebab-case ＋ `.js`。1ファイル1つの責務。ファイル名は機能設計のコンポーネント名を kebab-case にしたもの
- 名前付き `export` だけを使う（`export default` を使わない）

**依存関係**:
- 依存可能: `src/schema/`、`pgsql-ast-parser`（`stepper/` と `clause-splitter.js` のみ）
- 依存禁止: `src/ui/`、`src/data/`、React、PGlite、DOM、localStorage。`SqlRunner` は引数で受け取る。乱数・現在時刻も引数で受け取る

**例**:
```
core/
├── typing-engine.js
├── choice-engine.js
├── clause-splitter.js
├── judge.js
├── scoring.js
├── error-translator.js
├── error-messages.js
├── sql-text.js
└── stepper/
    ├── index.js
    ├── from-step.js
    └── where-step.js
```

### src/data/（データレイヤー）

**役割**: PGlite の起動と実行、問題データの読み込み、学習記録の読み書き

**配置ファイル**:
- `sql-runner/sql-runner.js`: `SqlRunner`（打ち切り・実行待ちの列・初期状態への戻し方。中身の PGlite とのやりとりは下の2つに任せる）
- `sql-runner/worker-backend.js`: ブラウザ用（`PGliteWorker` を使う）
- `sql-runner/pglite.worker.js`: Worker の中で動くファイル
- `sql-runner/node-backend.js`: テスト用（Node で PGlite を直接使う）
- `problem-loader.js`: ProblemLoader（`import.meta.glob` で章ごとに読み込み、`src/schema/` で検証）
- `progress-store.js`: ProgressStore（localStorage、記録の形の移し替え）

**命名規則**:
- kebab-case ＋ `.js`。Worker の中で動くファイルは `.worker.js` で終える

**依存関係**:
- 依存可能: `src/schema/`、`@electric-sql/pglite`、`data/`（問題データ）
- 依存禁止: `src/ui/`、`src/core/`、React

### src/schema/（共通の決まり）

**役割**: データの形を Zod で1か所に書く。アプリとテストの両方がここを使う

**配置ファイル**:
- `problem-schema.js`: Problem・Story・Blank・JudgeRule
- `chapter-schema.js`、`character-schema.js`、`keyword-schema.js`
- `progress-schema.js`: 学習記録（`version` ごと）
- `cross-checks.js`: ファイルをまたぐ問題データの決まり（問題IDとファイル名、章の並び、ターニングポイントの位置、用語・登場人物の参照、モード2の選択肢）。PGlite を使わない純粋な関数
- `index.js`: まとめて `export`

**命名規則**: `<対象>-schema.js`。スキーマの変数名は `ProblemSchema` のように PascalCase ＋ `Schema`。JSDoc の型は `/** @typedef {import('zod').infer<typeof ProblemSchema>} Problem */` の形で、スキーマから作る（型とスキーマを二重に書かない）

**依存関係**:
- 依存可能: `zod`
- 依存禁止: `src/` のほかのすべて

### data/（問題データ）

**役割**: 人が書いて増やしていくデータ。コードを変えずに問題を増やすための場所

**配置ファイル**:
- `chapters.yaml`: 全章と出題順
- `characters.yaml`: 登場人物
- `keywords.yaml`: 用語辞典
- `seeds/<章id>.sql`: 章の初期データ（`beginner.sql`、`intermediate.sql`、`advanced.sql`）
- `problems/<章id>/<2桁の番号>-<短い英語名>.yaml`: 問題

**命名規則**:
- 問題のファイル名：`03-where.yaml` のように2桁の番号＋kebab-case の英語。番号は章の中の出題順と一致させる
- 問題の `id` は `<章id>-<2桁の番号>`（`beginner-03`）。ファイル名と一致させる（検証テストで確かめる）
- ターニングポイントは章の最後の番号で `<番号>-turning-point.yaml`

**例**:
```
data/
├── chapters.yaml
├── characters.yaml
├── keywords.yaml
├── seeds/
│   └── beginner.sql
└── problems/
    └── beginner/
        ├── 01-select-all.yaml
        ├── 03-where.yaml
        └── 09-turning-point.yaml
```

### tests/（テストディレクトリ）

#### unit/

**役割**: 単体テスト（PGlite を使わない）

**構造**:
```
tests/unit/
├── core/
│   ├── typing-engine.test.js
│   ├── choice-engine.test.js
│   ├── clause-splitter.test.js
│   ├── scoring.test.js
│   └── error-translator.test.js
├── data/
│   └── progress-store.test.js
├── schema/
│   ├── cross-checks.test.js
│   └── schemas.test.js        # Zod スキーマの決まり（会話の行数・進捗の形など）
└── scripts/
    └── check-review-files.test.js
```

**命名規則**: `<テスト対象のファイル名>.test.js`

#### integration/

**役割**: PGlite（Node 版）を使うテストと、問題データの検証

**構造**:
```
tests/integration/
├── judge/
│   └── judge.test.js
├── stepper/
│   └── beginner-steps.test.js
├── data-validation/
│   └── problems.test.js       # 問題データの検証（安全柵）
└── scripts/
    └── check-review-files.test.js   # 一時フォルダの本物の git で差分の集め方を確かめる
```

**命名規則**: `<機能>.test.js`。`data-validation/` は `npm run validate:data` だけでも走らせられるように、ほかの統合テストと分けておく

#### e2e/

**役割**: Playwright による画面のテスト

**構造**:
```
tests/e2e/
├── smoke/
│   └── app-boot.spec.js       # アプリが開くか（土台づくりで追加）
├── play-modes/
│   ├── mode1-trace.spec.js
│   ├── mode2-choice.spec.js
│   └── mode3-4-write.spec.js
├── progression/
│   └── turning-point.spec.js
└── device/
    └── narrow-screen.spec.js
```

**命名規則**: `<シナリオ>.spec.js`（Vitest のテストと見分けるため `.spec.js` にする）

#### helpers/

**役割**: テストの部品。
- `load-data.js`：`data/` の YAML を Node から読む（検証テスト用）。Zod の失敗を1行ずつの説明にする
- `problem-factory.js`：決まりをすべて満たした問題・章・用語・登場人物を作る（一部だけ上書きして違反を作る）
- `fixtures/`：テスト用の小さなデータ（`broken-problem.yaml`：わざと決まりを破った問題）
- 後で足すもの：`memory-storage.js`（localStorage の作り物）、`make-runner.js`（Node 版の SqlRunner を作る）

### docs/（ドキュメントディレクトリ）

**配置ドキュメント**:
- `product-requirements.md`: プロダクト要求定義書
- `functional-design.md`: 機能設計書
- `architecture.md`: アーキテクチャ設計書
- `repository-structure.md`: リポジトリ構造定義書（本ドキュメント）
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集
- `ideas/`: 壁打ちのメモ（`initial-requirements.md`）
- `review/`: レビュー用の記録。`YYYYMMDD-<機能名>.md`。`/add-feature` 1回（`.steering/` の1フォルダ）につき1ファイル。書き方は開発ガイドラインの「レビュー用の記録」

### scripts/（スクリプトディレクトリ）

**配置ファイル**:
- `check-review-files.js`: `docs/review/` の最新の記録の「変更したファイル一覧」と、`git diff --name-status` のファイル一覧が一致するかを確かめる（レビュー用の記録の抜けを機械的に見つける）
- `new-problem.js`: 問題YAMLのひな形を作る（`node scripts/new-problem.js beginner 10 group-by`）

### .steering/（ステアリングファイル）

**役割**: `/add-feature` 1回分の「今回何をするか」

**構造**:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md
    ├── design.md
    └── tasklist.md
```

**命名規則**: `20261112-mode1-typing` の形（英語の kebab-case）。同じ作業の `docs/review/` の記録は同じ名前にする（`docs/review/20261112-mode1-typing.md`）

### .claude/（Claude Code 設定）

**役割**: このプロジェクト専用の Claude Code 設定

**構造**:
```
.claude/
├── settings.json            # 許可するコマンドなど
├── commands/                # このプロジェクト専用のスラッシュコマンド（必要になったら）
└── skills/                  # このプロジェクト専用のスキル（必要になったら。例：問題YAMLの書き方）
```

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| 画面 | `src/ui/screens/` | PascalCase ＋ `Screen.jsx` | `PlayScreen.jsx` |
| 画面の部品 | `src/ui/components/` | PascalCase ＋ `.jsx` | `TypingArea.jsx` |
| 部品の CSS | 部品と同じ場所 | `<部品名>.module.css` | `TypingArea.module.css` |
| フック | `src/ui/state/` | `use-<名前>.js` | `use-play-session.js` |
| 学習のルール | `src/core/` | kebab-case ＋ `.js` | `typing-engine.js` |
| データの入出力 | `src/data/` | kebab-case ＋ `.js` | `progress-store.js` |
| Worker | `src/data/sql-runner/` | `<名前>.worker.js` | `pglite.worker.js` |
| スキーマ | `src/schema/` | `<対象>-schema.js` | `problem-schema.js` |
| 問題 | `data/problems/<章id>/` | `<2桁>-<英語>.yaml` | `03-where.yaml` |
| 初期データ | `data/seeds/` | `<章id>.sql` | `beginner.sql` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| 単体テスト | `tests/unit/` | `<対象>.test.js` | `typing-engine.test.js` |
| 統合テスト | `tests/integration/<機能>/` | `<機能>.test.js` | `judge.test.js` |
| 問題データの検証 | `tests/integration/data-validation/` | `<対象>.test.js` | `problems.test.js` |
| E2Eテスト | `tests/e2e/<シナリオ群>/` | `<シナリオ>.spec.js` | `mode1-trace.spec.js` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| ツール設定 | プロジェクトルート | `<ツール名>.config.js`（`vite.config.js`、`vitest.config.js`、`playwright.config.js`、`eslint.config.js`） |
| エディタの型補助 | プロジェクトルート | `jsconfig.json` |
| 整形 | プロジェクトルート | `.prettierrc.json` |

## 命名規則

### ディレクトリ名
- **レイヤー**：`ui/`・`core/`・`data/`・`schema/`（アーキテクチャ設計の名前のまま）
- **まとまり**：単数形・kebab-case（`stepper/`、`sql-runner/`、`play-modes/`）
- **例外**：React の慣習に合わせ `screens/`・`components/` は複数形

### ファイル名
- **React コンポーネント**：PascalCase ＋ `.jsx`
- **それ以外の JS**：kebab-case ＋ `.js`
- **定数だけのファイル**：kebab-case ＋ `.js`（`error-messages.js`）。中の定数名は UPPER_SNAKE_CASE（`ERROR_MESSAGES`）

### テストファイル名
- Vitest：`<対象>.test.js`
- Playwright：`<シナリオ>.spec.js`

## 依存関係のルール

### レイヤー間の依存

```
src/ui
  ↓ (OK)          ↓ (OK)
src/core        src/data
  ↓ (OK)          ↓ (OK)
      src/schema
```

**禁止される依存**（ESLint の `no-restricted-imports` で止める）:
- `src/core` → `src/data`・`src/ui`（❌）
- `src/data` → `src/core`・`src/ui`（❌）
- `src/schema` → `src/` のほかすべて（❌）
- `src/core` → `react`・`@electric-sql/pglite`（❌）

`Stepper`・`Judge` が DB を使うときは、`src/ui/` が作った `SqlRunner` を引数で渡す。

### モジュール間の依存

**循環依存の禁止**：同じレイヤーの中で共有したいもの（例：文字列リテラルの見分け方）は、`sql-text.js` のように別のファイルに出し、双方からそれを `import` する。

## スケーリング戦略

### 機能の追加

1. **新しい問題**：`data/problems/<章id>/` に YAML を1つ追加し、`chapters.yaml` に足す。コードは変えない
2. **新しい章**：`chapters.yaml` に章、`data/seeds/` に初期データ、`data/problems/<章id>/` を作る
3. **ステップ再生の新しい句**（中級の `GROUP BY`・`JOIN`）：`src/core/stepper/` に `<句>-step.js` を足し、`stepper/index.js` の表に登録する
4. **上級の専用の見える化**：`src/ui/components/viz/` を作り、`IndexRace.jsx`・`PlanTree.jsx`・`TxTimeline.jsx` を置く。計算部分は `src/core/viz/` に置く

### ファイルサイズの管理

- 1ファイル 300行以下を目安にする。300〜500行で分割を考え、500行を超えたら分ける
- `PlayScreen.jsx` はモードごとの中身が増えやすいので、最初から `PlayMode1.jsx` 〜 `PlayMode34.jsx` に分け、`PlayScreen.jsx` は切り替えだけにする

## 除外設定

### .gitignore
- `node_modules/`
- `dist/`
- `coverage/`
- `test-results/`、`playwright-report/`
- `.env*`
- `*.log`
- `.DS_Store`、`Thumbs.db`

`.steering/` と `docs/review/` は**除外しない**（`docs/review/` はレビューに使うので必ずリポジトリに入れる。`.steering/` は `docs/review/` の記録と対になるので残す）。

### .prettierignore・ESLint の除外
- `dist/`
- `node_modules/`
- `coverage/`
- `test-results/`・`playwright-report/`
- `.steering/`
- `docs/`
- `*.md`（Markdown は整形しない。`CLAUDE.md` もここに入る）
- `package-lock.json`（Prettier のみ）
