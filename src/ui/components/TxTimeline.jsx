import { useEffect, useId, useReducer, useRef } from 'react';
import { canStep, nextStep, startTx, TX_SCENARIOS } from '../../core/tx-simulation.js';
import { outcomeText, TX_SIDE_NAMES, txTimelineReducer } from '../state/tx-timeline-state.js';
import styles from './TxTimeline.module.css';

/** @typedef {import('../../core/tx-simulation.js').TxSide} TxSide */

/** @type {readonly TxSide[]} */
const SIDES = ['A', 'B'];

/** タイムラインの行の色分け（待ち・確定・取り消し） */
const EVENT_CLASS = {
  wait: styles.wait,
  commit: styles.commit,
  rollback: styles.rollback,
};

/**
 * 上級の見える化「トランザクションの2列タイムライン」。在庫1個の品に A と B が同時に注文する場面で、
 * 学習者が A と B の SQL を好きな順に1つずつ実行する（PGlite は接続が1つなのでシミュレーション）。
 */
export function TxTimeline() {
  const [state, dispatch] = useReducer(txTimelineReducer, 'unsafe', startTx);
  const outcome = outcomeText(state);
  const last = state.events.at(-1);
  const idBase = useId();
  const buttons = useRef(
    /** @type {Record<TxSide, HTMLButtonElement | null>} */ ({ A: null, B: null }),
  );
  // 押したボタンが押せなくなったら（待つ・終わる）、フォーカスがページの先頭に落ちないよう、もう片方へ移す
  const pressed = useRef(/** @type {TxSide | null} */ (null));
  useEffect(() => {
    const side = pressed.current;
    pressed.current = null;
    if (side === null || canStep(state, side)) return;
    const other = side === 'A' ? 'B' : 'A';
    if (canStep(state, other)) buttons.current[other]?.focus();
  }, [state]);
  return (
    <section
      className={styles.panel}
      aria-label="トランザクションのタイムライン"
      data-testid="tx-timeline"
    >
      <h2 className={styles.heading}>見える化：トランザクションのタイムライン</h2>
      <p className={styles.lead}>
        セールの限定品（products の id 4）の在庫が、残り1個になった場面です。{TX_SIDE_NAMES.A} と{' '}
        {TX_SIDE_NAMES.B} が同時に注文します。下のボタンで、A と B の SQL
        を好きな順に1つずつ実行してください。 PostgreSQL の標準（READ COMMITTED）と同じく、相手が
        COMMIT するまで、相手の変更は見えません（DB は使わないシミュレーションです）。
      </p>

      <div className={styles.scenarios} role="group" aria-label="場面">
        {Object.values(TX_SCENARIOS).map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            aria-pressed={state.scenarioId === scenario.id}
            className={state.scenarioId === scenario.id ? styles.selected : undefined}
            onClick={() => dispatch({ type: 'scenario', id: scenario.id })}
          >
            {scenario.title}
          </button>
        ))}
      </div>

      <dl className={styles.db} data-testid="tx-db">
        <div>
          <dt>DB の在庫（確定）</dt>
          <dd data-testid="tx-stock" className={state.stock < 0 ? styles.bad : undefined}>
            {state.stock}
          </dd>
        </div>
        <div>
          <dt>注文（確定）</dt>
          <dd data-testid="tx-orders">{state.orders}</dd>
        </div>
        <div>
          <dt>行の鍵</dt>
          <dd data-testid="tx-lock">
            {state.lockOwner
              ? `${TX_SIDE_NAMES[state.lockOwner]} が持っている`
              : 'だれも持っていない'}
          </dd>
        </div>
      </dl>

      <div className={styles.head} aria-hidden="true">
        <span />
        <span>{TX_SIDE_NAMES.A}</span>
        <span>{TX_SIDE_NAMES.B}</span>
      </div>
      {state.events.length === 0 && <p className={styles.empty}>まだ何も実行していません</p>}
      <ol className={styles.timeline} aria-label="実行した SQL（時間の順）">
        {state.events.map((event, i) => {
          const tone = event.kind === 'wait' ? EVENT_CLASS.wait : EVENT_CLASS[event.step];
          return (
            <li
              key={i}
              className={styles.row}
              data-testid="tx-event"
              data-side={event.side}
              data-kind={event.kind}
              data-step={event.step}
            >
              <span className={styles.time} aria-hidden="true">
                {i + 1}
              </span>
              <div
                className={`${styles.card} ${tone ?? ''}`}
                style={{ gridColumn: event.side === 'A' ? 2 : 3 }}
              >
                <span className={styles.srOnly}>{TX_SIDE_NAMES[event.side]}：</span>
                <code className={styles.sql}>{event.sql}</code>
                <span className={styles.note}>{event.note}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.next}>
        {SIDES.map((side) => {
          const step = nextStep(state, side);
          const s = state.sides[side];
          const status = s.ended
            ? `終わり（${s.ended === 'commit' ? 'COMMIT' : 'ROLLBACK'}）`
            : s.waiting
              ? '待っている（相手の COMMIT か ROLLBACK まで）'
              : null;
          const sqlId = `${idBase}-${side}-sql`;
          const statusId = `${idBase}-${side}-status`;
          return (
            <div key={side} className={styles.nextSide}>
              <button
                ref={(el) => {
                  buttons.current[side] = el;
                }}
                type="button"
                disabled={!canStep(state, side)}
                aria-describedby={status ? statusId : sqlId}
                onClick={() => {
                  pressed.current = side;
                  dispatch({ type: 'step', side });
                }}
                data-testid={`tx-step-${side}`}
              >
                {TX_SIDE_NAMES[side]} の次を実行
              </button>
              {step && !s.waiting && (
                <code id={sqlId} className={styles.sql}>
                  {step.sql}
                </code>
              )}
              {status && (
                <span id={statusId} className={styles.note}>
                  {status}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={() => dispatch({ type: 'readFirstOrder' })}>
          両方が先に在庫を読む順で、最初から最後まで進める
        </button>
        <button type="button" onClick={() => dispatch({ type: 'reset' })}>
          やり直す
        </button>
      </div>

      {outcome && (
        <p
          className={`${styles.outcome} ${state.stock < 0 ? styles.oversold : styles.safe}`}
          data-testid="tx-outcome"
        >
          {outcome}
        </p>
      )}
      {/* 読み上げ：最後に実行した手順と、終わったら結果 */}
      <p className={styles.srOnly} role="status">
        {last
          ? `${TX_SIDE_NAMES[last.side]}、${last.sql}：${last.note}。`
          : '最初の状態です（在庫 1・注文 0）。'}
        {outcome}
      </p>
    </section>
  );
}
