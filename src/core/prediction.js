/**
 * 見える化D「実行前の予想クイズ」の材料。ステップ再生の段階から、「結果は何行になる？」の選択肢を作る。
 * 元：docs/functional-design.md の Prediction
 */

/**
 * @typedef {{ label: string, rows: unknown[] }} CountedStep
 * @typedef {{ answer: number, choices: number[], flow: { label: string, rows: number }[] }} RowCountQuiz
 */

const CHOICE_COUNT = 4;

/**
 * @param {CountedStep[]} steps - buildSteps の段階（1つ以上。最後の段階が結果）
 * @returns {RowCountQuiz}
 */
export function buildRowCountQuiz(steps) {
  const flow = steps.map((step) => ({ label: step.label, rows: step.rows.length }));
  const answer = flow[flow.length - 1].rows;
  const most = Math.max(...flow.map((stage) => stage.rows));
  // 紛らわしい選択肢は、途中の段階の行の数を先に使う（「WHERE で減る前の全部の行」などの、よくある考え違い）。
  // 足りなければ、正解の半分・正解より半分多い数・正解の近くの数（−1, +1, −2, +2 …）で埋める。
  // 「正解 + 1」だけで埋めると正解の隣が並んで透けるので、半分の数を混ぜる。
  // 乱数を使わないので、同じ SQL ならいつも同じ選択肢になる
  const half = Math.round(answer / 2);
  const candidates = [...flow.map((stage) => stage.rows), half, answer + half];
  for (let distance = 1; distance <= answer + CHOICE_COUNT; distance += 1) {
    candidates.push(answer - distance, answer + distance);
  }
  const choices = [answer];
  // 足りるうちは、段階の中で一番多い行の数を超える数は使わない（どの段階にもない大きな数は、すぐ外せる）
  for (const limit of [most, Infinity]) {
    for (const candidate of candidates) {
      if (choices.length === CHOICE_COUNT) break;
      if (candidate >= 0 && candidate <= limit && !choices.includes(candidate)) {
        choices.push(candidate);
      }
    }
  }
  return { answer, choices: choices.sort((a, b) => a - b), flow };
}
