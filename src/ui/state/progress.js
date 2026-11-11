import { useCallback, useRef, useState } from 'react';
import {
  getBrowserStorage,
  loadProgress,
  recordPlay,
  saveProgress,
} from '../../data/progress-store.js';

/**
 * 学習記録を読み、遊んだ結果を記録して保存する。
 * - recoveredNotice：記録が壊れていて初期化した（1回だけ知らせる）
 * - saveFailed：この環境では記録が保存されない（localStorage が使えない・書けない）
 */
export function useProgress() {
  const [initial] = useState(() => {
    const { storage, persistent } = getBrowserStorage();
    const { progress, recovered } = loadProgress(storage);
    return { storage, persistent, progress, recovered };
  });
  const [progress, setProgress] = useState(initial.progress);
  // record() が続けて呼ばれても前の記録に足せるよう、今の記録を ref でも持つ
  const progressRef = useRef(initial.progress);
  const [recoveredNotice, setRecoveredNotice] = useState(initial.recovered);
  const [saveFailed, setSaveFailed] = useState(!initial.persistent);

  /**
   * @param {Parameters<typeof recordPlay>[1]} play
   * @returns {import('../../schema/progress-schema.js').Progress} 記録したあとの学習記録
   */
  const record = useCallback(
    (play) => {
      const next = recordPlay(progressRef.current, play);
      progressRef.current = next;
      setProgress(next);
      if (!saveProgress(initial.storage, next).ok) setSaveFailed(true);
      return next;
    },
    [initial.storage],
  );

  const dismissRecoveredNotice = useCallback(() => setRecoveredNotice(false), []);

  return { progress, record, recoveredNotice, dismissRecoveredNotice, saveFailed };
}
