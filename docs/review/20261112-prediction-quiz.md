---
tags: [review, sql-typing, visualization, prediction]
created: 2026-11-12
updated: 2026-11-12
---
# 📝 20261112-prediction-quiz：見える化D「実行前の予想クイズ」

> - **対象**：ブランチ `claude/changes`（作業前のコミット `72070d0`）。ブランチ名は、ブランチを決めるダイアログで本人が選んだもの。前の同じ名前のブランチはマージ済みだったので、`main` の位置から作り直した（ダイアログを出す前に作り直してしまい、あとからダイアログを出して同じ名前を確かめた）
> - **steering**：`.steering/20261112-prediction-quiz/`
> - **見るべき箇所**（最大3つ）：
>   1. `src/core/prediction.js` 選択肢の作り方（途中の段階の行の数を先に、足りなければ半分・近く、一番多い段階を超えない）
>   2. `src/ui/components/StepPlayer.jsx` 答えるまで再生しない、答えたらフォーカスを再生・一時停止のボタンへ
>   3. `src/schema/progress-schema.js` 設定 `predictionQuiz`（古い記録は既定で on）
> - **判断してほしいこと**：なし（本人の「上級まで作って」で、完了条件を満たしたらコミットしてマージする）
> - **検証していないこと**：2件

## 変更したファイル一覧

| 区分 | ファイル | 何をしたか |
|---|---|---|
| 追加 | `.steering/20261112-prediction-quiz/requirements.md` | 要求（選択肢・画面・設定・受け入れ条件・スコープ外） |
| 追加 | `.steering/20261112-prediction-quiz/design.md` | 設計（prediction.js・画面・設定・テスト） |
| 追加 | `.steering/20261112-prediction-quiz/tasklist.md` | タスク、実装検証の指摘への対応・見送り、振り返り |
| 追加 | `src/core/prediction.js` | `buildRowCountQuiz`（正解・小さい順の4択・段階ごとの行の数の流れ。乱数なし） |
| 追加 | `src/ui/state/prediction-text.js` | 答え合わせの文（`predictionVerdict`・`predictionFlowText`・`predictionRowsText`）。画面と読み上げで同じ文 |
| 追加 | `src/ui/components/PredictionQuiz.jsx` | `PredictionQuiz`（4択と「予想しないで再生する」、出たら最初の選択肢にフォーカス）、`PredictionResult`（当たり・おしい、流れ） |
| 追加 | `src/ui/components/PredictionQuiz.module.css` | クイズの枠・選択肢・答え合わせ（当たりは緑、外れは黄色の枠） |
| 変更 | `src/ui/components/StepPlayer.jsx` | `predict` を受け取り、答えるまで再生しない。答えたら答え合わせと再生、再生・一時停止のボタンへフォーカス。読み上げの枠。key を変える前提を JSDoc に |
| 変更 | `src/ui/components/StepPlayer.module.css` | クイズと再生を縦に並べる枠、読み上げ用の隠し方 |
| 変更 | `src/schema/progress-schema.js` | 設定 `predictionQuiz`（既定 true） |
| 変更 | `src/ui/screens/SettingsScreen.jsx` | 「ステップ再生の前に、結果の行の数を予想するクイズを出す（見える化D）」のチェック |
| 変更 | `src/ui/App.jsx` | 設定を `PlayScreen` へ。見本のページの `predict` を読む |
| 変更 | `src/ui/screens/PlayScreen.jsx` | `predictionQuiz` を `PlayMode12`・`PlayMode34` へ |
| 変更 | `src/ui/components/PlayMode12.jsx` | `predictionQuiz` を `StepPlayer` の `predict` へ |
| 変更 | `src/ui/components/PlayMode34.jsx` | `predictionQuiz` を `StepPlayer` の `predict` へ |
| 変更 | `src/ui/screens/ReplayDemoScreen.jsx` | `predict` を `StepPlayer` へ（`?demo&predict` のときだけ） |
| 追加 | `tests/unit/core/prediction.test.js` | 途中の段階の行の数、埋め方（半分・近く）、一番多い段階を超えない、0行、段階が1つ |
| 追加 | `tests/unit/ui/prediction-text.test.js` | 流れの区切り、当たり・おしいの文 |
| 変更 | `tests/unit/schema/schemas.test.js` | 設定の既定に `predictionQuiz`、設定の一部だけの古い記録 |
| 変更 | `tests/unit/data/progress-store.test.js` | 設定の期待に `predictionQuiz` |
| 変更 | `tests/integration/data-validation/problems.test.js` | PGlite で確かめるテストの時間の上限を、選択肢の確かめだけでなく `describe` ごと5分に（全体を流したとき「正解SQLが実行できる」が32秒で落ちた。上級は問題ごとに5万行を入れ直すため。この作業の変更とは関係ない） |
| 追加 | `tests/e2e/visualization/prediction-quiz.spec.js` | 見本のページで当たり・おしい・飛ばす、フォーカス、モード1でキーボードだけで答える、設定で止める、設定の画面 |
| 変更 | `tests/e2e/helpers/open-play.js` | `skipPrediction`（「予想しないで再生する」を押す） |
| 変更 | `tests/e2e/helpers/seed-progress.js` | 設定の既定に `predictionQuiz` |
| 変更 | `tests/e2e/visualization/step-replay.spec.js` | ステップ再生を開いたらクイズを飛ばす（キーボードの流れでは Enter で飛ばす） |
| 変更 | `tests/e2e/play-modes/mode2-choice.spec.js` | 同上 |
| 変更 | `tests/e2e/play-modes/mode3-4-write.spec.js` | 同上 |
| 変更 | `tests/e2e/dictionary/keyword-tip.spec.js` | 同上 |
| 変更 | `tests/e2e/settings/settings.spec.js` | 設定の期待に `predictionQuiz`、チェックが既定で付いている |
| 変更 | `docs/functional-design.md` | Settings の `predictionQuiz`、Prediction の節、PredictionQuiz・PredictionResult・SettingsScreen の行、テスト戦略 |
| 変更 | `docs/repository-structure.md` | `prediction.js`・`prediction-text.js`・`PredictionQuiz.jsx`・テストのファイル |
| 変更 | `docs/glossary.md` | 予想クイズ（`PredictionQuiz`・`buildRowCountQuiz`・設定） |
| 変更 | `docs/product-requirements.md` | 見える化D の「結果は何行？」を作ったこと |
| 追加 | `docs/review/20261112-prediction-quiz.md` | このファイル |

