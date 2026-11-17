import { describe, it, expect } from 'vitest';
import {
  createBlankTypingState,
  locateBlanks,
  maskBlankAnswers,
  pressBlankKey,
} from '../../../src/core/blank-typing.js';
import { buildTarget, createTypingState, pressKey } from '../../../src/core/typing-engine.js';

/** 混ぜない（並び順を正解・間違いの順のままにする） */
const keepOrder = () => 0.999999;

const FROM_BLANK = {
  answer: 'FROM products',
  wrong: [{ text: 'INTO products', why: 'INTO は INSERT で使う' }],
};

function typeAll(state, target, keys) {
  let current = state;
  const results = [];
  for (const key of keys) {
    const outcome = pressBlankKey(current, target, key, keepOrder);
    current = outcome.state;
    results.push(outcome);
  }
  return { state: current, results, last: results.at(-1) };
}

describe('locateBlanks', () => {
  it('空欄の正解のスロットの範囲を返す（end は含まない）', () => {
    const target = buildTarget('SELECT * FROM products');
    expect(locateBlanks(target, [FROM_BLANK])).toEqual([{ start: 9, end: 22, blank: FROM_BLANK }]);
  });

  it('表示用SQLで改行・字下げになっていても、区切りどうしとして見つける', () => {
    const target = buildTarget('SELECT *\n  FROM products');
    expect(locateBlanks(target, [FROM_BLANK])[0]).toMatchObject({ start: 9, end: 22 });
  });

  it('文字列の外は大文字・小文字の違いを気にしない（画面で打つときと同じ比べ方）。文字列の中は区別する', () => {
    const target = buildTarget("select * from products where name = 'Mug'");
    expect(locateBlanks(target, [FROM_BLANK])[0]).toMatchObject({ start: 9, end: 22 });
    expect(() => locateBlanks(target, [{ answer: "'mug'", wrong: [] }])).toThrow('見つかりません');
  });

  it('2つ以上の空欄は、表示用SQLの中の順に並べる', () => {
    const where = { answer: 'price > 1000', wrong: [{ text: 'price < 1000', why: 'x' }] };
    const name = { answer: 'name', wrong: [{ text: 'stock', why: 'y' }] };
    const target = buildTarget('SELECT name FROM products WHERE price > 1000');
    expect(locateBlanks(target, [where, name]).map((r) => r.blank)).toEqual([name, where]);
  });

  it('見つからない空欄・重なる空欄は投げる（問題データの検証で止める）', () => {
    const target = buildTarget('SELECT * FROM products');
    expect(() => locateBlanks(target, [{ answer: 'FROM items', wrong: [] }])).toThrow(
      '空欄「FROM items」',
    );
    const overlap = { answer: 'products', wrong: [] };
    expect(() => locateBlanks(target, [FROM_BLANK, overlap])).toThrow('重なって');
  });
});

describe('pressBlankKey：空欄がないときは TypingEngine と同じ', () => {
  it('同じキーで同じ結果（ok・miss・句の終わり・打ち終わり）', () => {
    const target = buildTarget('SELECT 1');
    let plain = createTypingState(target);
    let blank = createBlankTypingState(target, [], keepOrder);
    for (const key of ['S', 'x', ...'ELECT 1', 'a']) {
      const a = pressKey(plain, target, key);
      const b = pressBlankKey(blank, target, key, keepOrder);
      expect({ ...b, state: undefined, inBlank: undefined }).toEqual({ ...a, state: undefined });
      expect(b.state.typing).toEqual(a.state);
      plain = a.state;
      blank = b.state;
    }
  });
});

