/**
 * localStorage の作り物（getItem / setItem / removeItem だけ）。
 * failOnSet: true にすると setItem で例外を投げる（容量いっぱい・プライベートモードの真似）。
 * @param {{ initial?: Record<string, string>, failOnSet?: boolean }} [options]
 */
export function createMemoryStorage({ initial = {}, failOnSet = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failOnSet) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
