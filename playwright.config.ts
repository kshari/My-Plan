import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// Load .env.local for E2E test credentials
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: path.resolve(__dirname, '.env.local') })

/**
 * Playwright E2E Test Configuration for Retirement Portfolio App
 *
 * Usage:
 *   npx playwright test                  # Run all E2E tests
 *   npx playwright test --headed         # Run with visible browser
 *   npx playwright test --ui             # Run with Playwright UI
 *   npx playwright test --debug          # Debug mode (step through)
 *   npx playwright test e2e/retirement   # Run retirement tests only
 *
 * Before first run:
 *   1. Copy .env.local.example to .env.local with your Supabase creds
 *   2. Add E2E_TEST_EMAIL and E2E_TEST_PASSWORD to .env.local
 *   3. Make sure the dev server is running: npm run dev
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially (auth-dependent flows)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for sequential auth flows
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Setup project: authenticates and saves session state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Tests that don't require auth
    {
      name: 'unauthenticated',
      testMatch: /.*\.unauth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Tests that require auth (depend on setup)
    {
      name: 'authenticated',
      testMatch: /.*\.auth\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
    },
  ],
  // Don't auto-start the dev server — user manages it themselves
  // Uncomment below to auto-start:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
