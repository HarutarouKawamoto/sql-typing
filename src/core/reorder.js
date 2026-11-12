import { splitClauses } from './clause-splitter.js';

/**
 * 見える化B（実行順の並び替え）のチップ。書いた順に並んだ句を、実行順に入れ替えて見せるための材料。
 * 元：docs/functional-design.md の ReorderIntro
 */

/**
 * @typedef {import('./clause-splitter.js').ClauseKind} ClauseKind
 * @typedef {{ kind: ClauseKind, label: string, writtenOrder: number, execOrder: number }} ReorderChip
 */

/**
 * @param {string} sql
 * @param {number} [maxLength] - チップの文字の長さの上限（超えたら切って「…」）
 * @returns {ReorderChip[] | null} 書いた順のチップ。句に分けられない・句が1つだけ（入れ替わりがない）なら null
 */
export function buildReorderChips(sql, maxLength = 28) {
  const { ok, clauses } = splitClauses(sql);
  if (!ok || clauses.length < 2) return null;
  return clauses.map((clause) => ({
    kind: clause.kind,
    label: shorten(sql.slice(clause.start, clause.end).replace(/\s+/g, ' ').trim(), maxLength),
    writtenOrder: clause.writtenOrder,
    execOrder: clause.execOrder,
  }));
}

/** @param {string} text @param {number} maxLength */
function shorten(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
