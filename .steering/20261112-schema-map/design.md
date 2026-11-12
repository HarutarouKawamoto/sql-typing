# 設計書

## コア：`src/core/touched-tables.js`

```js
/** @returns {string[]} tableNames のうち sql に出てくるもの（tableNames の順） */
export function touchedTables(sql, tableNames) {}
```

- `tokenize`（`sql-text.js`）の `word` を小文字で、`quoted`（`"..."`）は中身そのままで比べる。`string`・`comment` は見ない
- テーブル名は小文字で持つ前提（PostgreSQL は引用符なしの名前を小文字にする）。`"Products"` は `Products` と比べるので `products` に当たらない（PostgreSQL と同じ）

## データ：`src/data/schema-info.js`

```js
/**
 * @typedef {{ name: string, type: string, primaryKey: boolean }} SchemaColumn
 * @typedef {{ table: string, columns: SchemaColumn[] }} SchemaTable
 * @typedef {{ table: string, column: string, refTable: string, refColumn: string }} SchemaRelation
 * @returns {Promise<{ tables: SchemaTable[], relations: SchemaRelation[] }>}
 */
export async function loadSchema(runner) {}
/** @returns {Promise<{ result: QueryResult, total: number }>} */
export async function loadTablePreview(runner, table, limit = 20) {}
```

- 列：`information_schema.columns`（`public`、テーブル名 → 定義の順）。型は `data_type` を短くする（`integer`→`int`、`character varying`→`varchar`、`timestamp without time zone`→`timestamp`、`boolean`→`bool`、ほかはそのまま）
- 主キー・外部キー：`information_schema.table_constraints` ＋ `key_column_usage` ＋ `constraint_column_usage`
- 先頭の行：`SELECT * FROM "<table>" LIMIT n` と `SELECT count(*) FROM "<table>"`（名前の `"` は2つにする）。エラーは例外にする（呼ぶ側が知らせる）

## 画面

### 置き方の計算：`src/ui/state/schema-layout.js`
- `layoutTables(tables)`：テーブルを横に3つずつ並べた位置 `{ [table]: { x, y } }`。行の高さは、その行で一番列の多い箱に合わせる（React に依存しない。単体テスト）
- （実装検証の必須1で変えた）`layoutTables(tables, relations)`：親（指される側）を左の列、子を右の列に置き、同じ列は上から積む。線は親の右から子の左へ

### `src/ui/components/SchemaMap.jsx`
- props：`{ tables, relations, newTables, touched, selected, onSelect }`
- React Flow のノードの種類 `table`（自前の `TableNode`）。左に入る口・右に出る口（Handle）
- 線：外部キー → 主キー。`smoothstep`。両方のテーブルが `touched` なら太く青
- 設定：`fitView`、`zoomOnScroll={false}`・`preventScrolling={false}`（ページのスクロールを奪わない）、`deleteKeyCode={null}`・`selectionKeyCode={null}`・`multiSelectionKeyCode={null}`（モード1・2で打つキーを奪わない・箱を消さない）、`nodesConnectable={false}`、`proOptions={{ hideAttribution: true }}` は使わない（表示の決まりを守る）
- ノードを押したら `onSelect(table)`
- `data-testid="schema-table-<table>"`、`data-touched`・`data-new`

### `src/ui/components/SchemaMapPanel.jsx`
- props：`{ runner, chapter, sql, prepareDb?, databaseStatus }`（実装で `prepare`・`ready` から変えた）
  - `chapter`：`tables`・`newTables`
  - `sql`：光らせるSQL（なければ光らせない）
  - `prepareDb`：`() => Promise<void>`。モード選択のときだけ渡す（App が章の初期データと問題の `extraSql` で組み立てる。遊ぶ画面は PlayScreen が準備済み）
  - `databaseStatus`：`'starting' | 'ready' | 'error'`（実装検証で、起動の失敗を知らせるために `ready` から変えた）
- 開いたときに1回だけ `runDbJob` でスキーマを読む（`prepare` があれば先に `runner.prepare`）
- 章の `tables` にあるものだけを地図に出す
- 「中身を見る」のボタンと、選んだテーブルの先頭20行（`ResultTable`）・「全N行」
- 中身は選ぶたびに `runDbJob` で読む。読めなければ「読めませんでした」
- 開いていないときは読まない（`<details>` の `onToggle` で開いたことを知る）

### 出す場所
- `ModeSelect`：`<details>`「DBの地図を見る」。App が `runner`・章・`prepareDb` を渡す（props に `runner`・`chapter`・`prepareDb`）
- `PlayMode12`：「依頼の会話を見る」の下に `<details>`「DBの地図を見る」。`sql` は表示用SQL（モード2は `maskBlankAnswers` で空欄の答えを空白にしたもの。実装検証の必須2）
- `PlayMode34`：依頼の下に `<details>`。`sql` は今書いているSQL
- PlayScreen・PlayMode12・PlayMode34 に `chapter` を渡す（PlayScreen は今も章を読んでいる）

## テスト
- 単体：`tests/unit/core/touched-tables.test.js`、`tests/unit/ui/schema-layout.test.js`
- 統合：`tests/integration/data/schema-info.test.js`（初級の products：列・型・主キー。外部キーのある2つのテーブル。先頭20行と行数。変わった名前のテーブルの引用）
- E2E：`tests/e2e/map/schema-map.spec.js`（モード選択から開く・中身・狭い画面・モード1で光る・モード4で書くと光る）

## 影響するドキュメント
- functional-design：コンポーネントの表（SchemaMap・SchemaMapPanel・ModeSelect・PlayMode12/34）、データレイヤーに schema-info、コアに touched-tables、遊ぶ画面の配置（右下の小窓 → 開いて見る）、狭い画面の説明、テスト戦略
- repository-structure：新しいファイル
- architecture：変更なし（React Flow はもう書いてある）か確かめる
