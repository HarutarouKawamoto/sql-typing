/**
 * トランザクションの2列タイムラインのシミュレーション（上級の見える化C）。
 * PGlite は接続が1つで、2つのトランザクションを同時に動かせないので、PostgreSQL（READ COMMITTED）の
 * 見え方と行の鍵の決まりを、在庫1個の1行だけについて真似る。
 * 元：docs/functional-design.md の TxSimulation
 */

/**
 * @typedef {'A' | 'B'} TxSide
 * @typedef {'unsafe' | 'locked' | 'atomic'} TxScenarioId
 * @typedef {'begin' | 'read' | 'update' | 'insert' | 'commit' | 'rollback'} TxStepKind
 * @typedef {{ kind: TxStepKind, sql: string }} TxStep
 * @typedef {{
 *   pc: number,
 *   seen: number | null,
 *   ownStock: number | null,
 *   ownOrders: number,
 *   abort: boolean,
 *   waiting: boolean,
 *   ended: null | 'commit' | 'rollback',
 * }} TxSideState
 *   ownStock：自分の変更を入れた在庫（変更していなければ null）。COMMIT まで相手には見えない
 *   abort：在庫が1未満に見えたので、次は ROLLBACK する
 * @typedef {{
 *   side: TxSide,
 *   kind: 'run' | 'wait' | 'resume',
 *   step: TxStepKind,
 *   sql: string,
 *   note: string,
 *   seen?: number,
 * }} TxEvent
 * @typedef {{
 *   scenarioId: TxScenarioId,
 *   stock: number,
 *   orders: number,
 *   lockOwner: TxSide | null,
 *   sides: Record<TxSide, TxSideState>,
 *   events: TxEvent[],
 * }} TxState
 *   stock・orders：DB に確定した値（COMMIT されたものだけ）
 */

/** 初期データで在庫1個の品（Shoulder Bag Leather） */
const PRODUCT_ID = 28;
const CUSTOMER_IDS = { A: 1, B: 2 };

export const TX_SCENARIOS = Object.freeze({
  unsafe: Object.freeze({
    id: 'unsafe',
    title: '鍵なし（SELECT で見てから UPDATE）',
    lock: false,
  }),
  locked: Object.freeze({
    id: 'locked',
    title: '鍵あり（SELECT ... FOR UPDATE）',
    lock: true,
  }),
  // 在庫を読まずに、UPDATE の WHERE で「残っているか」を確かめる（確かめと減らすことを1文にする）
  atomic: Object.freeze({
    id: 'atomic',
    title: '1文で確かめて減らす（UPDATE ... AND stock > 0）',
    lock: false,
  }),
});

/** 両方が先に在庫を読む順（鍵なしだと売りすぎになり、鍵ありだと後から読む方が待つ） */
export const READ_FIRST_ORDER = Object.freeze(
  /** @type {TxSide[]} */ (['A', 'B', 'A', 'B', 'A', 'B', 'A', 'A', 'B', 'B']),
);

/** @param {TxSide} side */
const other = (side) => (side === 'A' ? 'B' : 'A');

/**
 * @param {TxScenarioId} scenarioId
 * @param {TxSide} side
 * @returns {TxStep[]} 注文する手順（在庫が1未満に見えたら、読んだあとは ROLLBACK に変わる）
 */
function stepsOf(scenarioId, side) {
  const lock = TX_SCENARIOS[scenarioId].lock ? ' FOR UPDATE' : '';
  /** @type {TxStep[]} */
  const check =
    scenarioId === 'atomic'
      ? [
          {
            kind: 'update',
            sql: `UPDATE products SET stock = stock - 1 WHERE id = ${PRODUCT_ID} AND stock > 0`,
          },
        ]
      : [
          { kind: 'read', sql: `SELECT stock FROM products WHERE id = ${PRODUCT_ID}${lock}` },
          { kind: 'update', sql: `UPDATE products SET stock = stock - 1 WHERE id = ${PRODUCT_ID}` },
        ];
  return [
    { kind: 'begin', sql: 'BEGIN' },
    ...check,
    {
      kind: 'insert',
      sql: `INSERT INTO orders (customer_id, ordered_at, status) VALUES (${CUSTOMER_IDS[side]}, now(), 'paid')`,
    },
    { kind: 'commit', sql: 'COMMIT' },
  ];
}

