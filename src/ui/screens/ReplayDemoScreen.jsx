import { useState } from 'react';
import { StepPlayer } from '../components/StepPlayer.jsx';
import styles from './ReplayDemoScreen.module.css';

/**
 * ステップ再生の見本（`/?demo` で開く。入口からはリンクしない）。
 * 1問目（SELECT * FROM products）には消える行・まとまる行がないので、印（赤・黄・灰色）の見た目を
 * 目と E2E で確かめるために、初級・中級の集計の形のSQLを並べておく。初期データは初級（products 30行）。
 * `?demo&speed=0.2` のように再生の速さも変えられる（E2E で印の場面を長く見せるため）。
 */
export const DEMO_SAMPLES = [
  {
    title: 'WHERE：条件に合わない行が消える・使わない列が消える',
    sql: 'SELECT name, price FROM products WHERE price >= 1000',
  },
  { title: 'AS：列の名前が変わる', sql: 'SELECT name AS item, price FROM products' },
  {
    title: 'DISTINCT：同じ値の行がまとまる・並び替わる',
    sql: 'SELECT DISTINCT category FROM products ORDER BY category',
  },
  {
    title: 'ORDER BY と LIMIT：並び替わって、後ろの行が消える',
    sql: 'SELECT name, price FROM products ORDER BY price DESC LIMIT 5',
  },
  {
    title: 'AND：2つの条件の両方に合う行だけが残る',
    sql: "SELECT name, stock FROM products WHERE category = 'kitchen' AND stock < 5",
  },
  {
    title: 'GROUP BY：同じグループの行が寄り、集計で1行にまとまる',
    sql: 'SELECT supplier, count(*) AS items FROM products GROUP BY supplier',
  },
  {
    title: 'HAVING：条件に合わないグループが消える',
    sql:
      'SELECT category, sum(stock) AS total FROM products WHERE price >= 1000 ' +
      'GROUP BY category HAVING count(*) >= 3 ORDER BY total DESC',
  },
  {
    title: '集計関数だけ：全部の行が1行にまとまる',
    sql: 'SELECT count(*) AS items, max(price) AS top FROM products',
  },
];

/**
 * @param {{
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   speed: number,
 *   onExit: () => void,
 * }} props
 */
export function ReplayDemoScreen({ runner, speed, onExit }) {
  const [selected, setSelected] = useState(0);
  const sample = DEMO_SAMPLES[selected];
  return (
    <div className={styles.demo}>
      <header className={styles.bar}>
        <h1 className={styles.title}>ステップ再生の見本</h1>
        <button type="button" onClick={onExit}>
          入口へもどる
        </button>
      </header>
      <ul className={styles.samples}>
        {DEMO_SAMPLES.map((item, index) => (
          <li key={item.sql}>
            <button
              type="button"
              aria-pressed={index === selected}
              className={index === selected ? styles.selected : undefined}
              onClick={() => setSelected(index)}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
      {/* SQLを変えたら段階を作り直す */}
      <StepPlayer key={sample.sql} sql={sample.sql} runner={runner} speed={speed} />
    </div>
  );
}
