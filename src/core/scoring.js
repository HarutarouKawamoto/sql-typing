import { tokenize } from './sql-text.js';

/**
 * モード1・2の速さ・正確さ・ランクと、苦手（ミスの多い記号・キーワード）の集計。
 * 元：docs/functional-design.md の Scoring
 */

/** ランクの基準（速さと正確さの両方を満たす最も高いもの）。数値は仮で、遊んでから見直す */
export const RANK_RULES = [
  { rank: 'S', cpm: 250, accuracy: 98 },
  { rank: 'A', cpm: 180, accuracy: 95 },
  { rank: 'B', cpm: 120, accuracy: 90 },
];

/**
 * @param {number} cpm
 * @param {number} accuracy
 * @returns {'S' | 'A' | 'B' | 'C'}
 */
export function rankFor(cpm, accuracy) {
  const rule = RANK_RULES.find((r) => cpm >= r.cpm && accuracy >= r.accuracy);
  return /** @type {'S' | 'A' | 'B' | 'C'} */ (rule ? rule.rank : 'C');
}

/**
 * @param {{ okCount: number, missCount: number, elapsedMs: number }} counts
 * @returns {{ cpm: number, accuracy: number, rank: 'S' | 'A' | 'B' | 'C' }}
 */
export function computeTypingStats({ okCount, missCount, elapsedMs }) {
  const cpm = elapsedMs > 0 ? Math.floor(okCount / (elapsedMs / 60_000)) : 0;
  const total = okCount + missCount;
  const accuracy = total > 0 ? Math.round((okCount / total) * 1000) / 10 : 100;
  return { cpm, accuracy, rank: rankFor(cpm, accuracy) };
}

/**
 * target の文字の位置 → そのトークン、の対応を作る（target ごとに1回だけ作る）。
 * @param {import('./typing-engine.js').TypingTarget} target
 */
function tokenIndexByChar(target) {
  const tokens = tokenize(target.text);
  const byChar = new Map();
  tokens.forEach((token, index) => {
    for (let i = token.start; i < token.end; i += 1) byChar.set(i, index);
  });
  return { tokens, byChar };
}

/** 空白・コメントを飛ばして、隣の単語のトークンを探す */
function neighborWord(tokens, index, step) {
  for (let i = index + step; i >= 0 && i < tokens.length; i += step) {
    if (tokens[i].type === 'space' || tokens[i].type === 'comment') continue;
    return tokens[i].type === 'word' ? i : -1;
  }
  return -1;
}

/**
 * スロットを数えるときのキーと、同じキーワードを1回と数えるための「まとまり」の番号。
 * @returns {{ key: string, group: string } | null}
 */
function keyOfSlot(target, slotIndex, keywordSet, index) {
  const slot = target.slots[slotIndex];
  if (!slot || slot.kind === 'separator') return null;
  const tokenIndex = index.byChar.get(slot.start);
  const token = index.tokens[tokenIndex];
  const ch = slot.expected;
  const isSymbol = !/[A-Za-z0-9\s]/.test(ch);

  if (token.type === 'word') {
    const word = token.text.toUpperCase();
    const prev = neighborWord(index.tokens, tokenIndex, -1);
    if (prev !== -1) {
      const pair = `${index.tokens[prev].text.toUpperCase()} ${word}`;
      if (keywordSet.has(pair)) return { key: pair, group: `w${prev}` };
    }
    const next = neighborWord(index.tokens, tokenIndex, 1);
    if (next !== -1) {
      const pair = `${word} ${index.tokens[next].text.toUpperCase()}`;
      if (keywordSet.has(pair)) return { key: pair, group: `w${tokenIndex}` };
    }
    return keywordSet.has(word) ? { key: word, group: `w${tokenIndex}` } : null;
  }
  // 記号（文字列の中の ' や % も含む）は1文字ごとに数える。列名・数・文字列の中の英数字は数えない
  return isSymbol ? { key: ch, group: `s${slotIndex}` } : null;
}

/**
 * ミスしたスロットを、苦手として数えるキーにする。記号はその1文字、英字はそのスロットを含むキーワード
 * （用語辞典にあるもの。2語のキーワードを優先）。列名・テーブル名・数・区切りは null。
 * @param {import('./typing-engine.js').TypingTarget} target
 * @param {number} slotIndex
 * @param {string[]} keywords - 用語辞典の word（大文字。'ORDER BY' のように2語もある）
 * @returns {string | null}
 */
export function weakPointKey(target, slotIndex, keywords) {
  return keyOfSlot(target, slotIndex, new Set(keywords), tokenIndexByChar(target))?.key ?? null;
}

/**
 * 問題を1回打ち終えたときに「打った」と数える回数。キーワードは1語（2語のものは2語で）につき1回、記号は1文字につき1回。
 * @param {import('./typing-engine.js').TypingTarget} target
 * @param {string[]} keywords
 * @returns {Record<string, number>}
 */
export function countTypedKeys(target, keywords) {
  const keywordSet = new Set(keywords);
  const index = tokenIndexByChar(target);
  const seenGroups = new Set();
  /** @type {Record<string, number>} */
  const counts = {};
  target.slots.forEach((_, slotIndex) => {
    const found = keyOfSlot(target, slotIndex, keywordSet, index);
    if (!found || seenGroups.has(found.group)) return;
    seenGroups.add(found.group);
    counts[found.key] = (counts[found.key] ?? 0) + 1;
  });
  return counts;
}

/**
 * 結果画面に出す苦手。typed が minTyped 回以上のものから、ミスの割合が大きい順に limit 個。
 * 1回打つあいだに同じ記号を何度も間違えると rate は1を超えるので、画面では割合ではなく回数（mistakes・typed）で見せる。
 * @param {Record<string, number>} mistakes
 * @param {Record<string, number>} typed
 * @param {{ minTyped?: number, limit?: number }} [options]
 * @returns {{ key: string, rate: number, mistakes: number, typed: number }[]}
 */
export function topWeakPoints(mistakes, typed, { minTyped = 20, limit = 3 } = {}) {
  return Object.entries(mistakes)
    .filter(([key, count]) => count > 0 && (typed[key] ?? 0) >= minTyped)
    .map(([key, count]) => ({ key, rate: count / typed[key], mistakes: count, typed: typed[key] }))
    .sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key))
    .slice(0, limit);
}
