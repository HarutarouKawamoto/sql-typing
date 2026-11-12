/**
 * 用語辞典の中身。レベルごとに用語を並べ、初めて出てくる問題を付ける（手で書かず、問題の keywords から作る）。
 * 元：docs/functional-design.md の「エンティティ：Keyword」
 */

/**
 * @typedef {import('../schema/keyword-schema.js').Keyword} Keyword
 * @typedef {Keyword & { firstProblem: { id: string, title: string } | null }} DictionaryEntry
 */

/**
 * @param {Keyword[]} keywords - keywords.yaml の順
 * @param {{ id: string, title: string, keywords: string[] }[]} problems - 出題順（全章をつないだもの）
 * @returns {{ level: 1 | 2 | 3, entries: DictionaryEntry[] }[]} 出てくるレベルだけ、レベルの順
 */
export function buildDictionary(keywords, problems) {
  /** @type {Map<string, { id: string, title: string }>} */
  const first = new Map();
  for (const { id, title, keywords: used } of problems) {
    for (const word of used) if (!first.has(word)) first.set(word, { id, title });
  }
  return /** @type {const} */ ([1, 2, 3])
    .map((level) => ({
      level,
      entries: keywords
        .filter((keyword) => keyword.level === level)
        .map((keyword) => ({ ...keyword, firstProblem: first.get(keyword.word) ?? null })),
    }))
    .filter((group) => group.entries.length > 0);
}
