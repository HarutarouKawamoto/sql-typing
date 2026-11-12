/**
 * 実行計画の節の言葉（インデックスの比較・実行計画の木で使う）。
 * 元：docs/functional-design.md の IndexRace・PlanTree
 */

/** @typedef {import('../../core/explain.js').PlanNode} PlanNode */

/** 節の種類ごとの一言（木の箱に1行で入る長さにする）。PostgreSQL の Node Type の名前で引く */
export const NODE_WORDS = Object.freeze({
  'Seq Scan': '全部の行を、上から順に読む',
  'Index Scan': '索引で、目的の行だけを探す',
  'Index Only Scan': '索引だけで答える（表は読まない）',
  'Bitmap Heap Scan': '索引で集めた場所の行を読む',
  'Bitmap Index Scan': '索引で行の場所を集める',
  'Tid Scan': '行の場所を直接読む',
  'Hash Join': '探す表を引いて、つなぐ',
  'Nested Loop': '1行ずつ相手を探してつなぐ',
  'Merge Join': '並べた2つを順につなぐ',
  Hash: 'つなぐための探す表を作る',
  Sort: '並べ替える',
  'Incremental Sort': '途中まで並んだ行を並べる',
  Aggregate: '集計する（まとめる）',
  WindowAgg: '行ごとに集計を足す',
  Limit: '先頭の行だけを残す',
  Memoize: '探した結果を覚えて使い回す',
  Materialize: '結果をためて読み直す',
  Unique: '同じ行をまとめる',
  Result: '値を計算する',
  'Subquery Scan': '副問い合わせの結果を読む',
  'CTE Scan': 'WITH の結果を読む',
  Append: '結果を縦に並べる',
  SetOp: '集合の計算をする',
});

/**
 * かかった時間の文字。ブラウザの PGlite は短い時間を 0 と返すことがあるので、測れないほど短いときはそう書く。
 * @param {number} ms
 */
export const timeText = (ms) => (ms < 0.001 ? '0.001 ms 未満' : `${ms.toFixed(3)} ms`);

/** @param {number} n */
export const rowsText = (n) => `${n.toLocaleString('ja-JP')}行`;

/**
 * 節が読んだテーブル。別名がテーブル名と違えば添える。
 * @param {PlanNode} node
 */
export const relationText = (node) =>
  node.relation === null
    ? null
    : `${node.relation}${node.alias && node.alias !== node.relation ? ` ${node.alias}` : ''}`;

/**
 * 節が返した行。2回以上実行された節は回数を、実行されなかった節はそう書く。
 * @param {PlanNode} node
 */
export function resultText(node) {
  if (node.loops === 0) return '実行されなかった';
  const loops = node.loops > 1 ? `（${node.loops.toLocaleString('ja-JP')}回）` : '';
  return `${rowsText(node.rows)}を返す${loops}`;
}

/**
 * 文字の幅のおおよそ（文字の大きさを1とした数）。英数字は約0.6、日本語などは1。
 * SVG の文字は折り返さないので、箱からはみ出さないように測る。
 * @param {string} text
 */
export function textUnits(text) {
  let units = 0;
  for (const char of text) units += /[ -~]/.test(char) ? 0.6 : 1;
  return units;
}

/**
 * 幅（文字の大きさを1とした数）に収まるように、後ろを「…」にして縮める。
 * @param {string} text
 * @param {number} maxUnits
 */
export function fitText(text, maxUnits) {
  if (textUnits(text) <= maxUnits) return text;
  const chars = [...text];
  while (chars.length > 0 && textUnits(`${chars.join('')}…`) > maxUnits) chars.pop();
  return `${chars.join('')}…`;
}
