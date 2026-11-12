import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './reduced-motion.js';

/**
 * 0 から target まで、ms ミリ秒かけて数を増やす（インデックスの比較の、読んだ行のカウンター）。
 * 動きを減らす設定なら、すぐ target にする。target が変わったら 0 から数え直す。
 * @param {number} target
 * @param {number} ms
 * @returns {number}
 */
export function useCountUp(target, ms) {
  // 動きを減らす設定なら、最初の1フレームも0を見せない
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = prefersReducedMotion() ? 1 : Math.min(1, (now - start) / ms);
      // 最後はゆっくり（大きい数が目で追えるように）
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}
