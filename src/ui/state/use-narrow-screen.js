import { useEffect, useState } from 'react';

/** 768px 未満は遊べない（PRD 機能13。キーボードで打つ前提のため） */
const NARROW = '(max-width: 767px)';

/**
 * 画面の幅が狭い（768px 未満）か。幅が変わったら描き直す。
 * @returns {boolean}
 */
export function useNarrowScreen() {
  const [narrow, setNarrow] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    onChange();
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
