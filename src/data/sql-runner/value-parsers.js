/**
 * PGlite が返す値の型ごとの変換。Worker 版と Node 版で同じものを使う。
 * PGlite の query() の options.parsers に渡す（キーは PostgreSQL の型の OID）。
 */

export const PG_TYPE = Object.freeze({
  INT8: 20,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  NUMERIC: 1700,
});

/**
 * NUMERIC（'750.0000000000000000' など）を数値にする。判定で 1000 と 1000.0 を同じに扱うため。
 * 'NaN' など数値にできないものは文字列のまま返す。
 * @param {string} text
 * @returns {number | string}
 */
export function parseNumeric(text) {
  const value = Number(text);
  return Number.isFinite(value) ? value : text;
}

/**
 * BIGINT（count(*) など）を数値にする。安全に扱える範囲を超えるときは文字列のまま返す。
 * @param {string} text
 * @returns {number | string}
 */
export function parseInt8(text) {
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : text;
}

/**
 * 日付・時刻は文字列のまま返す（Date にするとタイムゾーンで日付がずれて見えるため）。
 * @param {string} text
 * @returns {string}
 */
export function keepText(text) {
  return text;
}

export const VALUE_PARSERS = Object.freeze({
  [PG_TYPE.INT8]: parseInt8,
  [PG_TYPE.DATE]: keepText,
  [PG_TYPE.TIMESTAMP]: keepText,
  [PG_TYPE.TIMESTAMPTZ]: keepText,
  [PG_TYPE.NUMERIC]: parseNumeric,
});
