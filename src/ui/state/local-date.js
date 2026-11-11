/**
 * 'YYYY-MM-DD'（その人のタイムゾーンの日付。学習記録の日ごとの記録に使う）。
 * @param {Date} date
 * @returns {string}
 */
export function localDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
