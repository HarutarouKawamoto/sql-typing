import { describe, it, expect } from 'vitest';
import { buildRowCountQuiz } from '../../../src/core/prediction.js';

/** 行の数だけを持つ段階（buildRowCountQuiz は label と rows の数しか見ない） */
const step = (label, rows) => ({ label, rows: Array.from({ length: rows }, () => ({})) });

describe('buildRowCountQuiz', () => {
  it('正解は最後の段階の行の数。途中の段階の行の数を紛らわしい選択肢に使い、小さい順に4つ', () => {
    const quiz = buildRowCountQuiz([
      step('FROM', 30),
      step('WHERE', 21),
      step('SELECT', 21),
      step('ORDER BY', 21),
      step('LIMIT', 5),
    ]);
    expect(quiz.answer).toBe(5);
    expect(quiz.choices).toHaveLength(4);
    expect(quiz.choices).toContain(5);
    expect(quiz.choices).toContain(30);
    expect(quiz.choices).toContain(21);
    expect(quiz.choices).toEqual([...quiz.choices].sort((a, b) => a - b));
    expect(new Set(quiz.choices).size).toBe(4);
    expect(quiz.flow).toEqual([
      { label: 'FROM', rows: 30 },
      { label: 'WHERE', rows: 21 },
      { label: 'SELECT', rows: 21 },
      { label: 'ORDER BY', rows: 21 },
      { label: 'LIMIT', rows: 5 },
    ]);
  });

  it('途中の段階で足りなければ、正解の半分・正解の近くの数で埋める（同じ SQL なら、いつも同じ選択肢）', () => {
    const steps = [step('FROM', 30), step('SELECT', 30)];
    const quiz = buildRowCountQuiz(steps);
    expect(quiz.answer).toBe(30);
    expect(quiz.choices).toEqual([15, 28, 29, 30]);
    expect(buildRowCountQuiz(steps)).toEqual(quiz);
  });

  it('足りるうちは、段階の中で一番多い行の数を超える数は使わない（「正解 + 1」「正解の倍」に頼って正解が透けないように）', () => {
    const quiz = buildRowCountQuiz([step('FROM', 20), step('JOIN', 33), step('SELECT', 33)]);
    expect(quiz.answer).toBe(33);
    expect(quiz.choices).toEqual([17, 20, 32, 33]);
    expect(Math.max(...quiz.choices)).toBeLessThanOrEqual(33);
    // WHERE で減る形では、正解の両隣が並ばない
    expect(
      buildRowCountQuiz([step('FROM', 30), step('WHERE', 21), step('SELECT', 21)]).choices,
    ).toEqual([11, 20, 21, 30]);
  });

  it('結果が0行でも、マイナスのない4つの選択肢を作る', () => {
    const quiz = buildRowCountQuiz([step('FROM', 30), step('WHERE', 0), step('SELECT', 0)]);
    expect(quiz.answer).toBe(0);
    expect(quiz.choices).toEqual([0, 1, 2, 30]);
  });

  it('段階が1つ（FROM だけ）でも作れる', () => {
    const quiz = buildRowCountQuiz([step('FROM', 1)]);
    expect(quiz.choices).toEqual([0, 1, 2, 3]);
  });
});
