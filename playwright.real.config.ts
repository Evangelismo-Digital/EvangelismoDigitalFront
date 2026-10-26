import { defineConfig, devices } from '@playwright/test'
import { refusedConsentState } from './e2e/consentState'

// End-to-end tests against a running backend (opt-in: `npm run test:e2e:real`).
// Port 5173 matches the backend's default FRONTEND_URL, so CORS allows the dev server.
const PORT = 5173
export const REAL_API_URL = process.env.API_BASE_URL ?? 'http://localhost:3333'

export default defineConfig({
  testDir: './e2e-real',
  outputDir: './test-results-real',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-real' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: refusedConsentState
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CONFIG_API_URL: REAL_API_URL,
      CONFIG_WEB3FORMS_ACCESS_KEY: 'e2e-real-web3forms-key',
      // The dev server proxies /analytics to the same backend; the secret comes from .env (ANALYTICS_PROXY_SECRET).
      ANALYTICS_API_URL: REAL_API_URL
    }
  }
})
