import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  plugins: [react(), yaml()],
  // PGlite の WebAssembly を事前バンドルに巻き込むと読み込みに失敗するため外す
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  worker: {
    format: 'es',
  },
});
