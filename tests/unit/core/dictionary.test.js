import { describe, it, expect } from 'vitest';
import { buildDictionary } from '../../../src/core/dictionary.js';

const kw = (word, level) => ({
  word,
  english: `${word}の英語`,
  meaning: `${word}の意味`,
  example: word,
  level,
});
const problem = (id, keywords) => ({ id, title: `題名${id}`, keywords });

describe('buildDictionary', () => {
  it('レベルごとに、keywords.yaml の順で並べ、出題順で最初に使う問題を付ける', () => {
    const dictionary = buildDictionary(
      [kw('SELECT', 1), kw('JOIN', 2), kw('FROM', 1), kw('WHERE', 1)],
      [
        problem('b-01', ['SELECT', 'FROM']),
        problem('b-02', ['WHERE', 'SELECT']),
        problem('m-01', ['JOIN']),
      ],
    );
    expect(dictionary.map((group) => group.level)).toEqual([1, 2]);
    expect(dictionary[0].entries.map((e) => [e.word, e.firstProblem?.id])).toEqual([
      ['SELECT', 'b-01'],
      ['FROM', 'b-01'],
      ['WHERE', 'b-02'],
    ]);
    expect(dictionary[1].entries[0]).toEqual({
      ...kw('JOIN', 2),
      firstProblem: { id: 'm-01', title: '題名m-01' },
    });
  });

  it('どの問題にも出てこない語は firstProblem が null', () => {
    const [group] = buildDictionary([kw('ASC', 1)], [problem('b-01', ['SELECT'])]);
    expect(group.entries[0].firstProblem).toBeNull();
  });

  it('用語がなければ空。出てこないレベルの見出しは作らない', () => {
    expect(buildDictionary([], [])).toEqual([]);
    expect(buildDictionary([kw('WITH', 3)], []).map((g) => g.level)).toEqual([3]);
  });
});
