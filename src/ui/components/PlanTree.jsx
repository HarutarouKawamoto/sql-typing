import { layoutPlan, PLAN_LAYOUT } from '../state/plan-layout.js';
import {
  fitText,
  NODE_WORDS,
  relationText,
  resultText,
  rowsText,
  timeText,
} from '../state/plan-words.js';
import styles from './PlanTree.module.css';

/** @typedef {import('../../core/explain.js').PlanNode} PlanNode */

/** 箱の中の文字の大きさ（px）と、左右の余白 */
const FONT = { title: 14, body: 12 };
const PAD = 10;

/**
 * 箱の1行。はみ出す文字は後ろを「…」にし、全文は箱の title（マウスを当てると出る）で見られる。
 * @param {{ y: number, text: string, className: string, size: number }} props
 */
function Line({ y, text, className, size }) {
  const max = (PLAN_LAYOUT.nodeWidth - PAD * 2) / size;
  return (
    <text x={PAD} y={y} className={className}>
      {fitText(text, max)}
    </text>
  );
}

/**
 * 読み上げ用の入れ子の一覧（図と同じ中身を、根から子の順に）。
 * @param {{ node: PlanNode }} props
 */
function SpokenNode({ node }) {
  const word = NODE_WORDS[node.nodeType];
  const relation = relationText(node);
  return (
    <li>
      {node.subplan && '副問い合わせ：'}
      {node.nodeType}
      {word && `（${word}）`}
      {relation && `、${relation}`}
      {node.index && `、索引 ${node.index}`}：{resultText(node)}
      {node.children.length > 0 && (
        <ul aria-label={`${node.nodeType} の下の節`}>
          {node.children.map((child, i) => (
            <SpokenNode key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * 実行計画の木。葉（テーブルを読む節）が下、結果が上。子 → 親の線は、流れる行が多いほど太い。
 * @param {{ summary: import('../../core/explain.js').ExplainSummary }} props
 */
export function PlanTree({ summary }) {
  const { nodes, edges, width, height } = layoutPlan(summary.plan);
  const { nodeWidth, nodeHeight } = PLAN_LAYOUT;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // 図のまわりの余白（線の文字が端で切れないように）
  const margin = 12;
  return (
    <div className={styles.tree} data-testid="plan-tree">
      <p className={styles.totals}>
        テーブルから読んだ行：
        <strong data-testid="plan-tree-rows-read">{rowsText(summary.rowsRead)}</strong>
        ／かかった時間：<strong>{timeText(summary.executionMs)}</strong>
      </p>
      <p className={styles.legend}>
        下の節から上の節へ行が流れます。線が太いほど、たくさんの行が流れています。点線の箱は実行されなかった節、点線の線は副問い合わせ（上の節が呼ぶ）です。
      </p>
      <div className={styles.scroll}>
        <svg
          className={styles.svg}
          width={width + margin * 2}
          height={height + margin * 2}
          viewBox={`${-margin} ${-margin} ${width + margin * 2} ${height + margin * 2}`}
          aria-hidden="true"
        >
          {edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + nodeWidth / 2;
            const y1 = from.y;
            const x2 = to.x + nodeWidth / 2 + edge.toOffset;
            // 矢印は線の太さに合わせて大きくする（marker だと太い線で大きくなりすぎる）。線は矢印の根元で止める
            const tipY = to.y + nodeHeight + 2;
            const arrowWidth = edge.width + 8;
            const baseY = tipY + arrowWidth * 0.8;
            const midY = (y1 + baseY) / 2;
            // 文字が曲がる線に重ならないよう、線が曲がっていく方と反対の側に置く
            const labelOnLeft = x2 > x1;
            const labelX = labelOnLeft ? x1 - edge.width / 2 - 6 : x1 + edge.width / 2 + 6;
            const classes = [
              from.node.loops === 0 ? styles.idleFlow : '',
              edge.subplan ? styles.subplan : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <g
                key={edge.from}
                className={classes || undefined}
                data-testid="plan-tree-edge"
                data-rows={edge.rows}
                data-subplan={edge.subplan}
              >
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${baseY}`}
                  className={styles.edge}
                  strokeWidth={edge.width}
                />
                <polygon
                  points={`${x2},${tipY} ${x2 - arrowWidth / 2},${baseY} ${x2 + arrowWidth / 2},${baseY}`}
                  className={styles.arrow}
                />
                <text
                  x={labelX}
                  y={y1 - 8}
                  textAnchor={labelOnLeft ? 'end' : 'start'}
                  className={styles.edgeLabel}
                >
                  {edge.subplan ? `副問い合わせ ${rowsText(edge.rows)}` : rowsText(edge.rows)}
                </text>
              </g>
            );
          })}
          {nodes.map(({ id, node, x, y }) => {
            const word = NODE_WORDS[node.nodeType];
            const relation = relationText(node);
            const index = node.index ? `索引 ${node.index}` : null;
            const full = [node.nodeType, word, relation, index, resultText(node)]
              .filter(Boolean)
              .join('\n');
            return (
              <g
                key={id}
                transform={`translate(${x} ${y})`}
                className={node.loops === 0 ? styles.idle : undefined}
                data-testid="plan-tree-node"
                data-node-type={node.nodeType}
                data-loops={node.loops}
              >
                <title>{full}</title>
                <rect width={nodeWidth} height={nodeHeight} rx="8" className={styles.box} />
                <Line y={20} text={node.nodeType} className={styles.nodeType} size={FONT.title} />
                {word && <Line y={40} text={word} className={styles.word} size={FONT.body} />}
                {relation && (
                  <Line y={58} text={relation} className={styles.target} size={FONT.body} />
                )}
                {index && <Line y={76} text={index} className={styles.target} size={FONT.body} />}
                <Line y={94} text={resultText(node)} className={styles.result} size={FONT.body} />
              </g>
            );
          })}
        </svg>
      </div>
      <ul className={styles.srOnly} aria-label="実行計画の木（上が結果）">
        <SpokenNode node={summary.plan} />
      </ul>
    </div>
  );
}
