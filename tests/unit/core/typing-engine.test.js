import { describe, it, expect } from 'vitest';
import {
  buildTarget,
  createTypingState,
  pressKey,
  untypableSlots,
} from '../../../src/core/typing-engine.js';

describe('untypableSlots', () => {
  it('普通のSQL（改行・字下げは区切りになる）は0件', () => {
    expect(untypableSlots(buildTarget('SELECT *\n\tFROM products'))).toEqual([]);
  });

  it('文字列・コメントの中の改行やタブ、全角文字を見つける', () => {
    const found = untypableSlots(buildTarget("SELECT 'a\nb', '\t', '雑貨' /* x\ny */ FROM t"));
    expect(found.map((f) => f.char)).toEqual(['\n', '\t', '雑', '貨', '\n']);
  });
});

/** 文字列を1文字ずつ打つ（'\n' は Enter として打つ）。最後の pressKey の戻り値と、途中の clauseEnded を返す */
function typeText(target, text, state = createTypingState(target)) {
  let current = state;
  let last = null;
  const clauseEnded = [];
  for (const ch of text) {
    last = pressKey(current, target, ch === '\n' ? 'Enter' : ch);
    current = last.state;
    if (last.clauseEnded !== undefined) clauseEnded.push(last.clauseEnded);
  }
  return { state: current, last, clauseEnded };
}

describe('buildTarget', () => {
  it('文字ごとのスロットと、連続する空白・改行をまとめた区切りスロットを作る', () => {
    const target = buildTarget('SELECT *\n  FROM t');
    expect(target.slots.map((s) => (s.kind === 'separator' ? '_' : s.expected)).join('')).toBe(
      'SELECT_*_FROM_t',
    );
    const separator = target.slots[6];
    expect(separator).toMatchObject({ kind: 'separator', start: 6, end: 7 });
    expect(target.slots[8]).toMatchObject({ kind: 'separator', start: 8, end: 11 });
  });

  it('前後の空白はスロットにしない', () => {
    const target = buildTarget('  SELECT 1 \n');
    expect(target.slots).toHaveLength(8);
    expect(target.slots[0]).toMatchObject({ expected: 'S', start: 2 });
  });

  it('文字列の中の文字は大文字・小文字を区別し、空白も普通の文字にする', () => {
    const target = buildTarget("a = 'Mug  Cup'");
    const inString = target.slots.filter((s) => s.caseSensitive);
    expect(inString.map((s) => s.expected).join('')).toBe("'Mug  Cup'");
    expect(inString.every((s) => s.kind === 'char')).toBe(true);
  });

  it('句の最後の文字のスロットに、何番目の句かを付ける', () => {
    const target = buildTarget('SELECT * FROM products');
    // 'SELECT *' の '*' はスロット7、'products' の最後の 's' はスロット21
    expect([...target.clauseEnds]).toEqual([
      [7, 0],
      [21, 1],
    ]);
  });
});

describe('pressKey', () => {
  const target = buildTarget("SELECT * FROM t WHERE n = 'Mug'");

  it('キーワードを小文字で打っても ok になる', () => {
    const { last } = typeText(target, 's');
    expect(last.result).toBe('ok');
  });

  it('区切りスロットは Space でも Enter でも ok', () => {
    const afterSelect = typeText(target, 'SELECT').state;
    expect(pressKey(afterSelect, target, ' ').result).toBe('ok');
    expect(pressKey(afterSelect, target, 'Enter').result).toBe('ok');
  });

  it('区切りでないところの Enter・Space は miss', () => {
    const start = createTypingState(target);
    expect(pressKey(start, target, 'Enter').result).toBe('miss');
    expect(pressKey(start, target, ' ').result).toBe('miss');
  });

  it('間違えたキーは miss。赤い印を付けて位置は1つ進む（直さずに書き進められる）', () => {
    const start = createTypingState(target);
    const { state, result } = pressKey(start, target, 'x');
    expect(result).toBe('miss');
    expect(state.position).toBe(1);
    expect(state.okCount).toBe(0);
    expect(state.missCount).toBe(1);
    expect(state.missedSlots).toEqual([0]);
    expect(state.lastMissAt).toBe(0);
    // 元の状態は変えない
    expect(start.missCount).toBe(0);
    expect(start.position).toBe(0);
  });

  it('続けて間違えると、それぞれのスロットに印が付く。正しく打つと直前の印の目印は消える', () => {
    const once = pressKey(createTypingState(target), target, 'x').state;
    const twice = pressKey(once, target, 'y').state;
    expect(twice).toMatchObject({ position: 2, missCount: 2, missedSlots: [0, 1], lastMissAt: 1 });
    const ok = pressKey(twice, target, 'L').state;
    expect(ok).toMatchObject({ position: 3, missedSlots: [0, 1], lastMissAt: null });
  });

  it('間違えて進んでも、句の終わり・打ち終わりは届く', () => {
    const short = buildTarget('SELECT 1');
    const { state } = typeText(short, 'SELECT ');
    expect(pressKey(state, short, '2')).toMatchObject({ result: 'miss', done: true });
  });

  it('文字列の中で大文字・小文字が違うと miss', () => {
    const { state } = typeText(target, "SELECT * FROM t WHERE n = '");
    expect(pressKey(state, target, 'm').result).toBe('miss');
    expect(pressKey(state, target, 'M').result).toBe('ok');
  });

  it('大文字・小文字だけが違う miss には caseOnly を付ける（Caps Lock のまま打っていると気づけるように）', () => {
    const { state } = typeText(target, "SELECT * FROM t WHERE n = '");
    expect(pressKey(state, target, 'm')).toMatchObject({ result: 'miss', caseOnly: true });
    // 違う文字の miss、文字列の外の miss には付けない
    expect(pressKey(state, target, 'x').caseOnly).toBeUndefined();
    expect(pressKey(createTypingState(target), target, 'x').caseOnly).toBeUndefined();
  });

  it('Shift・Backspace など長さ2以上のキーは ignored で、何も変わらない', () => {
    const start = createTypingState(target);
    for (const key of ['Shift', 'Backspace', 'Tab', 'ArrowLeft']) {
      const { state, result } = pressKey(start, target, key);
      expect(result).toBe('ignored');
      expect(state).toBe(start);
    }
  });

  it('句の最後の文字を打ったときに clauseEnded を返す', () => {
    const { clauseEnded } = typeText(target, 'SELECT * FROM t WHERE');
    expect(clauseEnded).toEqual([0, 1]);
  });

  it('最後まで打つと done になり、そのあとのキーは ignored', () => {
    const { state, last, clauseEnded } = typeText(target, "select * from t\nwhere n = 'Mug'");
    expect(last.done).toBe(true);
    expect(clauseEnded).toEqual([0, 1, 2]);
    expect(state.okCount).toBe(target.slots.length);
    expect(pressKey(state, target, 'x').result).toBe('ignored');
  });
});
