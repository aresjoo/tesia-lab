import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.TETH_E2E_PORT ?? 4175)
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('TETH_E2E_PORT must be an integer between 1024 and 65535')
}
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: process.env.CI ? 180_000 : 120_000,
  expect: { timeout: process.env.CI ? 20_000 : 10_000 },
  workers: process.env.CI ? 1 : 6,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    // env 옵션은 Windows cmd 에도 통한다 — POSIX 한정 `VAR=x cmd` 접두 구문을 쓰지 않는다.
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: { VITE_E2E_FAST: 'true' },
    url: baseURL,
    reuseExistingServer: false,
  },
})