describe('pressBlankKey：空欄', () => {
  const target = buildTarget('SELECT * FROM products');
  const start = () => createBlankTypingState(target, [FROM_BLANK], keepOrder);

  it('空欄の始まりまで打つと、その空欄が始まる', () => {
    const { state, last } = typeAll(start(), target, [...'SELECT * ']);
    expect(last).toMatchObject({ result: 'ok', inBlank: false });
    expect(state.active).toBe(0);
    expect(state.choice.choices.map((c) => c.text)).toEqual(['FROM products', 'INTO products']);
  });

  it('空欄の中の ok・miss も、打った数・ミスの数に入る。位置は空欄の始まりのまま', () => {
    const before = typeAll(start(), target, [...'SELECT * ']).state;
    const { state, results } = typeAll(before, target, ['F', 'x']);
    expect(results.map((r) => [r.result, r.inBlank])).toEqual([
      ['ok', true],
      ['miss', true],
    ]);
    expect(state.typing).toMatchObject({
      position: 9,
      okCount: before.typing.okCount + 1,
      missCount: before.typing.missCount + 1,
    });
    // 空欄の中の miss は、表示用SQLのスロットの印にしない
    expect(state.typing.missedSlots).toEqual(before.typing.missedSlots);
  });

  it('間違いを打ち切ると decidedWrong と why。選び間違えた回数を数え、空欄はそのまま', () => {
    const before = typeAll(start(), target, [...'SELECT * ']).state;
    const { state, last } = typeAll(before, target, [...'INTO products']);
    expect(last).toMatchObject({
      result: 'decidedWrong',
      why: 'INTO は INSERT で使う',
      inBlank: true,
    });
    expect(state).toMatchObject({ active: 0, wrongChoices: 1 });
    expect(state.typing.position).toBe(9);
  });

  it('正解を打ち切ると空欄が埋まり、空欄の中で終わった句と、打ち終わりを知らせる', () => {
    const { state, last } = typeAll(start(), target, [...'SELECT * FROM products']);
    expect(last).toMatchObject({ result: 'decidedCorrect', clauseEnded: 1, done: true });
    expect(state).toMatchObject({ active: null, choice: null, filled: 1 });
    expect(state.typing.position).toBe(target.slots.length);
    expect(pressBlankKey(state, target, 'x', keepOrder).result).toBe('ignored');
  });

  it('先頭が空欄なら、最初から空欄が始まっている', () => {
    const t = buildTarget('SELECT 1');
    const state = createBlankTypingState(
      t,
      [{ answer: 'SELECT', wrong: [{ text: 'DELETE', why: 'z' }] }],
      keepOrder,
    );
    expect(state.active).toBe(0);
  });

  it('2つの空欄：1つ目を埋めたら後ろを打ち、2つ目でまた選ぶ。句の終わりは空欄の中の最後の句', () => {
    const t = buildTarget('SELECT name FROM products WHERE price > 1000');
    const name = { answer: 'name', wrong: [{ text: 'stock', why: 'y' }] };
    const where = { answer: 'price > 1000', wrong: [{ text: 'price < 1000', why: 'x' }] };
    const s0 = createBlankTypingState(t, [name, where], keepOrder);
    const first = typeAll(s0, t, [...'SELECT name']);
    expect(first.last).toMatchObject({ result: 'decidedCorrect', clauseEnded: 0 });
    expect(first.state).toMatchObject({ active: null, filled: 1 });
    const second = typeAll(first.state, t, [...' FROM products WHERE ']);
    expect(second.results.map((r) => r.clauseEnded).filter((c) => c !== undefined)).toEqual([1]);
    expect(second.state.active).toBe(1);
    const third = typeAll(second.state, t, [...'price > 1000']);
    expect(third.last).toMatchObject({ result: 'decidedCorrect', clauseEnded: 2, done: true });
  });

  it('隣り合う空欄（区切りなし）は、1つ目を埋めたらすぐ2つ目が始まる', () => {
    const t = buildTarget('SELECT count(*) FROM products');
    const fn = { answer: 'count', wrong: [{ text: 'sum', why: 'a' }] };
    const arg = { answer: '(*)', wrong: [{ text: '(id)', why: 'b' }] };
    const s0 = createBlankTypingState(t, [fn, arg], keepOrder);
    const { state, last } = typeAll(s0, t, [...'SELECT count']);
    expect(last.result).toBe('decidedCorrect');
    expect(state.active).toBe(1);
  });
});

describe('maskBlankAnswers', () => {
  const blank = (answer) => ({ answer, wrong: [{ text: 'x', why: 'y' }] });

  it('空欄の答えの文字を空白にする（長さは変えない）', () => {
    const sql = 'SELECT * FROM products';
    expect(maskBlankAnswers(sql, [blank('FROM products')])).toBe('SELECT *              ');
  });

  it('改行・字下げのある表示用SQLでも、空欄と同じ探し方で見つける', () => {
    const sql = 'SELECT name\nFROM\n  products\nWHERE price > 1';
    // 改行は残す（行の形を変えない）
    expect(maskBlankAnswers(sql, [blank('FROM products')])).toBe(
      'SELECT name\n    \n          \nWHERE price > 1',
    );
  });

  it('キーワードの大文字・小文字が違っても見つける', () => {
    expect(maskBlankAnswers('select * from products', [blank('FROM products')])).toBe(
      'select *              ',
    );
  });

  it('空欄が2つでも、それぞれ消す', () => {
    expect(
      maskBlankAnswers('SELECT name FROM orders ORDER BY id DESC', [
        blank('orders'),
        blank('DESC'),
      ]),
    ).toBe('SELECT name FROM        ORDER BY id     ');
  });

  it('空欄がなければそのまま', () => {
    expect(maskBlankAnswers('SELECT 1', [])).toBe('SELECT 1');
  });
});

describe('pressBlankKey：大文字・小文字だけが違う miss', () => {
  it('空欄の外の文字列の中で、大文字・小文字だけが違うと caseOnly が付く', () => {
    const sql = "SELECT * FROM t WHERE c = 'kitchen'";
    const target = buildTarget(sql);
    let state = createBlankTypingState(target, [], keepOrder);
    for (const key of "SELECT * FROM t WHERE c = '") {
      state = pressBlankKey(state, target, key, keepOrder).state;
    }
    expect(pressBlankKey(state, target, 'K', keepOrder)).toMatchObject({
      result: 'miss',
      inBlank: false,
      caseOnly: true,
    });
    expect(pressBlankKey(state, target, 'k', keepOrder).result).toBe('ok');
  });
});
