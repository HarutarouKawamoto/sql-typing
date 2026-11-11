---
tags: [review, sql-typing, mode2, choice, typing]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-mode2-choice：モード2（打って選ぶ）

> - **対象**：ブランチ `feature/mode2-choice`（作業前のコミット `0871d53`）。まだコミットなし
> - **steering**：`.steering/20261112-mode2-choice/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/blank-typing.js:141` 空欄の外（TypingEngine）と中（ChoiceEngine）のつなぎ。数の合計、正解を選んだあとの位置と句の終わり
>   2. `src/core/choice-engine.js:53` 候補の絞り込みと、打ち切りでの確定（間違いは候補から外して最初から）
>   3. `src/core/blank-typing.js:70` 空欄の範囲の探し方。画面・問題データの検証（`checkBlanksPlayable`・`checkWrongChoices`）がこれ1つを使う
> - **判断してほしいこと**：1件
> - **検証していないこと**：3件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 変更 | `docs/development-guidelines.md` | 問題データの書き方：空欄は語の切れ目で始めて終える（`checkBlanksPlayable` で止まる） |
| 変更 | `docs/functional-design.md` | 選び間違いは正確さ・ランクに入れない（本人の決定）。ChoiceEngine の節に、選んだ間違いを外すことと状態の形。`blank-typing.js` の節（インターフェース、空欄の出入り、数え方、苦手に入れない miss と分母、句の終わり）。コンポーネントの表に `PlayMode12`、`TypingArea` の空欄の箱、`ChoiceList` の中身。単体テストの方針、問題データの検証に `checkBlanksPlayable` と `checkWrongChoices` の探し方 |
| 変更 | `docs/glossary.md` | 「選び間違い（`wrongChoices`）」を足した |
| 変更 | `docs/repository-structure.md` | `src/core/blank-typing.js`、`PlayMode12.jsx`（旧 `PlayMode1.jsx`）・`TypingArea.jsx`・`ChoiceList.jsx` の説明、`tests/unit/core/blank-typing.test.js`、`checkBlanksPlayable`、「モードごとの部品は `PlayMode12.jsx` と `PlayMode34.jsx`」 |
| 追加 | `src/core/blank-typing.js` | `locateBlanks`（空欄の正解のスロットの列を、表示用SQLの中で探す。区切りは改行・字下げの違い、文字列の外は大文字・小文字の違いを気にしない。見つからない・重なるなら投げる）、`createBlankTypingState`、`pressBlankKey`（空欄の外は TypingEngine、中は ChoiceEngine。空欄の中の ok・miss も打った数・ミスの数に足す。正解で位置を空欄の終わりへ、空欄の中で終わった最後の句を知らせる、次の空欄をすぐ始める、選び間違えた回数） |
| 追加 | `src/core/choice-engine.js` | `startBlank`（正解と間違いを乱数で混ぜる。Fisher–Yates）、`pressKey`（候補の絞り込み、候補が0なら miss、打ち切りで decidedCorrect／decidedWrong（why と選んだ文字）。選んだ間違いは候補から外し、最初から） |
| 変更 | `src/core/scoring.js` | `countTypedKeys` に、数えないスロット（`skipSlots`）を渡せるようにした（モード2の空欄） |
| 変更 | `src/core/typing-engine.js` | スロットとキーの比べ方を `slotMatches` として export（ChoiceEngine と共有）。コメントに空欄の扱いの場所 |
| 変更 | `src/ui/App.jsx` | 仮の入口に「1問目を打って選ぶ」、モード2の最高記録。`playing.mode` の型に '2' |
| 追加 | `src/ui/components/ChoiceList.jsx` | 今の空欄の選択肢。候補は打った分を光らせ、合わなくなったものは薄く、選んだ間違いは打ち消し線。間違いを選んだら「なぜ違うか」。空欄の中の miss で揺れる |
| 追加 | `src/ui/components/ChoiceList.module.css` | 選択肢・候補・打ち消し線・理由・揺れの見た目（動きを減らす設定では揺らさない） |
| 名前変更 | `src/ui/components/PlayMode1.jsx` → `src/ui/components/PlayMode12.jsx` | モード1・2を扱う（`mode` を受け取る）。モード名と案内、モード2は空欄を TypingArea に渡し ChoiceList を出す、記録のモード、結果に選び間違えた回数 |
| 名前変更 | `src/ui/components/PlayMode1.module.css` → `src/ui/components/PlayMode12.module.css` | 中身は変えていない |
| 変更 | `src/ui/components/TypingArea.jsx` | `blanks` を受け取り、まだ埋まっていない空欄を「？」の箱1つで描く（答えの文字数がわからないように）。今の空欄は光らせ、読み上げの名前を付ける |
| 変更 | `src/ui/components/TypingArea.module.css` | 空欄の箱と、今の空欄の見た目 |
| 変更 | `src/ui/components/TypingResult.jsx` | モード2のとき「選び間違い」の回数を出す |
| 変更 | `src/ui/screens/PlayScreen.jsx` | モード1・2を `PlayMode12` で出す（key にモードを入れる）。「このモードはまだありません」を消した |
| 変更 | `src/ui/state/use-typing-session.js` | 判定を `blank-typing.js` に（`blanks` を渡すとモード2、省くとモード1）。空欄の中の miss は苦手に入れず、選択肢だけを揺らす（`choiceMissPulse`。正解を選んだら0に戻す）。間違いを選んだときの知らせ `lastWrong`。苦手の打った回数から空欄のスロットを外す。`onDone` に `wrongChoices` |
| 追加 | `tests/e2e/play-modes/mode2-choice.spec.js` | 4件：空欄が隠れ、空欄で選択肢が出て、正解でクリア・記録。候補だけが光り、合わないキーは進まない。間違いで理由と打ち消し線、やり直して正解。ステップ再生と Enter でもう一度 |
| 変更 | `tests/helpers/answer-checks.js` | `checkBlanksPlayable`（空欄が見つかる・重ならない・語の途中で切れない・選択肢に打てない文字がない）。`checkWrongChoices` を `locateBlanks` の範囲の置き換えに（大文字・小文字・改行が違っても確かめる） |
| 変更 | `tests/integration/data-validation/answer-checks.test.js` | `checkBlanksPlayable` が、ない空欄・重なる空欄・語の途中の空欄・打てない選択肢を見つけること。`checkWrongChoices` が大文字・小文字の違いでも確かめ、ない空欄を見つけること（前の「そのままの文字でないと見つける」を置き換えた） |
| 変更 | `tests/integration/data-validation/problems.test.js` | 本物の問題データに `checkBlanksPlayable` をかける |
| 追加 | `tests/unit/core/blank-typing.test.js` | 空欄の範囲（改行・大文字小文字・文字列の中・順番・見つからない・重なる）、空欄がないときに TypingEngine と同じ、空欄の出入り、数、間違い・正解、先頭の空欄、2つの空欄と句の終わり、隣り合う空欄 |
| 追加 | `tests/unit/core/choice-engine.test.js` | 並べ方と乱数、絞り込み、miss、ignored と Enter、正解・間違いの確定、選んだ間違いを外す、文字列の中の大文字・小文字 |
| 変更 | `tests/unit/core/scoring.test.js` | `countTypedKeys` で空欄のスロットを数えない |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| 仮の入口 | モード1・3・4 | 「1問目を打って選ぶ」も。モード2の最高記録が出る |
| モード2 | 「このモードはまだありません」 | 空欄は「？」の箱。空欄の外を打つと選択肢が出て、打って選ぶ。間違いは理由と打ち消し線、正解で続きを打つ。最後まで打つとクリア（速さ・正確さ・ランク・選び間違い） |
| モード1 | TypingEngine で判定 | `blank-typing.js`（空欄なし）で判定。動きは同じ（単体テストと E2E で確かめた） |
| 問題データの検証 | 空欄は「表示用SQLに1回だけ出る」まで | ＋画面と同じ探し方で見つかる、語の途中で切れない、選択肢が打てる。`checkWrongChoices` も同じ範囲を置き換える |

