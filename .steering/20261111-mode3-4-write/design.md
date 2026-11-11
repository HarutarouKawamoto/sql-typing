# 設計書

## アーキテクチャ概要

```
PlayScreen（mode '3' | '4'）
└── PlayMode34
    ├── 依頼の会話・テーブルの一覧（loadTableList）
    ├── SqlEditor（textarea。キーの扱いは editor-keys.js）
    ├── HintPanel（モード3）
    ├── JudgePanel（判定の結果）／ WriteResult（クリア）
    └── ResultTable ⇄ StepPlayer（実行のたび）
状態：use-write-session.js（判定を呼ぶ）＋ write-session-machine.js（reducer）
```

- 判定は `src/core/judge.js` の `computeExpected`（問題を開いたとき1回）と `judge` を、画面のフックから呼ぶ
- 時間・回数・ヒントの数の決まりは reducer（`src/ui/state/write-session-machine.js`）にまとめ、単体テストする（React の部品を描く道具を足さない。ステップ再生と同じやり方）

## 機能設計書から変えた点

- 依頼の会話は、StoryPanel ができるまで、舞台の上に全部の行を並べて見せる
- テーブルの一覧（仮）を足す。DBの地図（SchemaMap）ができたら置き換える

## コンポーネント設計

### 1. `src/data/table-list.js`
- `loadTableList(runner)`：`information_schema.columns` から public のテーブルと列を読み、`[{ table, columns: string[] }]` にする（テーブル名の順、列は定義の順）
- DB の中を読むので data に置く（ui は SqlRunner を直接たたかない方針に合わせる）

### 2. `src/ui/state/editor-keys.js`（React に依存しない）
- `classifyEditorKey(event)`：`'run'`（Ctrl / ⌘ + Enter）・`'indent'`（Tab、Shift・Ctrl なし）・`'exit'`（Esc）・`'none'`。日本語入力の変換中は `'none'`
- `insertIndent(value, start, end)`：選んだ範囲をスペース2つに置き換え、`{ value, cursor }` を返す

### 3. `src/ui/state/write-session-machine.js`（reducer）
- 状態：`startedAt`・`finishedAt`・`runs`・`hintsOpened`・`judging`・`last`（最後の判定と書いたSQL）・`cleared`
- 動き：`edit(time)`（最初の入力で時計を始める）・`runStart(time)`（判定中なら何もしない。実行の回数を足す。時計がまだなら始める）・`runEnd(result, sql)`（correct ならクリア。時計はその実行を押したときで止める。実装検証のあとで判定の時間を数えないように変えた）・`openHint(max)`（3つまで）
- `canRun(state, sql)`：判定中・クリア済み・空白だけのときは実行しない

### 4. `src/ui/state/use-write-session.js`
- 問題を開いたら `computeExpected` を1回。失敗したら「問題の正解を作れませんでした」
- `run(sql)`：reducer の `runStart` → `judge` → `runEnd`。正解なら `onRecord`（mode・時間・runs・モード3なら hintsOpened）
- 部品が消えたあとに判定が終わっても、状態を変えない

### 5. 画面の部品
- `SqlEditor.jsx`：textarea（`spellCheck` オフ・自動の大文字オフ）。Ctrl+Enter で onRun、Tab でスペース2つ、Esc で onExit
- `HintPanel.jsx`：「ヒントを開く（1/3）」ボタンと、開いたヒントの一覧
- `JudgePanel.jsx`：判定の結果の見出しと説明。error は題名・原因の箇条書き・`<details>` の原文
- `WriteResult.jsx`：クリア、時間・実行した回数・ヒントの数
- `PlayMode34.jsx`：上の全部をまとめる。クリアのあとは入力欄を読み取りだけにし、入力欄の外の Enter でもう一度
- 結果の表とステップ再生：最後の判定に `mine` があれば表を出す。「ステップ再生を見る」で StepPlayer（key に実行の回数を入れ、実行し直したら表に戻す）

### 6. `PlayScreen.jsx`・`App.jsx`
- PlayScreen は mode '3'・'4' で PlayMode34 を出す（'2' は「このモードはまだありません」のまま）
- App の仮の入口に2つのボタンと、モード3・4の最高記録

## 判定とステップ再生の順番

- 判定中は実行させない（`judge` は reset → 実行 → reset を順に行い、2つを同時に呼ぶと割り込まれる）
- ステップ再生は判定が終わってから、押したときだけ作る。実行し直すと表に戻り、作りかけのステップ再生は捨てる（読むだけのSQLなので DB は変えない）
- （実装検証のあとで足した）DB を何回も使う仕事（prepare・正解の結果づくり・判定・段階づくり）は `src/ui/state/db-jobs.js` の `runDbJob` で1つずつ流す。判定中に画面を離れて開き直したとき、残った判定の reset が次の問題の正解づくりに入り込まないように

## テスト戦略

- 単体（`tests/unit/ui/`）：`editor-keys`・`write-session-machine`
- 統合（`tests/integration/`）：`loadTableList`（Node 版の PGlite で初級の初期データ）
- E2E（`tests/e2e/play-modes/mode3-4-write.spec.js`）：モード3でヒントを開いて正解・記録、モード4にヒントがない、不正解の理由、エラーの和訳と原文、`DROP TABLE` のあとの正解、Tab と Ctrl+Enter、ステップ再生、判定中の二重の実行

## 実装の順序

1. editor-keys・write-session-machine のテスト → 実装
2. table-list のテスト → 実装
3. SqlEditor・HintPanel・JudgePanel・WriteResult
4. use-write-session・PlayMode34・PlayScreen・App
5. E2E、開発サーバーで目で確かめる
