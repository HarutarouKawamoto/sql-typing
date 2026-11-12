/**
 * OS の「動きを減らす」設定がオンか。読めない環境（matchMedia がない）ではオフとみなす。
 * 見える化B は動きそのものが中身なので、オンのときは流さない（ステップ再生・結果の表は Motion の reducedMotion に任せる）。
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
