import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth', 'user.json')

/**
 * Authentication setup — runs before all authenticated tests.
 *
 * Requires environment variables:
 *   E2E_TEST_EMAIL    — a valid Supabase user email
 *   E2E_TEST_PASSWORD — password for that user
 *
 * Set them in .env.local:
 *   E2E_TEST_EMAIL=your-test-user@example.com
 *   E2E_TEST_PASSWORD=your-test-password
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.local.\n' +
      'Create a test user in your Supabase project and add these variables.'
    )
  }

  // Go to the login page
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Fill in credentials
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)

  // Click sign in
  await page.click('button[type="submit"]')

  // Wait for navigation away from login page (successful auth)
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  })

  // Verify we're logged in by checking we're NOT on a login page
  const currentUrl = page.url()
  expect(currentUrl).not.toContain('/login')

  // Save the authenticated state
  await page.context().storageState({ path: authFile })
})