## なぜ

- **`blank-typing.js` を足し、モード1もこれで動かす**：空欄の出入り・数の合計・句の終わりを純粋な関数にまとめると、画面の部品を描かずに単体テストできる。空欄がなければ TypingEngine と同じなので、打つ決まりが1か所になり、モード1と2でずれない
- **`PlayMode12.jsx` にまとめた**：モード2の画面はモード1とほぼ同じ（打つSQL・結果の表・ステップ再生・結果）。写しを作ると直すときに片方を忘れる。モード3・4の `PlayMode34` と同じ形にした
- **空欄の中の miss を苦手に入れない**：空欄では、選び方の迷い（どれにしよう）と記号の打ち間違いを分けられない。苦手の割合が崩れないように、打った回数（分母）からも空欄を外した（実装検証の提案）
- **間違いの選択肢を打ち切ったキーも ok に数え、選び間違いはランクに入れない**：1文字ずつは正しく打てているため。選び間違いは別に数えて結果に出す。ランクに入れるかは本人に聞き、別に数えるままと決まった（2026-11-12）
- **空欄を「？」の箱1つにする**：下線を文字数分出すと、選択肢の長さで答えがわかる
- **探し方を `locateBlanks` 1つにそろえた**：実装検証で、画面（改行の違いを許す）・`checkBlanks`（大文字・小文字を無視）・`checkWrongChoices`（完全一致）がそれぞれ違う比べ方をしていて、どれか1つだけが落ちる組み合わせが見つかった
- **語の途中の空欄を止める**：`x = 10` に空欄 `= 1` を置いても、どの検証も通っていた。空欄を選んだあと残りの `0` だけを打つことになる

