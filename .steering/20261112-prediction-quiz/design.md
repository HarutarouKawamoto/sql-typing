# 設計書

## `src/core/prediction.js`

```js
/**
 * @param {Step[]} steps - buildSteps の段階（1つ以上）
 * @returns {{ answer: number, choices: number[], flow: { label: string, rows: number }[] }}
 */
export function buildRowCountQuiz(steps) {}
```

- `answer`：最後の段階の行の数
- 選択肢の候補の順：①途中の段階の行の数（前から） ②正解の半分 ③正解 + 半分 ④正解 −1, +1, −2, +2 …。正解と重ならないものを3つ取り、正解を入れて小さい順。足りるうちは、段階の中で一番多い行の数を超える数は使わない（実装検証のあと。最初は「正解 + 1」「正解 × 2」で埋めていて、正解の隣が並んで透けた）
- `flow`：段階ごとの `{ label, rows }`

## 画面

- `src/ui/components/PredictionQuiz.jsx`：`{ quiz, onAnswer(choice | null) }`。選択肢のボタンと「予想しないで再生する」。出たら最初の選択肢にフォーカス
- `PredictionResult`：当たり・おしい、正解と予想、流れ。`PredictionQuiz.jsx` の中に置く（実装で、1つのファイルにまとめた）。文は `src/ui/state/prediction-text.js`（読み上げと同じ文。単体テスト）
- `StepPlayer`：`predict` を受け取る。段階ができたら、`predict` なら答えるまで `PredictionQuiz`、答えたら `PredictionResult` と `StepPlayerView`（そのまま自動再生）
- 設定：`SettingsSchema.predictionQuiz`（既定 true）、`SettingsScreen` のチェック、`App` → `PlayScreen` → `PlayMode12`・`PlayMode34` → `StepPlayer`
- 見本：`readDemoParams` で `predict`、`ReplayDemoScreen` → `StepPlayer`

## テスト

- 単体：`tests/unit/core/prediction.test.js`
- 単体：設定の既定（`schemas.test.js`・`progress-store.test.js` の期待を直す）
- E2E：`tests/e2e/visualization/prediction-quiz.spec.js`（見本 `?demo&predict`：当たり・はずれ・飛ばす。書く画面：設定 off で出ない）
- 今のステップ再生の E2E（モード1〜4で再生を開くもの）は、クイズを飛ばしてから進める
