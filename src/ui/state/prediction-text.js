/**
 * 見える化D「実行前の予想クイズ」の答え合わせの文。画面と読み上げで同じ文を使う。React に依存しない。
 * 元：docs/functional-design.md の PredictionQuiz・PredictionResult
 */

/** @typedef {import('../../core/prediction.js').RowCountQuiz} RowCountQuiz */

/** @param {number} n */
export const predictionRowsText = (n) => `${n.toLocaleString('ja-JP')} 行`;

/**
 * 段階ごとの行の数の流れ（「FROM 30行 → WHERE 21行 → …」）。
 * @param {RowCountQuiz} quiz
 */
export function predictionFlowText(quiz) {
  return quiz.flow
    .map((stage) => `${stage.label} ${stage.rows.toLocaleString('ja-JP')}行`)
    .join(' → ');
}

/**
 * 当たり・おしいの文。
 * @param {RowCountQuiz} quiz
 * @param {number} choice - 選んだ行の数
 */
export function predictionVerdict(quiz, choice) {
  const hit = choice === quiz.answer;
  const answer = predictionRowsText(quiz.answer);
  return {
    hit,
    title: hit ? '当たり！' : 'おしい！',
    detail: hit
      ? `結果は ${answer}。`
      : `結果は ${answer}（あなたの予想：${predictionRowsText(choice)}）。`,
  };
}