const ROLLBACK = Object.freeze({ kind: /** @type {const} */ ('rollback'), sql: 'ROLLBACK' });

/**
 * @param {TxScenarioId} scenarioId
 * @returns {TxState}
 */
export function startTx(scenarioId) {
  if (!Object.hasOwn(TX_SCENARIOS, scenarioId)) {
    throw new Error(`知らない場面です：${scenarioId}`);
  }
  /** @returns {TxSideState} */
  const side = () => ({
    pc: 0,
    seen: null,
    ownStock: null,
    ownOrders: 0,
    abort: false,
    waiting: false,
    ended: null,
  });
  return {
    scenarioId,
    stock: 1,
    orders: 0,
    lockOwner: null,
    sides: { A: side(), B: side() },
    events: [],
  };
}

/**
 * 次に実行する手順（待っている手順を含む）。終わっていれば null。
 * @param {TxState} state
 * @param {TxSide} side
 * @returns {TxStep | null}
 */
export function nextStep(state, side) {
  const s = state.sides[side];
  if (s.ended) return null;
  if (s.abort) return ROLLBACK;
  return stepsOf(state.scenarioId, side)[s.pc] ?? null;
}

/**
 * @param {TxState} state
 * @param {TxSide} side
 */
export function canStep(state, side) {
  const s = state.sides[side];
  return s.ended === null && !s.waiting;
}

/**
 * 鍵がいる手順で、相手が鍵を持っていれば待たせる。持っていなければ鍵を取る。
 * @param {TxState} state - 書き換えてよい写し
 * @param {TxSide} side
 * @param {TxStep} step
 * @returns {boolean} 待たせたか
 */
function waitForLock(state, side, step) {
  const owner = state.lockOwner;
  if (owner !== null && owner !== side) {
    state.sides[side].waiting = true;
    state.events.push({
      side,
      kind: 'wait',
      step: step.kind,
      sql: step.sql,
      note: `待っている（${owner} が行の鍵を持っている）`,
    });
    return true;
  }
  state.lockOwner = side;
  return false;
}

/**
 * 終わった側の鍵を外し、相手が待っていれば、その手順をすぐ進める。
 * @param {TxState} state - 書き換えてよい写し
 * @param {TxSide} side
 * @param {string} reason - COMMIT か ROLLBACK
 */
function releaseLock(state, side, reason) {
  if (state.lockOwner === side) state.lockOwner = null;
  const waiter = other(side);
  if (!state.sides[waiter].waiting) return;
  state.sides[waiter].waiting = false;
  const step = /** @type {TxStep} */ (nextStep(state, waiter));
  run(state, waiter, step, 'resume', `${side} の ${reason} で鍵が外れたので進んだ：`);
}

/**
 * 1つの手順を実行する（鍵がなければ待つ）。
 * @param {TxState} state - 書き換えてよい写し
 * @param {TxSide} side
 * @param {TxStep} step
 * @param {'run' | 'resume'} kind
 * @param {string} prefix - 待ったあとに進んだときの前置き
 */
