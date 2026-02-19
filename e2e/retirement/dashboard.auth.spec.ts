import { test, expect } from '@playwright/test'

test.describe('Retirement Dashboard — Authenticated', () => {
  test('dashboard loads and shows "Your Retirement Plans"', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    // Should NOT redirect to login
    expect(page.url()).toContain('/apps/retirement/dashboard')

    // Should show the dashboard heading
    await expect(page.locator('text=Your Retirement Plans')).toBeVisible()
  })

  test('dashboard shows "Create New Plan" button', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('a:has-text("Create New Plan")')
    await expect(createButton).toBeVisible()
    await expect(createButton).toHaveAttribute('href', '/apps/retirement/plans/new')
  })

  test('dashboard nav shows user email and logout button', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    // Should show logout button
    await expect(page.locator('button:has-text("Logout")')).toBeVisible()

    // Should show Profile link
    await expect(page.locator('a:has-text("Profile")')).toBeVisible()

    // Should show Switch Apps link
    await expect(page.locator('a:has-text("Switch Apps")')).toBeVisible()
  })

  test('navigate to Create New Plan page', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    await page.click('a:has-text("Create New Plan")')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/apps/retirement/plans/new')
    await expect(page.locator('text=Create New Retirement Plan')).toBeVisible()
  })

  test('navigate to Profile page', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    await page.click('a:has-text("Profile")')
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/apps/retirement/profile')
    await expect(page.locator('text=Profile Settings')).toBeVisible()
  })
})
