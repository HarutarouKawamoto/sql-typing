import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SqlRunner } from '../../src/data/sql-runner/sql-runner.js';
import { createNodeBackend } from '../../src/data/sql-runner/node-backend.js';

/**
 * テスト用の SqlRunner（Node 版の PGlite）を作る。
 * PGlite の起動は1秒ほどかかるので、テストファイルの中で使い回す（beforeAll で作る）。
 * @param {{ timeoutMs?: number }} [options]
 * @returns {SqlRunner}
 */
export function makeNodeRunner(options = {}) {
  return new SqlRunner({ createBackend: createNodeBackend, ...options });
}

/**
 * data/seeds/ の初期データを読む。
 * @param {string} seedFile - 'beginner.sql' など
 * @returns {string}
 */
export function readSeed(seedFile) {
  return readFileSync(
    fileURLToPath(new URL(`../../data/seeds/${seedFile}`, import.meta.url)),
    'utf8',
  );
}
