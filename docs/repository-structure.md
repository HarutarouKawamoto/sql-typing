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
├── .prettierrc.json
└── .gitattributes              # 改行を LF に固定（下の「改行」）
```

## ディレクトリ詳細

### src/ui/（画面レイヤー）

**役割**: 画面の表示、キー入力・クリックの受付、アニメーション、画面の状態の管理

**配置ファイル**:
- `screens/*.jsx`: 1つの画面（`HomeScreen.jsx`、`ModeSelect.jsx`、`StoryScreen.jsx`、`PlayScreen.jsx`、`ReplayDemoScreen.jsx`、`SettingsScreen.jsx`、`DictionaryScreen.jsx`）
- `components/*.jsx`: 画面の部品（`TypingArea.jsx`、`ChoiceList.jsx`、`SqlEditor.jsx`、`StepPlayer.jsx`、`ResultTable.jsx`、`SchemaMap.jsx` など）
- `components/*.module.css`: 部品と同じ名前の CSS Modules
- `state/*.js`: Context・reducer・独自フック。
  - `database.js`：アプリに1つだけの SqlRunner と、起動の状態を返す `useDatabaseStatus`
  - `progress.js`：学習記録を読み、遊んだ結果・設定を記録して保存する `useProgress`（設定画面から記録を消す `clearAll`）
  - `reduced-motion.js`：OS の「動きを減らす」設定がオンか（オンなら見える化B を流さない）
  - `use-typing-session.js`：なぞり書きの1回分（keydown を1か所で受ける・時計・打ちながらの実行）
  - `typing-keys.js`：React に依存しない部品（キーの判定 `classifyKeyEvent`、修飾キーのない Enter `isPlainEnter`、クリアの結果のキー `classifyResultKey`、ボタン・入力欄の中か `isInteractiveTarget`・`isTextEntryTarget`、最新の1つだけ実行する `createLatestOnlyRunner`）。`tests/unit/ui/` で単体テストする
  - `use-step-replay.js`：ステップ再生の進み方をタイマーと React につなぐ
  - `step-replay-machine.js`：ステップ再生の進み方の決まり（React に依存しない reducer。`tests/unit/ui/` で単体テスト）
  - `step-replay-timing.js`：段階ごとの長さと速さの掛け算（React に依存しない。`tests/unit/ui/` で単体テスト）
  - `use-write-session.js`：書く画面（モード3・4）の1回分（テーブルの一覧と正解の結果を1回だけ作る・判定を呼ぶ・時計・記録）
  - `write-session-machine.js`：書く画面の決まり（時計・実行の回数・判定中は次を受けない・ヒントの数・クリア。React に依存しない reducer。`tests/unit/ui/` で単体テスト）
  - `editor-keys.js`：入力欄のキーの判定（Ctrl+Enter・Tab）とスペース2つの入れ方（React に依存しない。`tests/unit/ui/` で単体テスト）
  - `local-date.js`：学習記録の日付（その人のタイムゾーンの `YYYY-MM-DD`）
  - `navigation.js`：画面の切り替え（一覧・設定・用語辞典・モード選択・会話・遊ぶ）の reducer（React に依存しない。`tests/unit/ui/` で単体テスト）
  - `use-problems.js`：全章の問題を1回だけ読み、ターニングポイントの ID の集合を返す
  - `use-narrow-screen.js`：画面の幅が 768px 未満か
  - `best-text.js`：モードの名前と最高記録の文（`tests/unit/ui/` で単体テスト）
  - `use-count-up.js`：数を0から目標まで増やす（インデックスの比較のカウンター）
  - `keyword-words.js`：用語辞典の用語（`KEYWORD_WORDS`・`KEYWORD_BY_WORD`。1回だけ読む）
  - `join-colors.js`：JOIN の段階の色分け（つながる行どうしを同じ色。React に依存しない。`tests/unit/ui/` で単体テスト）
  - `schema-layout.js`：DBの地図の箱の置き方（親を左・子を右、親は子のすぐ左。React に依存しない。`tests/unit/ui/` で単体テスト）
  - `db-jobs.js`：DB を何回も使う仕事（問題の準備・正解の結果づくり・判定・ステップ再生の段階づくり）を1つずつ流す列 `runDbJob`（`tests/unit/ui/` で単体テスト）
- `components/StepPlayer.jsx`・`StepTable.jsx`：見える化A（ステップ再生）の画面と、1段階の表
- `components/PlayMode12.jsx`：モード1・2（なぞり書き・打って選ぶ）。`components/PlayMode34.jsx`：モード3・4（書いて判定）
- `components/TypingArea.jsx`・`ChoiceList.jsx`：打つSQL（モード2の空欄は「？」の箱で隠す）と、モード2の選択肢
- `components/SqlEditor.jsx`・`HintPanel.jsx`・`JudgePanel.jsx`・`WriteResult.jsx`：書く画面の入力欄・ヒント・判定の結果・クリアの結果
- `components/StoryPanel.jsx`・`StoryLines.jsx`・`AfterStory.jsx`：会話を1行ずつ送る部品、会話の行の描き方、クリア後の会話と次への道
- `components/ReorderIntro.jsx`：見える化B（句のチップが書いた順から実行順へ入れ替わる）
- `components/KeywordTipLayer.jsx`・`KeywordText.jsx`：キーワードの説明（ページ全体で1つ）と、SQLの文字に `data-keyword` を付けて描く部品
- `screens/DictionaryScreen.jsx`：用語辞典
- `components/IndexRace.jsx`・`IndexRacePanel.jsx`：上級の見える化（インデックスあり・なしの比較）と、比較を作って出す枠
- `components/SchemaMap.jsx`・`SchemaMapPanel.jsx`：DBの地図（React Flow の箱と線）と、開いて見る枠（読み込み・中身を見る）
- `screens/ReplayDemoScreen.jsx`：ステップ再生の見本（`/?demo`）
- `screens/SettingsScreen.jsx`：設定（見える化B の on/off・ステップ再生の速さ・学習記録を消す）
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
- `choice-engine.js`: ChoiceEngine（モード2の空欄で、選択肢を打って選ぶ）
- `blank-typing.js`: 空欄つきのなぞり書き（空欄の外は TypingEngine、中は ChoiceEngine。空欄がなければ TypingEngine と同じなので、モード1もこれで動かす）
- `clause-splitter.js`: ClauseSplitter
- `reorder.js`: 見える化B のチップ（`buildReorderChips`。句の書いた順と実行順）
- `touched-tables.js`: SQLが触っているテーブル（DBの地図で光らせる）
- `explain.js`: 実行計画（EXPLAIN ANALYZE）を読む・読んだ行の数・変える前と後の比較（上級の見える化）
- `keyword-spans.js`: SQLの中の用語辞典の語の場所（キーワードの説明を出すため。複数語の用語をまとめる）
- `dictionary.js`: 用語辞典の中身（レベルごとの並びと、初めて出てくる問題）
- `judge.js`: Judge
- `scoring.js`: Scoring（速さ・正確さ・ランク・苦手の集計）
- `error-translator.js`: ErrorTranslator
- `error-messages.js`: SQLSTATE ごとの和訳の表（データだけ）
- `stepper/index.js`: `buildSteps`（初級の単一テーブルの段階を、句の範囲で元のSQLを切り貼りして作る）
- `stepper/select-list.js`: SELECT 句を項目に分け、元の列と別名を見分ける `splitSelectList`
- `stepper/group-by.js`: GROUP BY 句を項目に分ける `splitGroupBy`（ROLLUP などは扱わない）と、列の番号・SELECT の別名を式に置き換える `resolveGroupItems`
- `stepper/aggregates.js`: サブクエリの外の集計関数・ウィンドウ関数を見つける
- `stepper/from-clause.js`: FROM 句を最初のテーブルと JOIN の並びに分ける `parseFrom`
- 集計の段階は `index.js` の `pushGroupedSteps`（段階ごとの関数）と `group-by.js`。JOIN の段階は `index.js` の `pushJoinStep` と `from-clause.js`
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
├── blank-typing.js
├── clause-splitter.js
├── reorder.js
├── touched-tables.js
├── explain.js
├── keyword-spans.js
├── dictionary.js
├── judge.js
├── scoring.js
├── error-translator.js
├── error-messages.js
├── sql-text.js
└── stepper/
    ├── index.js
    ├── select-list.js
    ├── group-by.js
    ├── aggregates.js
    └── from-clause.js
```

### src/data/（データレイヤー）

**役割**: PGlite の起動と実行、問題データの読み込み、学習記録の読み書き

**配置ファイル**:
- `sql-runner/sql-runner.js`: `SqlRunner`（打ち切り・実行待ちの列・初期状態への戻し方。中身の PGlite とのやりとりは下の2つに任せる）
- `sql-runner/worker-backend.js`: ブラウザ用。自前の Worker（`pglite.worker.js`）とやりとりする
- `sql-runner/pglite.worker.js`: Worker の中で PGlite を動かすファイル
- `sql-runner/node-backend.js`: テスト用（Node で PGlite を直接使う）。`index.js` からは export しない（画面のビルドに入れない）
- `sql-runner/value-parsers.js`: 型ごとの値の変換（Worker 版と Node 版で共有）
- `sql-runner/index.js`: 画面から使うものをまとめて export
- `seed-loader.js`: `data/seeds/*.sql` を `import.meta.glob` の `?raw` で文字列として読む
- `problem-loader.js`: ProblemLoader（`import.meta.glob` で章ごとに読み込み、`src/schema/` で検証）
- `progress-store.js`: ProgressStore（localStorage、記録の形の移し替え）
- `table-list.js`: 今の DB にあるテーブルと列の一覧（書く画面で、地図を開かなくても名前がわかるように使う）
- `schema-info.js`: DBの地図の中身（テーブル・列・型・主キー・外部キー `loadSchema`、テーブルの先頭の行と行数 `loadTablePreview`）

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
│   ├── beginner.sql
│   ├── intermediate.sql        # products は beginner.sql と同じ。customers・orders・order_items を足す
│   └── advanced.sql            # intermediate.sql と同じ。access_logs 5万行を足す
└── problems/
    ├── beginner/
    │   ├── 01-select-all.yaml
    │   ├── 02-select-columns.yaml
    │   ├── …（03〜08）
    │   └── 09-turning-point.yaml   # ターニングポイント（kind: turningPoint）
    └── intermediate/
        ├── 01-count-sum.yaml
        ├── …（02〜12。集計・JOIN・サブクエリ・CASE・INSERT・UPDATE・DELETE）
        └── 13-turning-point.yaml   # 月次レポート
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
│   ├── blank-typing.test.js
│   ├── clause-splitter.test.js
│   ├── reorder.test.js
│   ├── group-by.test.js
│   ├── from-clause.test.js
│   ├── touched-tables.test.js
│   ├── explain.test.js
│   ├── keyword-spans.test.js
│   ├── dictionary.test.js
│   ├── scoring.test.js
│   ├── judge-compare.test.js  # Judge の純粋な部分（値・表の比べ方、require・forbid の探し方）
│   └── error-translator.test.js
├── data/
│   ├── progress-store.test.js
│   ├── sql-runner.test.js     # 作り物のバックエンドで、実行待ちの列・打ち切り・起動の再試行
│   ├── table-list.test.js     # 作り物の runner で、一覧が読めないとき
│   └── value-parsers.test.js
├── schema/
│   ├── cross-checks.test.js
│   └── schemas.test.js        # Zod スキーマの決まり（会話の行数・進捗の形など）
├── ui/
│   ├── typing-keys.test.js    # 画面の、React に依存しない部品
│   ├── step-replay-timing.test.js
│   ├── step-replay-machine.test.js
│   ├── editor-keys.test.js
│   ├── write-session-machine.test.js
│   ├── db-jobs.test.js
│   ├── schema-layout.test.js
│   ├── join-colors.test.js
│   ├── local-date.test.js
│   ├── navigation.test.js
│   └── best-text.test.js
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
│   └── judge.test.js          # 本物の PGlite で判定（正解・別解・間違いの種類・エラー・書き換え系・DB の戻し方）
├── stepper/
│   ├── beginner-steps.test.js # 初級9問の形のステップ再生が、元のSQLの結果と一致する
│   ├── group-by-steps.test.js # 集計（GROUP BY・HAVING・集計関数）の段階
│   └── join-steps.test.js     # JOIN の段階（中級の初期データ）
├── sql-runner/
│   └── node-runner.test.js    # Node 版の PGlite で、結果の形・値の型・エラー・初期状態への戻し方
├── data/
│   ├── table-list.test.js     # テーブルと列の一覧の読み方
│   └── schema-info.test.js    # DBの地図の中身（列・型・主キー・外部キー・先頭の行と行数）
├── explain/
│   └── compare-change.test.js # インデックスあり・なしの比較（上級の初期データ）
├── data-validation/
│   ├── problems.test.js       # 問題データの検証（安全柵）。初期データの決まり・正解SQLの実行も
│   └── answer-checks.test.js  # 「正解SQLが実行でき0行でない」の検証そのものが働くこと
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
│   ├── mode3-4-write.spec.js  # 見える化B（句の入れ替わり）も
│   └── typing-layout.spec.js  # 打っている途中に入力欄の大きさが変わらない・依頼の会話を見返せる
├── visualization/
│   ├── step-replay.spec.js    # 見える化A（ステップ再生）
│   ├── step-replay-marks.spec.js # 見本のページで、印（消える行・列、まとまる行）の数を確かめる
│   └── index-race.spec.js     # 見本のページで、インデックスあり・なしの比較
├── progression/
│   ├── home-story.spec.js     # 一覧・モード選択・依頼の会話・クリア後の会話・星
│   ├── turning-point.spec.js  # ターニングポイントが開く・印・説明・11行の会話・クリア後・モード4で中級が開く
│   └── intermediate.spec.js   # 中級の一覧・UPDATE の問題・中級の DBの地図
├── settings/
│   └── settings.spec.js       # 設定の画面（速さ・見える化B の on/off・学習記録を消す）
├── dictionary/
│   ├── keyword-tip.spec.js    # キーワードにカーソルを当てると説明（モード1・ステップ再生）
│   └── dictionary.spec.js     # 用語辞典（初級16語・中級20語・初めて出てくる問題・幅375pxでタップ）
├── map/
│   └── schema-map.spec.js     # DBの地図（モード選択・モード1・モード4・幅375px）
├── device/
│   └── narrow-screen.spec.js  # 幅375pxでは遊べず、会話は読める
└── helpers/
    ├── open-play.js           # 一覧から1問目のモードを選び、会話を飛ばして遊ぶ画面を開く
    └── seed-progress.js       # 学習記録を localStorage に入れてから開く（何問もクリアした状態・設定を変えた状態から始める。中級の n 問目までは `intermediateUpTo`）
```

**命名規則**: `<シナリオ>.spec.js`（Vitest のテストと見分けるため `.spec.js` にする）

#### helpers/

**役割**: テストの部品。
- `load-data.js`：`data/` の YAML を Node から読む（検証テスト用）。Zod の失敗を1行ずつの説明にする
- `problem-factory.js`：決まりをすべて満たした問題・章・用語・登場人物を作る（一部だけ上書きして違反を作る）
- `fixtures/`：テスト用の小さなデータ（`broken-problem.yaml`：わざと決まりを破った問題）
- `make-runner.js`：Node 版の SqlRunner を作る。`data/seeds/` の初期データを読む
- `answer-checks.js`：PGlite を使う問題データの検証（正解SQLが実行でき0行でない）
- `memory-storage.js`：localStorage の作り物（`failOnSet` で書けない環境の真似もできる。`key`・`length` でキーを順に見られる）
- `answer-checks.js` の `checkClausePrefixes`：見える化C のため、SELECT の問題の句の途中までのSQLを実行しても止まらないことを確かめる
- `answer-checks.js` の `checkWrongChoices`：間違いの選択肢を入れたSQLが、判定（Judge）で正解にも `ruleViolation` にもならないことを確かめる
- `answer-checks.js` の `checkVisuals`：上級の見える化（インデックス）の問題で、正解SQLで比べる問い合わせの読む行が減ることを確かめる
- `answer-checks.js` の `checkOrderDetermined`：`ordered: true` の問題で、並び順が1つに決まることを確かめる
- `answer-checks.js` の `checkStepsBuild`：正解SQLのステップ再生が作れる（`mismatch`・`error` にならない）ことを確かめる
- `answer-checks.js` の `checkBlanksPlayable`：モード2の空欄が表示用SQLの中に見つかり（画面と同じ `locateBlanks`）、選択肢がすべて打てることを確かめる

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
3. **ステップ再生の新しい句**：中級の `GROUP BY`・`JOIN` は `stepper/index.js` の段階ごとの関数（`pushGroupedSteps`・`pushJoinStep`）と、句を読む小さなファイル（`group-by.js`・`from-clause.js`）で足した。上級の句も同じ形で足す。`build()` が長くなってきたので、上級で足す前に FROM・WHERE・SELECT 以降の関数に分ける
4. **上級の専用の見える化**：画面の部品は `src/ui/components/` に置く（`IndexRace.jsx`・`IndexRacePanel.jsx`。このあと `PlanTree.jsx`・`TxTimeline.jsx`）。計算部分は `src/core/` に置く（`explain.js`）。問題に出すときは問題YAMLの `visual` に書く

### ファイルサイズの管理

- 1ファイル 300行以下を目安にする。300〜500行で分割を考え、500行を超えたら分ける
- `PlayScreen.jsx` はモードごとの中身が増えやすいので、最初から `PlayMode12.jsx`（打つモード）と `PlayMode34.jsx`（書くモード）に分け、`PlayScreen.jsx` は切り替えだけにする

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

### 改行（.gitattributes）
- すべての文字のファイルの改行を LF に固定する（`* text=auto eol=lf`）。Windows の `core.autocrlf=true` でも作業ツリーが CRLF にならず、Prettier（LF 前提）の確認が落ちない
- 画像・フォント・`.wasm` は `binary`（改行を変換しない）。新しい種類の文字ではないファイルを置くときは、ここに足す

### .prettierignore・ESLint の除外
- `dist/`
- `node_modules/`
- `coverage/`
- `test-results/`・`playwright-report/`
- `.steering/`
- `docs/`
- `*.md`（Markdown は整形しない。`CLAUDE.md` もここに入る）
- `package-lock.json`（Prettier のみ）
