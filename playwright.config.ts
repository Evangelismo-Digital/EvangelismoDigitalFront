import { defineConfig, devices } from '@playwright/test'

// Its own port: a dev server already running on 5173 (pointed at a real backend) must never be reused here.
const PORT = 5199
const baseURL = `http://localhost:${PORT}`

// Fixed, fake endpoints: every backend and Web3Forms call is mocked with page.route in the specs.
export const E2E_API_URL = 'http://api.e2e.test'
export const E2E_WEB3FORMS_KEY = 'e2e-web3forms-key'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CONFIG_API_URL: E2E_API_URL,
      CONFIG_WEB3FORMS_ACCESS_KEY: E2E_WEB3FORMS_KEY
    }
  }
})
