import { describe, it, expect } from 'vitest';
import { predictionFlowText, predictionVerdict } from '../../../src/ui/state/prediction-text.js';

const quiz = {
  answer: 1234,
  choices: [617, 1233, 1234, 5000],
  flow: [
    { label: 'FROM', rows: 5000 },
    { label: 'WHERE', rows: 1234 },
  ],
};

describe('予想クイズの文', () => {
  it('流れは段階ごとの行の数を「→」でつなぎ、3桁ごとに区切る', () => {
    expect(predictionFlowText(quiz)).toBe('FROM 5,000行 → WHERE 1,234行');
  });

  it('当たり・おしいの文（画面と読み上げで同じ文を使う）', () => {
    expect(predictionVerdict(quiz, 1234)).toEqual({
      hit: true,
      title: '当たり！',
      detail: '結果は 1,234 行。',
    });
    expect(predictionVerdict(quiz, 617)).toEqual({
      hit: false,
      title: 'おしい！',
      detail: '結果は 1,234 行（あなたの予想：617 行）。',
    });
  });
});
