import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// ビルド済みのもの（vite preview）を相手にする。npm run test:e2e が先に build する
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  // 1つのテストの上限。各テストでブラウザの中の PGlite を起動する（並べて流すと PC が忙しく、起動だけで
  // 20秒を超えることがある）。テストの中の起動待ち（30秒）より長くして、起動の遅さだけで落ちないようにする
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
