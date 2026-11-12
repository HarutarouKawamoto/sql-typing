import { Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { layoutTables } from '../state/schema-layout.js';
import styles from './SchemaMap.module.css';

/**
 * テーブル1つの箱。名前（新しいテーブルには NEW、使っているテーブルには「使用中」）、列名・型・主キー（PK）・外部キー（FK）の印。
 * @param {{ data: {
 *   table: string,
 *   columns: import('../../data/schema-info.js').SchemaColumn[],
 *   foreignKeys: Set<string>,
 *   isNew: boolean,
 *   touched: boolean,
 *   selected: boolean,
 * } }} props
 */
function TableNode({ data }) {
  const className = [
    styles.node,
    data.touched ? styles.touched : '',
    data.selected ? styles.selected : '',
  ].join(' ');
  return (
    <div
      className={className}
      data-testid={`schema-table-${data.table}`}
      data-touched={data.touched ? 'true' : 'false'}
      data-new={data.isNew ? 'true' : 'false'}
    >
      {/* 線は親（指される側）の右から、子（指す側）の左へ流す */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={styles.handle}
      />
      <div className={styles.header}>
        <span className={styles.tableName}>{data.table}</span>
        {data.touched && <span className={styles.usedMark}>使用中</span>}
        {data.isNew && <span className={styles.newMark}>NEW</span>}
      </div>
      <ul className={styles.columns}>
        {data.columns.map((column) => (
          <li key={column.name} className={styles.column}>
            <span className={styles.columnName}>{column.name}</span>
            {column.primaryKey && <span className={styles.keyMark}>PK</span>}
            {data.foreignKeys.has(column.name) && <span className={styles.keyMark}>FK</span>}
            <span className={styles.type}>{column.type}</span>
          </li>
        ))}
      </ul>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={styles.handle}
      />
    </div>
  );
}

// 描くたびに作り直すと React Flow が警告するので、部品の外で1回だけ作る
const NODE_TYPES = { table: TableNode };

/**
 * DBの地図（React Flow）。テーブルの箱と、外部キーのつながりの線。親（指される側）を左、子を右に置く。
 * 触っているテーブルを青で光らせ、両方のテーブルを触っているつながりの線も光らせる。
 * ページのスクロール・打つキーを奪わないよう、ホイールの拡大とキーの操作は切る。
 * 図は読み上げから隠し、同じ中身を文の一覧で読み上げに出す（図の中をキーで動いても何もできないため）。
 * @param {{
 *   tables: import('../../data/schema-info.js').SchemaTable[],
 *   relations: import('../../data/schema-info.js').SchemaRelation[],
 *   newTables: string[],
 *   touched: string[],
 *   selected: string | null,
 *   onSelect: (table: string) => void,
 * }} props
 */
export function SchemaMap({ tables, relations, newTables, touched, selected, onSelect }) {
  const nodes = useMemo(() => {
    const positions = layoutTables(tables, relations);
    return tables.map(({ table, columns }) => ({
      id: table,
      type: 'table',
      position: positions[table],
      draggable: false,
      data: {
        table,
        columns,
        foreignKeys: new Set(relations.filter((r) => r.table === table).map((r) => r.column)),
        isNew: newTables.includes(table),
        touched: touched.includes(table),
        selected: selected === table,
      },
    }));
  }, [tables, relations, newTables, touched, selected]);

  const edges = useMemo(
    () =>
      relations.map((relation) => {
        const lit = touched.includes(relation.table) && touched.includes(relation.refTable);
        return {
          id: `${relation.table}.${relation.column}->${relation.refTable}.${relation.refColumn}`,
          source: relation.refTable,
          target: relation.table,
          type: 'smoothstep',
          className: lit ? styles.edgeLit : styles.edge,
          focusable: false,
        };
      }),
    [relations, touched],
  );

  return (
    <>
      <div className={styles.map} data-testid="schema-map-canvas" aria-hidden="true">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodeClick={(_, node) => onSelect(node.id)}
          fitView
          colorMode="system"
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          disableKeyboardA11y
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          zoomActivationKeyCode={null}
          panActivationKeyCode={null}
          minZoom={0.3}
          maxZoom={1.5}
        />
      </div>
      <div className={styles.srOnly}>
        <p>DBの地図。テーブル {tables.length} 個。</p>
        <ul>
          {tables.map(({ table, columns }) => (
            <li key={table}>
              {table}
              {touched.includes(table) ? '（このSQLが使っている）' : ''}
              {newTables.includes(table) ? '（新しいテーブル）' : ''}：
              {columns.map((c) => `${c.name} ${c.type}${c.primaryKey ? ' 主キー' : ''}`).join('、')}
            </li>
          ))}
        </ul>
        {relations.length > 0 && (
          <ul>
            {relations.map((r) => (
              <li key={`${r.table}.${r.column}`}>
                つながり：{r.table}.{r.column} は {r.refTable}.{r.refColumn} を指す
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
