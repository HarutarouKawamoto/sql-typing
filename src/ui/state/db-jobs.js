/**
 * DB を使う「ひとまとまりの仕事」を1つずつ流す（React に依存しない。単体テストする）。
 * SqlRunner は1回の呼び出しごとには順に動くが、判定（reset → 実行 → reset）・問題の準備（prepare）・
 * 正解の結果づくり・ステップ再生の段階づくりは何回も呼ぶ。そのあいだに別の仕事の reset や実行が入ると、
 * 書き換え系の正解の結果が元のままになる・古い判定が新しい問題の DB を壊す、などが起きる。
 * 画面を離れたあとに残った仕事も、終わるまで次の仕事を待たせる。
 */

/**
 * @returns {<T>(job: () => T | Promise<T>) => Promise<T>}
 */
export function createExclusive() {
  /** @type {Promise<unknown>} */
  let tail = Promise.resolve();
  return (job) => {
    // 前の仕事の成否に関係なく、次の仕事を始める（失敗はその仕事を呼んだ側にだけ返す）
    const result = tail.then(
      () => job(),
      () => job(),
    );
    tail = result.catch(() => undefined);
    return result;
  };
}

/** アプリに1つだけの、DB の仕事の列（SqlRunner がアプリに1つだけなので、列も1つ） */
export const runDbJob = createExclusive();
