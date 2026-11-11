/**
 * テスト用の、決まりをすべて満たした問題・章・用語・登場人物を作る。
 * 一部だけ変えたいときは overrides で上書きする。
 */

/**
 * @param {Partial<import('../../src/schema/problem-schema.js').Problem>} [overrides]
 * @returns {import('../../src/schema/problem-schema.js').Problem}
 */
export function makeProblem(overrides = {}) {
  return {
    id: 'beginner-01',
    chapterId: 'beginner',
    order: 1,
    title: 'テスト用の問題',
    kind: 'normal',
    story: {
      before: [
        { speaker: 'tencho', text: '一覧を見せて。' },
        { speaker: 'senpai', text: '手でやると半日かかるな。' },
        { speaker: 'player', text: '少し待ってください。' },
      ],
      after: [{ speaker: 'senpai', text: 'もう出たの？' }],
    },
    setup: {},
    answer: 'SELECT name, price FROM products WHERE price >= 1000',
    blanks: [
      {
        answer: 'WHERE price >= 1000',
        wrong: [
          { text: 'HAVING price >= 1000', why: 'まとめていないので WHERE。' },
          { text: 'ORDER BY price', why: '並べ替えるだけで行は減らない。' },
        ],
      },
    ],
    hints: [
      '使う句は SELECT・FROM・WHERE。',
      '書く順は SELECT → FROM → WHERE。',
      'SELECT 列 FROM products WHERE ???',
    ],
    judge: { ordered: false, checkColumnNames: false, require: [], forbid: [] },
    keywords: ['SELECT', 'FROM', 'WHERE'],
    ...overrides,
  };
}

/** @returns {import('../../src/schema/chapter-schema.js').Chapter} */
export function makeChapter(overrides = {}) {
  return {
    id: 'beginner',
    level: 1,
    title: '初級',
    seed: 'beginner.sql',
    tables: ['products'],
    newTables: ['products'],
    problemIds: ['beginner-01'],
    ...overrides,
  };
}

export const KEYWORDS = ['SELECT', 'FROM', 'WHERE'].map((word) => ({
  word,
  english: '英語の意味',
  meaning: 'SQLでの意味',
  example: `${word} ...`,
  level: 1,
}));

export const CHARACTERS = ['player', 'tencho', 'senpai', 'eigyo'].map((id) => ({
  id,
  name: id,
  role: '役',
  color: `--color-character-${id}`,
}));