## 検証

| やったこと | 結果 |
|---|---|
| ChoiceEngine・blank-typing はテストを先に書いた | モジュールがなくて失敗することを確かめてから実装した。テストの思い込みが1件（区切りの直前で句が終わるので、最後のキーでは知らせない） |
| `npm run check` | 通った（408件。`src/core/` の行カバレッジ 98.2%） |
| `npm run test:e2e` | 通った（33件。モード2が4件。モード1の E2E もそのまま通った） |
| 開発サーバーで目で確かめた（1280px、ダーク、1問目のモード2） | 空欄の箱、空欄で選択肢が出る、候補の光り、`INTO products` を選ぶと打ち消し線と理由、`FROM products` でクリア（ランク S・選び間違い1回・30行の表）、記録が残る。実装検証の直しの前に見た |
| 実装検証（implementation-validator） | [必須] 1件・[推奨] 4件・[提案] 4件。判定は node のスクリプトで実際に試された（先頭部分の制約とスロットの比べ方のずれを30万組で探して0件、空欄がないときに TypingEngine と同じかを3つのSQLで3000回ずつ）。対応と見送りの理由は `.steering/20261112-mode2-choice/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-mode2-choice.md 0871d53` | OK |

**検証していないこと**：
- **空欄が2つ以上の問題を画面で遊ぶこと**：初級1問目の空欄は1つ。2つの空欄・隣り合う空欄は単体テストだけ。次の空欄の選択肢が揺れない直しも、画面では見ていない（初級2〜9問目の作業で E2E を足す）
- **ライトモードの見た目と、実装検証の直しのあとの目での確認**：E2E は通ったが、目ではダークで、直す前に見た
- **日本語入力がオンのときのモード2**：モード1と同じ処理（`classifyKeyEvent`）だが、画面では試していない

## 判断してほしいこと

- **コミット**：まだしていない。このブランチでコミットし、`main` にマージしてよいか

<details>
<summary>捨てた案・補足</summary>

- **`PlayMode2.jsx` を別に作る**：上の「なぜ」のとおり、写しになる
- **空欄を文字数分の下線で隠す**：答えの長さがわかる
- **選択肢の並びを固定する**：機能設計書の「毎回シャッフル」どおり、空欄を始めるたびに乱数で混ぜる。間違いを選んだあとは同じ並びのまま（並びが変わると、次にどれを打つか探し直すことになる）
- **空欄の中の miss も苦手に入れる**：どの選択肢のどの文字を打とうとしたかが決まらない（候補が複数あるうちは、期待する文字が1つに決まらない）

</details>
