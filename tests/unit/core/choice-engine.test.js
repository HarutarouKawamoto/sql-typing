import { describe, it, expect } from 'vitest';
import { pressKey, startBlank } from '../../../src/core/choice-engine.js';

const BLANK = {
  answer: 'FROM products',
  wrong: [
    { text: 'INTO products', why: 'INTO は INSERT で使う' },
    { text: 'FIELD products', why: 'FIELD という句はない' },
  ],
};

/** 乱数を順に返す（並び順を決めるため） */
const sequence =
  (...values) =>
  () =>
    values.shift() ?? 0;
/** 混ぜない（Fisher–Yates で毎回いちばん後ろを選ぶ） */
const keepOrder = () => 0.999999;

const texts = (state) => state.choices.map((c) => c.text);
const type = (state, keys) => {
  let current = state;
  const results = [];
  for (const key of keys) {
    const outcome = pressKey(current, key);
    current = outcome.state;
    results.push(outcome);
  }
  return { state: current, results, last: results.at(-1) };
};

describe('startBlank', () => {
  it('正解と間違いを並べ、全部が候補。まだ何も打っていない', () => {
    const state = startBlank(BLANK, keepOrder);
    expect(texts(state)).toEqual(['FROM products', 'INTO products', 'FIELD products']);
    expect(state.choices.map((c) => c.correct)).toEqual([true, false, false]);
    expect(state).toMatchObject({ typed: 0, candidates: [0, 1, 2], rejected: [] });
  });

  it('並び順は乱数で混ぜる（コアは乱数を引数で受け取る）', () => {
    // 3個の Fisher–Yates：i=2 で 0、i=1 で 0 を選ぶ
    const state = startBlank(BLANK, sequence(0, 0));
    expect(texts(state)).toEqual(['INTO products', 'FIELD products', 'FROM products']);
  });
});

describe('pressKey：絞り込み', () => {
  it('打った文字に合う選択肢だけが候補に残る（大文字・小文字は区別しない）', () => {
    const { state, last } = type(startBlank(BLANK, keepOrder), ['f']);
    expect(last.result).toBe('ok');
    expect(state.candidates).toEqual([0, 2]);
    expect(state.typed).toBe(1);
  });

  it('どの候補にも合わないキーは miss で、何も進まない', () => {
    const start = startBlank(BLANK, keepOrder);
    const { state, last } = type(start, ['x']);
    expect(last.result).toBe('miss');
    expect(state.typed).toBe(0);
    expect(state.candidates).toEqual([0, 1, 2]);
  });

  it('Shift・Backspace などは ignored。区切りは Space でも Enter でもよい', () => {
    const start = startBlank(BLANK, keepOrder);
    expect(pressKey(start, 'Shift').result).toBe('ignored');
    const { state } = type(start, [...'from', 'Enter']);
    expect(state.typed).toBe(5);
    expect(state.candidates).toEqual([0]);
  });
});

describe('pressKey：確定', () => {
  it('正解を最後まで打つと decidedCorrect', () => {
    const { last, results } = type(startBlank(BLANK, keepOrder), [...'FROM products']);
    expect(results.slice(0, -1).every((r) => r.result === 'ok')).toBe(true);
    expect(last.result).toBe('decidedCorrect');
  });

  it('間違いを最後まで打つと decidedWrong と why。空欄は最初からで、選んだ間違いはもう候補にならない', () => {
    const { state, last } = type(startBlank(BLANK, keepOrder), [...'INTO products']);
    expect(last).toMatchObject({
      result: 'decidedWrong',
      why: 'INTO は INSERT で使う',
      text: 'INTO products',
    });
    expect(state).toMatchObject({ typed: 0, candidates: [0, 2], rejected: [1] });
    // もう一度 I を打っても候補がないので miss
    expect(pressKey(state, 'I').result).toBe('miss');
  });

  it('文字列の中は大文字・小文字を区別する', () => {
    const blank = { answer: "'Mug'", wrong: [{ text: "'Pen'", why: 'x' }] };
    const start = startBlank(blank, keepOrder);
    expect(type(start, ["'", 'm']).last.result).toBe('miss');
    expect(type(start, [..."'Mug'"]).last.result).toBe('decidedCorrect');
  });
});
