import { useCallback, useEffect, useReducer, useRef } from 'react';
import { createReplayState, replayReducer } from './step-replay-machine.js';
import { needsMark, stepTiming } from './step-replay-timing.js';

/**
 * ステップ再生の進み方を、タイマーと React につなぐ。進み方の決まりは step-replay-machine.js（単体テストあり）。
 * - 印の場面は、止めていても少し待ってから変化の場面に進む（1ステップ進めたときも、消える行が赤くなってから消える）
 * - 自動再生では、変化を見せたあと少し止まってから次の段階へ。最後の段階で止まる
 * - 最後の段階の変化を見せたら onFinished を1回だけ呼ぶ
 * steps が変わるときは、このフックを使う部品ごと作り直す（key を付ける）。
 *
 * @param {{ steps: import('../../core/stepper/index.js').Step[], speed: number, onFinished?: () => void }} options
 */
export function useStepReplay({ steps, speed, onFinished }) {
  const [state, dispatch] = useReducer(replayReducer, steps, (s) =>
    createReplayState(s.map((step) => needsMark(step))),
  );
  const last = steps.length - 1;
  const index = Math.min(state.index, last);
  const step = steps[index];

  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  // 印の場面 → 変化の場面
  useEffect(() => {
    if (!step || state.phase !== 'mark') return undefined;
    const timer = setTimeout(
      () => dispatch({ type: 'markDone' }),
      stepTiming(step.label, speed).markMs,
    );
    return () => clearTimeout(timer);
  }, [step, state.phase, speed]);

  // 自動再生：変化を見せたあと少し止まってから次へ（最後で止まるのは reducer が決める）
  useEffect(() => {
    if (!step || !state.playing || state.phase !== 'apply') return undefined;
    const { applyMs, holdMs } = stepTiming(step.label, speed);
    const timer = setTimeout(() => dispatch({ type: 'advance' }), applyMs + holdMs);
    return () => clearTimeout(timer);
  }, [step, state.playing, state.phase, speed]);

  // 最後の段階の変化まで見たら知らせる（1回だけ）
  useEffect(() => {
    if (!step || index !== last || state.phase !== 'apply' || finishedRef.current) return;
    finishedRef.current = true;
    onFinishedRef.current?.();
  }, [step, index, last, state.phase]);

  return {
    index,
    phase: state.phase,
    playing: state.playing,
    step,
    previous: index > 0 ? steps[index - 1] : null,
    next: useCallback(() => dispatch({ type: 'next' }), []),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    first: useCallback(() => dispatch({ type: 'first' }), []),
    togglePlay: useCallback(() => dispatch({ type: 'toggle' }), []),
  };
}
