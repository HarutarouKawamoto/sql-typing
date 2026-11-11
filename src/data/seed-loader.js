/**
 * data/seeds/ の章の初期データ（SQL）を、ビルドに同梱した文字列として読む。
 * ファイルは必要になったときに読み込む（章ごとに別のファイルに分かれる）。
 */
const SEEDS = import.meta.glob('/data/seeds/*.sql', { query: '?raw', import: 'default' });

/**
 * @param {string} seedFile - chapters.yaml の seed（例 'beginner.sql'）
 * @returns {Promise<string>}
 */
export async function loadSeed(seedFile) {
  const load = SEEDS[`/data/seeds/${seedFile}`];
  if (!load) throw new Error(`初期データ data/seeds/${seedFile} がありません`);
  return /** @type {string} */ (await load());
}
