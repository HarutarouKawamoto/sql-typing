# 設計書

## アーキテクチャ概要

```
use-typing-session（モード1・2で共有）
└── src/core/blank-typing.js（空欄つきのなぞり書き。空欄がなければ TypingEngine と同じ）
    ├── src/core/typing-engine.js（空欄の外）
    └── src/core/choice-engine.js（空欄の中）
PlayMode12.jsx（モード1・2）= TypingArea（空欄を隠す）＋ ChoiceList ＋ 結果の表 ⇄ ステップ再生 ＋ TypingResult
```

- 判定（Judge）は使わない。正解の選択肢を打ち切った時点で、打ったSQLは正解SQLと同じ
- 乱数は画面から `Math.random` を渡す（コアは乱数を引数で受け取る決まり）

## 機能設計書から変えた点

- ChoiceEngine だけでなく、TypingEngine と組み合わせる `blank-typing.js` を足す（空欄の出入り・数の合計・句の終わりを純粋な関数にまとめ、単体テストする）
- モード1も `blank-typing.js` で動かす（空欄なし）。打つ処理を1つにして、モード1と2で決まりがずれないように

## コンポーネント設計

### 1. `src/core/choice-engine.js`
- 状態：`choices`（`{ text, correct, why, target }` を並べた順）、`typed`（候補に共通の、打ったスロットの数）、`candidates`（まだ合う選択肢の番号）、`rejected`（選んだ間違い）
- `startBlank(blank, randomFn)`：正解と間違いを混ぜる（Fisher–Yates、`randomFn` は 0 以上 1 未満）
- `pressKey(state, key)`：長さ2以上のキー（Enter 以外）は `ignored`。各候補の `typed` 番目のスロットと比べる（TypingEngine の `matches` と同じ）。合う候補が0なら `miss`。1つを打ち切ったら確定：正解は `decidedCorrect`、間違いは `decidedWrong`（`why`。`rejected` に足し、`typed` を0に）

### 2. `src/core/blank-typing.js`
- `locateBlanks(target, blanks)`：各空欄の正解のスロットの列を、表示用SQLのスロットの中で探す → `[{ start, end }]`（スロット番号、end は含まない）。見つからなければ投げる
- `createBlankTypingState(target, blanks, randomFn)`：位置0が空欄の始まりなら、そこで空欄を始める
- `pressBlankKey(state, target, key, randomFn)` → `{ state, result: 'ok'|'miss'|'ignored'|'decidedCorrect'|'decidedWrong', inBlank, clauseEnded?, done?, why? }`
  - 空欄の外：TypingEngine の `pressKey`。次の位置が空欄の始まりなら、その空欄を始める
  - 空欄の中：ChoiceEngine の `pressKey`。ok・miss は TypingState の `okCount`・`missCount` にも足す。`decidedCorrect` で位置を空欄の終わりへ進め、空欄の中で終わった句のうち最後のものを `clauseEnded` に。次がまた空欄なら始める
  - `wrongChoices`（選び間違えた回数）を数える

### 3. `src/ui/state/use-typing-session.js`
- `blanks`（省くと空欄なし）と `randomFn` を受け取り、`blank-typing.js` で動かす
- 苦手の記録は空欄の外の miss だけ（空欄の中の miss は選び方の迷いで、記号の打ち間違いと分けられない）
- 返り値に `blankState`（空欄の範囲・今の空欄・選択肢の状態）と `lastWhy` を足す

### 4. 画面
- `TypingArea.jsx`：`blanks`（範囲）と `activeBlank` を受け取り、まだ埋まっていない空欄は「？」の箱1つで描く（長さで答えがわからないように）。今の空欄は光らせる
- `ChoiceList.jsx`：選択肢を並べる。候補は打った分を色付き、候補でないものは薄く、選んだ間違いは打ち消し線。直前の miss で揺らす
- `PlayMode12.jsx`（`PlayMode1.jsx` の名前を変えて、モード1・2を扱う）：案内、TypingArea、ChoiceList、why の知らせ、結果、結果の表 ⇄ ステップ再生
- `TypingResult.jsx`：選び間違えた回数（モード2のときだけ）
- `PlayScreen.jsx`・`App.jsx`：モード '2' と入口

### 5. 問題データの検証
- `tests/helpers/answer-checks.js` に `checkBlanksPlayable`（`locateBlanks` で範囲が見つかる・選択肢に打てない文字がない）を足し、`problems.test.js` で全問にかける

## テスト戦略

- 単体（`tests/unit/core/`）：`choice-engine.test.js`・`blank-typing.test.js`（テストを先に）
- 統合：問題データの検証に `checkBlanksPlayable`
- E2E（`tests/e2e/play-modes/mode2-choice.spec.js`）：空欄の前を打つ → 選択肢が出る、間違いを打ち切ると why と打ち消し線、合わないキーは miss、正解でクリア・ランク・記録、選び間違えた回数、結果の表、ステップ再生
- モード1の E2E はそのまま通ること

## 実装の順序

1. choice-engine のテスト → 実装
2. blank-typing のテスト → 実装
3. use-typing-session を blank-typing に
4. TypingArea・ChoiceList・PlayMode12・TypingResult・PlayScreen・App
5. 問題データの検証、E2E、目で確かめる
