import { useEffect, useState } from 'react';
import { loadSeed } from '../../data/seed-loader.js';
import { runDbJob } from '../state/db-jobs.js';
import { IndexRacePanel } from '../components/IndexRacePanel.jsx';
import { PlanTreePanel } from '../components/PlanTreePanel.jsx';
import { StepPlayer } from '../components/StepPlayer.jsx';
import { TxTimeline } from '../components/TxTimeline.jsx';
import styles from './ReplayDemoScreen.module.css';

/**
 * ステップ再生の見本（`/?demo` で開く。入口からはリンクしない）。
 * 1問目（SELECT * FROM products）には消える行・まとまる行がないので、印（赤・黄・灰色）の見た目を
 * 目と E2E で確かめるために、初級・中級（集計・JOIN）の形のSQLを並べておく。
 * 初期データは中級（products は初級と同じ30行に、customers・orders・order_items を足したもの）。
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
  {
    title: 'JOIN：注文に顧客がつながって1行になる',
    sql: 'SELECT o.id, c.name, o.status FROM orders o JOIN customers c ON c.id = o.customer_id',
  },
  {
    title: 'LEFT JOIN：注文のない顧客は右の列が NULL になる',
    sql: 'SELECT c.name, o.id AS order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id',
  },
  {
    title: 'JOIN と GROUP BY：地域ごとの売上',
    sql:
      'SELECT c.region, sum(i.quantity * i.unit_price) AS sales FROM orders o ' +
      'JOIN customers c ON c.id = o.customer_id JOIN order_items i ON i.order_id = o.id ' +
      "WHERE o.status <> 'cancelled' GROUP BY c.region ORDER BY sales DESC",
  },
  {
    title: '上級：インデックスで1行を探す',
    kind: 'index',
    query: "SELECT * FROM access_logs WHERE session_id = 's-31337'",
    changeSql: 'CREATE INDEX ON access_logs (session_id)',
  },
  {
    title: '上級：実行計画の木（JOIN と集計）',
    kind: 'plan',
    query:
      'SELECT c.region, count(*) AS visits FROM access_logs l ' +
      'JOIN customers c ON c.id = l.customer_id GROUP BY c.region ORDER BY visits DESC',
  },
  {
    // 外の行が0行なので、行ごとに動く副問い合わせは1回も実行されない（薄く描く節の見本）
    title: '上級：実行計画の木（実行されなかった節）',
    kind: 'plan',
    query:
      'SELECT c.name, (SELECT count(*) FROM orders o WHERE o.customer_id = c.id) AS orders ' +
      'FROM customers c WHERE c.id < 0',
  },
  { title: '上級：トランザクション（在庫1個に2人が注文）', kind: 'transaction' },
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
  // 上級の初期データで DB を準備する（JOIN・インデックスの見本のため。products・中級のテーブルは同じなので、初級・中級の見本もそのまま）
  const [prepared, setPrepared] = useState(
    /** @type {'loading' | 'ready' | 'error'} */ ('loading'),
  );
  useEffect(() => {
    let active = true;
    runDbJob(async () =>
      runner.prepare({ seedSql: await loadSeed('advanced.sql'), extraSql: '' }),
    ).then(
      () => active && setPrepared('ready'),
      (error) => {
        console.error(error);
        if (active) setPrepared('error');
      },
    );
    return () => {
      active = false;
    };
  }, [runner]);
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
          <li key={item.title}>
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
      {prepared === 'loading' && <p role="status">初期データを準備しています…</p>}
      {prepared === 'error' && <p role="alert">初期データを準備できませんでした</p>}
      {/* SQLを変えたら段階を作り直す */}
      {prepared === 'ready' &&
        (sample.kind === 'index' ? (
          <IndexRacePanel
            key={sample.title}
            runner={runner}
            query={sample.query}
            changeSql={sample.changeSql}
          />
        ) : sample.kind === 'plan' ? (
          <PlanTreePanel key={sample.title} runner={runner} query={sample.query} />
        ) : sample.kind === 'transaction' ? (
          <TxTimeline />
        ) : (
          <StepPlayer key={sample.sql} sql={sample.sql} runner={runner} speed={speed} />
        ))}
    </div>
  );
}
