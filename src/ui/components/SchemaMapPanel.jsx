import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { touchedTables } from '../../core/touched-tables.js';
import { loadSchema, loadTablePreview } from '../../data/schema-info.js';
import { runDbJob } from '../state/db-jobs.js';
import { ResultTable } from './ResultTable.jsx';
import styles from './SchemaMapPanel.module.css';

// React Flow は大きいので、地図を開くまで読み込まない（ふだんは閉じている機能のため）
const SchemaMap = lazy(() =>
  import('./SchemaMap.jsx').then((module) => ({ default: module.SchemaMap })),
);

/**
 * 中身の見出し。「products（全30行のうち先頭20行）」。全部出ているときは「（全3行）」。
 * @param {string} table
 * @param {number | undefined} total
 * @param {number | undefined} shown
 */
function previewTitle(table, total, shown) {
  if (total === undefined || shown === undefined) return table;
  return total > shown
    ? `${table}（全${total}行のうち先頭${shown}行）`
    : `${table}（全${total}行）`;
}

/**
 * 「DBの地図を見る」（開いて見る）。開いたときに DB からテーブル・列・つながりを読んで地図にする
 * （読めたら読み直さない。読めなかったら、閉じて開き直すともう一度読む）。
 * テーブルを選ぶと、その中身（先頭20行と全部の行数）を出す。
 * DB を使う仕事は runDbJob の列に入れる（判定・問題の準備と入り混じらないように）。
 * @param {{
 *   runner: import('../../data/sql-runner/sql-runner.js').SqlRunner,
 *   chapter: { tables: string[], newTables: string[] },
 *   sql?: string,
 *   prepareDb?: () => Promise<void>,
 *   databaseStatus: 'starting' | 'ready' | 'error',
 * }} props
 *   sql：光らせるSQL（なければ光らせない）。
 *   prepareDb：読む前に DB を問題の初期状態にする（モード選択だけ。遊ぶ画面は PlayScreen が準備している）。
 *   databaseStatus：DB の準備の状態（ready になるまで読まない）
 */
export function SchemaMapPanel({ runner, chapter, sql = '', prepareDb, databaseStatus }) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState(
    /** @type {import('../../data/schema-info.js').Schema | { error: string } | null} */ (null),
  );
  const [selected, setSelected] = useState(/** @type {string | null} */ (null));
  const [preview, setPreview] = useState(
    /** @type {{ table: string, result?: import('../../data/sql-runner/sql-runner.js').QueryResult, total?: number, error?: string } | null} */ (
      null
    ),
  );
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const selectedRef = useRef(/** @type {string | null} */ (null));
  const prepareRef = useRef(prepareDb);
  useEffect(() => {
    prepareRef.current = prepareDb;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 開いたときに読む（StrictMode で effect が2回動いても、読んでいる間は読み直さない）
  useEffect(() => {
    if (!open || databaseStatus !== 'ready' || startedRef.current) return;
    startedRef.current = true;
    runDbJob(async () => {
      await prepareRef.current?.();
      return loadSchema(runner);
    }).then(
      (value) => mountedRef.current && setSchema(value),
      (error) => {
        console.error(error);
        // 閉じて開き直したら、もう一度読めるようにする
        startedRef.current = false;
        if (mountedRef.current) setSchema({ error: String(error?.message ?? error) });
      },
    );
  }, [open, databaseStatus, runner]);

  const onToggle = (event) => {
    const isOpen = event.currentTarget.open;
    // 読めなかったあとに開き直したら、エラーの表示を消して読み直す
    if (isOpen && schema && 'error' in schema) setSchema(null);
    setOpen(isOpen);
  };

  const visible = useMemo(() => {
    if (!schema || 'error' in schema) return null;
    // 章で使うテーブルだけ（学習者が作ったテーブル・問題の準備用のテーブルは出さない）。並びは章の順
    const byName = new Map(schema.tables.map((t) => [t.table, t]));
    const tables = chapter.tables
      .filter((name) => byName.has(name))
      .map((name) => byName.get(name));
    const names = new Set(tables.map((t) => t.table));
    const relations = schema.relations.filter((r) => names.has(r.table) && names.has(r.refTable));
    return { tables, relations };
  }, [schema, chapter.tables]);

  // 書くたびに新しい配列にすると地図を描き直すので、光るテーブルが変わったときだけ変える。閉じている間は数えない
  const touchedKey = open ? touchedTables(sql, chapter.tables).join(',') : '';
  const touched = useMemo(() => (touchedKey === '' ? [] : touchedKey.split(',')), [touchedKey]);

  const select = (table) => {
    selectedRef.current = table;
    setSelected(table);
    setPreview({ table });
    runDbJob(() => loadTablePreview(runner, table)).then(
      (value) => {
        // 読んでいる間に別のテーブルを選んだら、古い方は出さない
        if (mountedRef.current && selectedRef.current === table) setPreview({ table, ...value });
      },
      (error) => {
        console.error(error);
        if (mountedRef.current && selectedRef.current === table) {
          setPreview({ table, error: String(error?.message ?? error) });
        }
      },
    );
  };

  return (
    <details className={styles.panel} data-testid="schema-map" onToggle={onToggle}>
      <summary className={styles.summary}>DBの地図を見る</summary>
      <p className={styles.status} role="status">
        {open && databaseStatus === 'starting' && 'データベースを準備しています…'}
        {open && databaseStatus === 'ready' && schema === null && '地図を読んでいます…'}
      </p>
      {open && databaseStatus === 'error' && (
        <p className={styles.error} role="alert">
          データベースを起動できなかったため、地図を出せません。ページを読み込み直してください。
        </p>
      )}
      {schema && 'error' in schema && (
        <p className={styles.error} role="alert">
          DBの地図を読めませんでした（{schema.error}）。閉じて開き直すと、もう一度読みます。
        </p>
      )}
      {open && visible && (
        <>
          <p className={styles.legend}>
            {touched.length > 0
              ? `青い箱：このSQLが使っているテーブル（${touched.join('・')}）`
              : 'テーブルを押すと、中身（先頭20行）を見られます'}
          </p>
          <Suspense fallback={<p className={styles.status}>地図を描いています…</p>}>
            <SchemaMap
              tables={visible.tables}
              relations={visible.relations}
              newTables={chapter.newTables}
              touched={touched}
              selected={selected}
              onSelect={select}
            />
          </Suspense>
          <div className={styles.buttons}>
            中身を見る：
            {visible.tables.map(({ table }) => (
              <button
                key={table}
                type="button"
                className={styles.tableButton}
                aria-current={selected === table ? 'true' : undefined}
                onClick={() => select(table)}
                data-testid={`schema-open-${table}`}
              >
                {table}
              </button>
            ))}
          </div>
          {/* 選んだテーブルが変わったことを読み上げで知らせる */}
          <section
            className={styles.preview}
            aria-label="テーブルの中身"
            aria-live="polite"
            data-testid="schema-preview"
          >
            {preview && (
              <>
                <h3 className={styles.previewTitle}>
                  {previewTitle(preview.table, preview.total, preview.result?.rows.length)}
                </h3>
                {preview.error ? (
                  <p className={styles.error} role="alert">
                    中身を読めませんでした（{preview.error}）
                  </p>
                ) : (
                  <ResultTable result={preview.result ?? null} emptyMessage="読んでいます…" />
                )}
              </>
            )}
          </section>
        </>
      )}
    </details>
  );
}
