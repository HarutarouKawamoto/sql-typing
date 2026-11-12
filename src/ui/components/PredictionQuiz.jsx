import { useEffect, useId, useRef } from 'react';
import {
  predictionFlowText,
  predictionRowsText,
  predictionVerdict,
} from '../state/prediction-text.js';
import styles from './PredictionQuiz.module.css';

/** @typedef {import('../../core/prediction.js').RowCountQuiz} RowCountQuiz */

/**
 * 見える化D：ステップ再生の前に、結果の行の数を4択で予想する。
 * @param {{ quiz: RowCountQuiz, onAnswer: (choice: number | null) => void }} props
 *   onAnswer：選んだ行の数。予想しないで再生するときは null
 */
export function PredictionQuiz({ quiz, onAnswer }) {
  const headingId = useId();
  const first = useRef(/** @type {HTMLButtonElement | null} */ (null));
  // 「ステップ再生を見る」のボタンは消えるので、フォーカスがページの先頭に落ちないよう最初の選択肢へ
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <section className={styles.quiz} aria-labelledby={headingId} data-testid="prediction-quiz">
      <h3 id={headingId} className={styles.question}>
        予想しよう：このSQLの結果は何行になる？
      </h3>
      <p className={styles.lead}>当ててから、ステップ再生で答え合わせをします。</p>
      <div className={styles.choices} role="group" aria-label="結果の行の数">
        {quiz.choices.map((choice, index) => (
          <button
            key={choice}
            ref={index === 0 ? first : undefined}
            type="button"
            className={styles.choice}
            onClick={() => onAnswer(choice)}
            data-testid={`prediction-choice-${choice}`}
          >
            {predictionRowsText(choice)}
          </button>
        ))}
      </div>
      <button type="button" className={styles.skip} onClick={() => onAnswer(null)}>
        予想しないで再生する
      </button>
    </section>
  );
}

/**
 * 予想の答え合わせ（当たり・おしいと、段階ごとの行の数の流れ）。
 * @param {{ quiz: RowCountQuiz, choice: number }} props
 */
export function PredictionResult({ quiz, choice }) {
  const verdict = predictionVerdict(quiz, choice);
  return (
    <div
      className={`${styles.result} ${verdict.hit ? styles.hit : styles.miss}`}
      data-testid="prediction-result"
      data-hit={verdict.hit}
    >
      <p className={styles.verdict}>
        <strong>{verdict.title}</strong> {verdict.detail}
      </p>
      <p className={styles.flow} data-testid="prediction-flow">
        {predictionFlowText(quiz)}
      </p>
    </div>
  );
}
