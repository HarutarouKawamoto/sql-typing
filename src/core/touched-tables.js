import { tokenize } from './sql-text.js';

/**
 * SQLが触っているテーブル（DBの地図で光らせる）。字句だけで見るので、打っている途中・エラーになるSQLでも使える。
 * 元：docs/functional-design.md の SchemaMap
 */

/**
 * @param {string} sql
 * @param {string[]} tableNames - 地図にあるテーブル名（PostgreSQL の名前のまま）
 * @returns {string[]} tableNames のうち sql に出てくるもの（tableNames の順）
 */
export function touchedTables(sql, tableNames) {
  const found = new Set();
  for (const token of tokenize(sql)) {
    // 引用符なしの名前は PostgreSQL が小文字にする。引用符つきは中身そのまま（"" は " 1つ）
    if (token.type === 'word') found.add(token.text.toLowerCase());
    if (token.type === 'quoted') {
      // 打っている途中で閉じていない引用符は、最後の文字を切らない
      const closed = token.text.length > 1 && token.text.endsWith('"');
      found.add(token.text.slice(1, closed ? -1 : undefined).replaceAll('""', '"'));
    }
  }
  return tableNames.filter((name) => found.has(name));
}