function run(state, side, step, kind, prefix = '') {
  const s = state.sides[side];
  const lock = TX_SCENARIOS[state.scenarioId].lock;
  /** @param {string} note @param {Partial<TxEvent>} [extra] */
  const log = (note, extra = {}) =>
    state.events.push({
      side,
      kind,
      step: step.kind,
      sql: step.sql,
      note: prefix + note,
      ...extra,
    });

  switch (step.kind) {
    case 'begin':
      s.pc += 1;
      log('トランザクションを始めた');
      return;
    case 'read': {
      if (lock && waitForLock(state, side, step)) return;
      // READ COMMITTED：自分の変更があればそれ、なければ確定した値が見える（相手の COMMIT 前の変更は見えない）
      const seen = s.ownStock ?? state.stock;
      s.seen = seen;
      s.pc += 1;
      s.abort = seen < 1;
      log(
        seen < 1
          ? `在庫 ${seen} が見えた → 在庫がないので、注文をやめる`
          : `在庫 ${seen} が見えた → 在庫があるので、注文する`,
        { seen },
      );
      return;
    }
    case 'update': {
      if (waitForLock(state, side, step)) return;
      // 待ったあとの UPDATE は、相手が確定した最新の行で WHERE と stock - 1 を計算し直す（PostgreSQL と同じ）
      const base = s.ownStock ?? state.stock;
      const resumed = kind === 'resume';
      if (state.scenarioId === 'atomic' && base < 1) {
        // 変えた行がないので、行の鍵は残らない（PostgreSQL は書き換えた行にだけ鍵を持ち続ける）
        if (state.lockOwner === side) state.lockOwner = null;
        s.pc += 1;
        s.abort = true;
        log(
          `${resumed ? '確定した最新の在庫で確かめ直した：' : ''}在庫 ${base} なので条件に合わず、1行も変わらなかった → 注文をやめる`,
        );
        return;
      }
      s.ownStock = base - 1;
      s.pc += 1;
      log(
        `${resumed ? `確定した最新の在庫 ${base} から1減らして、` : ''}在庫を ${s.ownStock} にした（COMMIT まで自分にだけ見える）`,
      );
      return;
    }
    case 'insert':
      s.ownOrders += 1;
      s.pc += 1;
      log('注文を1つ入れた（COMMIT まで自分にだけ見える）');
      return;
    case 'commit':
      if (s.ownStock !== null) state.stock = s.ownStock;
      state.orders += s.ownOrders;
      s.ended = 'commit';
      log(`確定した（DB の在庫 ${state.stock}・注文 ${state.orders}）`);
      releaseLock(state, side, 'COMMIT');
      return;
    case 'rollback':
      s.ownStock = null;
      s.ownOrders = 0;
      s.ended = 'rollback';
      log('取り消した（注文しない）');
      releaseLock(state, side, 'ROLLBACK');
      return;
  }
}

/**
 * side の次の手順を1つ進めた新しい状態。進めない（終わった・待っている）ときは同じ状態を返す。
 * @param {TxState} state
 * @param {TxSide} side
 * @returns {TxState}
 */
export function stepTx(state, side) {
  if (!canStep(state, side)) return state;
  const draft = structuredClone(state);
  run(draft, side, /** @type {TxStep} */ (nextStep(draft, side)), 'run');
  return draft;
}

/**
 * order の順に進める。番の側が進めないときは、もう片方を進める。順が尽きたら、両方が終わるまで A から進める。
 * @param {TxState} state
 * @param {readonly TxSide[]} order
 */
export function autoRun(state, order) {
  let current = state;
  /** @param {TxSide} side */
  const advance = (side) => {
    if (canStep(current, side)) current = stepTx(current, side);
    else if (canStep(current, other(side))) current = stepTx(current, other(side));
  };
  for (const side of order) advance(side);
  while (canStep(current, 'A') || canStep(current, 'B')) advance('A');
  return current;
}

/**
 * 両方が終わったときの結果。在庫がマイナスなら売りすぎ。
 * @param {TxState} state
 * @returns {null | { kind: 'oversold' | 'safe', stock: number, orders: number }}
 */
export function txOutcome(state) {
  if (!state.sides.A.ended || !state.sides.B.ended) return null;
  return {
    kind: state.stock < 0 ? 'oversold' : 'safe',
    stock: state.stock,
    orders: state.orders,
  };
}
