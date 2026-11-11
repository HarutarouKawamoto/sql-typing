/**
 * なぞり書きの画面で使う、React に依存しない小さな部品（単体テストできるように分けた）。
 */

/**
 * keydown をどう扱うかを決める。
 * - 'exit'：Esc でもどる
 * - 'ime'：日本語入力（変換中・Process）。打った扱いにせず、日本語入力をオフにするよう知らせる
 * - 'skip'：長押しの繰り返し・Ctrl / Meta / Alt との組み合わせ（AltGr で打つ記号は通す）
 * - 'key'：TypingEngine に渡す
 * @param {{ key: string, isComposing?: boolean, repeat?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, getModifierState?: (name: string) => boolean }} event
 * @returns {'exit' | 'ime' | 'skip' | 'key'}
 */
export function classifyKeyEvent(event) {
  // 変換中の Esc は変換の取り消しなので、画面を抜けない
  if (event.isComposing || event.key === 'Process') return 'ime';
  if (event.key === 'Escape') return 'exit';
  if (event.repeat) return 'skip';
  const altGraph = event.getModifierState?.('AltGraph') ?? false;
  if (event.metaKey || ((event.ctrlKey || event.altKey) && !altGraph)) return 'skip';
  return 'key';
}

/**
 * 「前の実行が終わっていなければ、最新の1つだけを予約する」実行の間引き。
 * dispose() のあとは結果を知らせず、予約も実行しない（画面を離れたあとの setState を防ぐ）。
 * @template T
 * @param {(sql: string) => Promise<T>} run
 * @param {(outcome: T) => void} onOutcome - 成功した実行の結果（失敗は捨てる）
 */
export function createLatestOnlyRunner(run, onOutcome) {
  let running = false;
  /** @type {string | null} */
  let pending = null;
  let disposed = false;

  /** @param {string} sql */
  const request = (sql) => {
    if (disposed) return;
    if (running) {
      pending = sql;
      return;
    }
    running = true;
    run(sql)
      .then(
        (outcome) => {
          if (!disposed) onOutcome(outcome);
        },
        () => {
          // Worker が落ちた など。表は前のまま（SqlRunner が次の実行で作り直す）
        },
      )
      .finally(() => {
        running = false;
        const next = pending;
        pending = null;
        if (next !== null) request(next);
      });
  };

  return {
    request,
    dispose: () => {
      disposed = true;
      pending = null;
    },
  };
}
