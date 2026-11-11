# 設計書

## アーキテクチャ概要

```
App（画面の切り替え。navigation.js の reducer）
├── HomeScreen（章と問題の一覧）
├── ModeSelect（モードを選ぶ・会話を読み返す）
├── StoryScreen（StoryPanel で依頼の会話）
└── PlayScreen（PlayMode12 / PlayMode34）
    └── クリアの結果の下に AfterStory（反応の会話・次の問題へ・一覧へ）
```

## 機能設計書から変えた点

- 「次へ＝Enter」：結果画面の Enter は今までどおり「もう一度」のまま（モード1〜4で本人がそう使っている）。次の問題は N、一覧は Esc にする。判断してほしいことに書く
- 遊ぶ画面の Esc は一覧へ（画面遷移図どおり）。最高記録は一覧の星と、モード選択で見る
- モード3・4の画面の上に並べている依頼の会話は残す（書いている間に読み返すため）

## コンポーネント設計

### 1. `src/data/progress-store.js`
- `isUnlocked(progress, chapters, problemId, turningPointIds)`、`nextProblemId(chapters, problemId)`（最初は `isTurningPoint`（章の最後の問題）も作る予定だったが、ターニングポイントは問題の kind で決まるので、App が `use-problems.js` で問題を読んで ID の集合を渡す形に変えた）

### 2. `src/ui/state/navigation.js`（React に依存しない reducer）
- 画面：`home` / `mode`（problemId）/ `story`（problemId・mode・`readOnly`）/ `play`（problemId・mode）
- 動き：`openProblem`・`chooseMode`・`readStory`・`storyDone`（読み返しなら mode へ、そうでなければ play へ）・`home`・`back`（story・play → 一覧、mode → 一覧）・`next`（次の問題の mode へ）

### 3. `src/ui/state/use-narrow-screen.js`
- `matchMedia('(max-width: 767px)')` を見て、幅が狭いかを返す（変わったら描き直す）

### 4. 画面の部品
- `HomeScreen.jsx`：章ごとに `loadProblems` で読み、問題のボタン（開いていなければ disabled）。星は `progress.problems[id].modes[n].cleared`
- `ModeSelect.jsx`：4つのモードのボタン（星・最高記録）、1〜4のキー、Esc で一覧。狭い画面・準備中は選べない。「依頼の会話を読む」
- `StoryPanel.jsx`：行を1つずつ足していく。Enter（ボタン・入力欄にフォーカスがないとき）・クリックで次、スキップのボタン。最後の行の次で onDone
- `StoryScreen.jsx`：問題を読み、StoryPanel を出す。Esc で一覧
- `AfterStory.jsx`：反応の会話（全部の行）、「次の問題へ（N）」「一覧へ（Esc）」。N のキー（のちに本人の決定で、Enter・J で次の問題へ、R でもう一度に変えた。フェーズ5）。ターニングポイントをモード1・2でクリアしたときの添え書き
- `PlayMode12.jsx`・`PlayMode34.jsx`：クリアの結果の下に `afterClear`（PlayScreen から渡す要素）を出す
- `App.jsx`：仮の入口を消し、navigation の画面ごとに出し分ける

### 5. E2E
- 一覧から問題・モードを選び、会話を飛ばして遊ぶところまでを `tests/e2e/helpers/open-play.js` にまとめ、今の E2E の入口を置き換える
- 新しく `tests/e2e/progression/home-story.spec.js`（一覧・星・会話・クリア後の会話・最高記録）と `tests/e2e/device/narrow-screen.spec.js`

## テスト戦略

- 単体：`isUnlocked`・`nextProblemId`（`tests/unit/data/progress-store.test.js`、2章の作り物の章で）、`navigation`（`tests/unit/ui/`）
- E2E：上のとおり

## 実装の順序

1. 進む条件のテスト → 実装
2. navigation のテスト → 実装
3. StoryPanel・AfterStory・ModeSelect・HomeScreen・StoryScreen・use-narrow-screen
4. App・PlayScreen・PlayMode12・PlayMode34
5. E2E の入口の置き換えと新しい E2E、目で確かめる
