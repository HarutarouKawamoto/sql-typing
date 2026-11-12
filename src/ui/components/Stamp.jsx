import styles from './Stamp.module.css';

/** モードごとの判子の傾き（手で押したように少しずつ違う。毎回同じになるよう決めておく） */
const TILTS = { 1: -9, 2: 6, 3: -4, 4: 8 };

/**
 * クリアの判子（朱の丸に「済」）。見た目だけなので読み上げない（読み上げは置く側の文で伝える）。
 * @param {{ mode: '1' | '2' | '3' | '4', size?: 'small' | 'large', pressed?: boolean }} props
 *   pressed：たった今押したときだけ、押す動きをする（クリアの結果の画面）
 */
export function Stamp({ mode, size = 'small', pressed = false }) {
  const className = [
    styles.stamp,
    size === 'large' ? styles.large : '',
    pressed ? styles.pressed : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={className} style={{ '--tilt': `${TILTS[mode]}deg` }} aria-hidden="true">
      済
    </span>
  );
}