## 挙動の変化

| どこで | 前 | 後 |
|---|---|---|
| モード1〜4のステップ再生 | 開くとすぐ再生 | 先に「結果は何行？」の4択（予想しないで再生もできる）。答えると答え合わせと流れ、そのまま再生 |
| 設定の画面 | 見える化B・速さ・記録を消す | 見える化D の on/off も（既定 on） |
| 見本のページ | 再生だけ | `?demo&predict` のときクイズ |

## なぜ

- **途中の段階の行の数を選択肢に**：「WHERE で減る前の全部の行」「JOIN で増えた行」は、学習者がよく間違える数。答え合わせの流れ（FROM 30行 → WHERE 21行）で、どこで減ったかがすぐ見える
- **乱数を使わない**：`src/core` の決まり。同じ SQL ならいつも同じ問いになり、テストもしやすい
- **答えるまで再生しない**：再生すると最後の段階の行の数が見えてしまう
- **既定で on**：PRD の見える化D を、設定を変えなくても体験できるように。じゃまなら設定で止められる

## 検証

| やったこと | 結果 |
|---|---|
| テストを先に書いた | 選択肢・文の関数・設定の既定は、失敗を見てから実装した（実装検証のあとの埋め方の変更も） |
| `npm run check` | 1回目は「正解SQLが実行できる」が時間切れ（32秒）で落ちた。上限を延ばして、656件すべて通った |
| `npm run test:e2e` | 通った（98件。上限を延ばす前のコード。そのあとの変更は問題データの検証のテストだけ） |
| 目で確かめた（Playwright で撮った） | 見本のページのクイズ（ライト）、外れ（ダーク）、当たり（幅375px） |
| 実装検証（implementation-validator） | [高] 1件・[中] 5件・[低] 6件。対応と見送りは `.steering/20261112-prediction-quiz/tasklist.md` |
| `node scripts/check-review-files.js docs/review/20261112-prediction-quiz.md 72070d0` | OK |

**検証していないこと**：
- **読み上げソフトでの聞こえ方**（`role="status"` の文は E2E で中身だけ確かめた）
- **すべての問題で選択肢が学びになるか**：選択肢の作り方は単体テストと見本で確かめたが、全問の選択肢を人が見てはいない

## 判断してほしいこと

- なし

<details>
<summary>捨てた案・補足</summary>

- **「どの行が残る？」**：行を選ぶ画面が要る。今回は「結果は何行？」だけ
- **予想の当たり・はずれを記録に残す**：今回はしない（記録の形が変わる）
- **答えたら1段階目で止める**：「そのまま再生」の仕様のまま。流れの文は再生の上に出したまま

</details>
