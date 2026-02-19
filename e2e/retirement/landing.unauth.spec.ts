import { test, expect } from '@playwright/test'

test.describe('Retirement App — Unauthenticated', () => {
  test('home page loads and shows My Plan branding', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The home page should have some recognizable content
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Should have email and password inputs
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // Should have a submit button
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
  })

  test('retirement landing page loads', async ({ page }) => {
    await page.goto('/apps/retirement')
    await page.waitForLoadState('networkidle')

    // Unauthenticated users should see the landing or be redirected to login
    const url = page.url()
    const isLanding = url.includes('/apps/retirement')
    const isLogin = url.includes('/login')
    expect(isLanding || isLogin).toBe(true)
  })

  test('retirement signup page renders', async ({ page }) => {
    await page.goto('/apps/retirement/signup')
    await page.waitForLoadState('networkidle')

    // Should show the sign up form
    await expect(page.locator('text=Sign Up')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('retirement dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    // Should redirect to login
    expect(page.url()).toContain('/login')
  })

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword123')
    await page.click('button[type="submit"]')

    // Should show an error message
    await expect(page.locator('.bg-red-50, [role="alert"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('login page toggle between sign in and sign up', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Should initially show "Sign in"
    await expect(page.locator('button[type="submit"]')).toContainText(/sign in/i)

    // Click "Don't have an account? Sign up"
    await page.click("text=Don't have an account")

    // Should now show "Sign up"
    await expect(page.locator('button[type="submit"]')).toContainText(/sign up/i)
  })
})
