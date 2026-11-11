import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/core/ は学習のルールそのものなので、行カバレッジ 90% を下回ったら npm run check を失敗させる
    // （docs/architecture.md のテスト戦略）
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.js'],
      reporter: ['text-summary'],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          environment: 'node',
          // PGlite の起動を含むテストが入るため長めにする。起動は beforeAll でもするので、hook も同じ長さに
          // （ファイルごとに PGlite を並べて起動するので、PC が忙しいと既定の 10 秒を超えることがある）
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
