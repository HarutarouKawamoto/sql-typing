import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

/**
 * 公開する HTML に Content Security Policy を入れる（docs/architecture.md のセキュリティ）。
 * GitHub Pages はレスポンスのヘッダーを足せないので、<meta> で入れる。
 * 開発サーバーはページの中に直接スクリプトを書き込む（React の再読み込み）ので、ビルドのときだけ入れる
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  // ビルドは小さな書体のファイル（4KB 未満）を data: で CSS に埋め込む。同梱の書体なので、書体だけ data: を許す
  "font-src 'self' data:",
].join('; ');

const contentSecurityPolicy = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
};

export default defineConfig({
  // GitHub Pages ではサイトが https://<アカウント>.github.io/sql-typing/ のサブフォルダに置かれる。
  // 相対パスにして、置き場所（サブフォルダ・手元の vite preview のルート）に関係なく動くようにする
  base: './',
  plugins: [react(), yaml(), contentSecurityPolicy],
  // PGlite の WebAssembly を事前バンドルに巻き込むと読み込みに失敗するため外す
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  worker: {
    format: 'es',
  },
});
