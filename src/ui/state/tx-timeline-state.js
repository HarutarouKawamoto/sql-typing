/**
 * トランザクションのタイムラインの画面の状態（場面・進め方）と、結果の文。React に依存しない。
 * 元：docs/functional-design.md の TxTimeline
 */
import { autoRun, READ_FIRST_ORDER, startTx, stepTx, txOutcome } from '../../core/tx-simulation.js';

/** @typedef {import('../../core/tx-simulation.js').TxState} TxState */
/** @typedef {import('../../core/tx-simulation.js').TxSide} TxSide */
/** @typedef {import('../../core/tx-simulation.js').TxScenarioId} TxScenarioId */
/**
 * @typedef {{ type: 'step', side: TxSide } | { type: 'reset' } | { type: 'scenario', id: TxScenarioId } | { type: 'readFirstOrder' }} TxAction
 */

/** A・B の名前（初期データの customers の1人目・2人目） */
export const TX_SIDE_NAMES = Object.freeze({ A: 'A（Aiko）', B: 'B（Ben）' });

/**
 * @param {TxState} state
 * @param {TxAction} action
 * @returns {TxState}
 */
export function txTimelineReducer(state, action) {
  switch (action.type) {
    case 'step':
      return stepTx(state, action.side);
    case 'reset':
      return startTx(state.scenarioId);
    case 'scenario':
      return startTx(action.id);
    case 'readFirstOrder':
      // 途中からではなく最初から、両方が先に読む順で最後まで進める（同じ順で場面を比べられるように）
      return autoRun(startTx(state.scenarioId), READ_FIRST_ORDER);
  }
}

/**
 * 見本の順で進めるボタンの文。1文で確かめて減らす場面には在庫を読む手順がないので、言い方を変える。
 * @param {TxScenarioId} scenarioId
 */
export function readFirstLabel(scenarioId) {
  return scenarioId === 'atomic'
    ? '両方がほぼ同時に UPDATE する順で、最初から最後まで進める'
    : '両方が先に在庫を読む順で、最初から最後まで進める';
}

/**
 * 両方が終わったときの結果の文。終わっていなければ null。
 * @param {TxState} state
 */
export function outcomeText(state) {
  const outcome = txOutcome(state);
  if (!outcome) return null;
  if (outcome.kind === 'oversold') {
    return `売りすぎ：DB の在庫が ${outcome.stock} になり、1個しかない品に注文が ${outcome.orders} つ入りました。A も B も、相手の COMMIT の前に在庫 1 を見てから減らしたためです。`;
  }
  const stopped = /** @type {TxSide[]} */ (['A', 'B']).find(
    (side) => state.sides[side].ended === 'rollback',
  );
  const result = `DB の在庫は ${outcome.stock}、注文は ${outcome.orders} つです。${
    stopped ? `${TX_SIDE_NAMES[stopped]} は在庫 0 を見て注文をやめました。` : ''
  }`;
  // 鍵なしで売りすぎにならなかったのは順番のおかげなので、「守れた」とは書かない
  if (state.scenarioId === 'unsafe') {
    return `今回は売りすぎになりませんでした：${result}片方が COMMIT してから、もう片方が在庫を読んだからです。順番がよかっただけで、両方が先に読めば売りすぎになります。`;
  }
  const waited = state.events.some((e) => e.kind === 'wait');
  if (state.scenarioId === 'atomic') {
    return `守れた：${result}${
      waited
        ? 'UPDATE の WHERE で在庫が残っているかを確かめたので、後から来た方は相手の COMMIT まで待ち、確定した在庫 0 で確かめ直して、1行も変えませんでした。'
        : '今回は待ちませんでしたが、同時でも UPDATE の WHERE の確かめ直しで、後から来た方は1行も変えません。'
    }`;
  }
  return `守れた：${result}${
    waited
      ? 'FOR UPDATE の鍵で、後から読んだ方は相手の COMMIT まで待ち、確定した在庫を見たからです。'
      : '今回は相手が先に終わっていたので待ちませんでしたが、同時に読んでも FOR UPDATE の鍵で後から読む方が待ちます。'
  }`;
}
