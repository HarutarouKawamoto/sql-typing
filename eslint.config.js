import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/*
 * 依存のルール（docs/architecture.md）：
 *   ui → core / data → schema の向きだけ許す。core と data はお互いを import しない。
 * レイヤーをまたぐ禁止は、レイヤーごとに no-restricted-imports で止める。
 *
 * 注意：フラット設定では、同じルール（例 no-restricted-globals）を後のブロックに書くと
 * 前のブロックの指定は「足される」のではなく「置き換わる」。
 * そのため、共通の禁止は下の定数にまとめ、レイヤーごとのブロックでも必ず一緒に並べる。
 */

const LAYER_MESSAGE = 'レイヤーの依存のルール違反（docs/architecture.md の「依存のルール」）';

/** @param {({ group: string[] } | { regex: string })[]} patterns */
const restrictImports = (patterns) => [
  'error',
  { patterns: patterns.map((p) => ({ message: LAYER_MESSAGE, ...p })) },
];

/** @param {string} layer */
const layerGlobs = (layer) => [`**/${layer}`, `**/${layer}/**`];

/** @param {string[]} names @param {string} message */
const globalsWithMessage = (names, message) => names.map((name) => ({ name, message }));

// 外部に送る処理は書かない。どうしても必要なら eslint-disable-next-line と理由のコメントを書く
const NETWORK_GLOBALS = globalsWithMessage(
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'],
  '外部に送る処理は書かない。必要なら eslint-disable と理由のコメントを書く（docs/architecture.md）',
);
const STORAGE_GLOBALS = globalsWithMessage(
  ['localStorage', 'sessionStorage', 'indexedDB'],
  '保存は src/data/ を通す（画面・コアから直接触らない）',
);
const DOM_GLOBALS = globalsWithMessage(
  ['document', 'window', 'navigator', 'Worker'],
  'コアレイヤーは DOM・ブラウザの機能を使わない（純粋な関数にする）',
);

const NO_DANGEROUS_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'dangerouslySetInnerHTML は使わない（docs/architecture.md の「入力検証」）',
};

const PGLITE_IMPORT = {
  group: ['@electric-sql/pglite', '@electric-sql/pglite/*'],
  message: 'PGlite は src/data/ の SqlRunner を通して使う',
};

export default [
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      '.steering/',
      'docs/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // JSX の中だけで使うコンポーネント名（App など PascalCase）を「使っていない」と誤って報告しないため。
      // UPPER_SNAKE_CASE の定数は対象外にして、使っていない定数は見つけられるようにする
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^(_|[A-Z][a-z])', argsIgnorePattern: '^_' },
      ],
    },
  },

  // ---- アプリのコード（ブラウザ）：全レイヤー共通 ----
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': ['error', NO_DANGEROUS_HTML],
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
    },
  },

  // ---- 画面レイヤー ----
  {
    files: ['src/ui/**/*.{js,jsx}', 'src/main.jsx'],
    rules: {
      'no-restricted-imports': restrictImports([PGLITE_IMPORT]),
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
    },
  },

  // ---- コアレイヤー ----
  {
    files: ['src/core/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        { group: [...layerGlobs('ui'), ...layerGlobs('data')] },
        {
          group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
          message: 'コアレイヤーは React に依存しない',
        },
        {
          ...PGLITE_IMPORT,
          message: 'コアレイヤーは PGlite に依存しない（SqlRunner は引数で受け取る）',
        },
      ]),
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS, ...DOM_GLOBALS],
      // 乱数と現在時刻は引数で受け取る（テストで固定できるように。docs/architecture.md）
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '乱数は randomFn を引数で受け取る' },
        { object: 'Date', property: 'now', message: '現在時刻は now を引数で受け取る' },
        { object: 'performance', property: 'now', message: '現在時刻は now を引数で受け取る' },
        ...['localStorage', 'sessionStorage', 'document', 'window', 'fetch'].map((property) => ({
          object: 'globalThis',
          property,
          message: 'コアレイヤーは DOM・保存・通信を使わない',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        NO_DANGEROUS_HTML,
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: '現在時刻は now を引数で受け取る（new Date() を中で呼ばない）',
        },
        {
          selector: "CallExpression[callee.name='Date']",
          message: '現在時刻は now を引数で受け取る（Date() を中で呼ばない）',
        },
      ],
    },
  },

  // ---- データレイヤー ----
  {
    files: ['src/data/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        { group: [...layerGlobs('ui'), ...layerGlobs('core')] },
        {
          group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
          message: 'データレイヤーは React に依存しない',
        },
      ]),
    },
  },

  // ---- 共通の決まり（スキーマ） ----
  {
    files: ['src/schema/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': restrictImports([
        { group: [...layerGlobs('ui'), ...layerGlobs('core'), ...layerGlobs('data')] },
        {
          // zod と、同じフォルダの中（./xxx。./../ は除く）だけを許す。
          // group の ! による除外は ./ に効かないため正規表現で書く
          regex: '^(?!zod$|\\./(?!\\.))',
          message: 'src/schema/ は zod と同じフォルダの中だけを import する',
        },
      ]),
    },
  },

  // ---- 設定・スクリプト・テスト（Node） ----
  {
    files: ['*.config.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
];
