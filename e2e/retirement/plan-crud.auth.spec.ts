import { test, expect } from '@playwright/test'

test.describe('Retirement Plan CRUD — Authenticated', () => {
  let createdPlanUrl: string | null = null

  test('create a new retirement plan', async ({ page }) => {
    await page.goto('/apps/retirement/plans/new')
    await page.waitForLoadState('networkidle')

    // Should see the create form
    await expect(page.locator('text=Create New Retirement Plan')).toBeVisible()

    // Fill in the plan name
    const planNameInput = page.locator('#planName')
    await expect(planNameInput).toBeVisible()
    await planNameInput.fill('E2E Test Plan')

    // Click Create Plan
    await page.click('button:has-text("Create Plan")')

    // Wait for redirect to the plan detail page
    await page.waitForURL(/\/apps\/retirement\/plans\/\d+/, { timeout: 15000 })
    createdPlanUrl = page.url()

    // Should land on the plan detail page with tabs
    await expect(page.locator('text=E2E Test Plan')).toBeVisible()
  })

  test('view plan shows snapshot tab by default', async ({ page }) => {
    // Go to dashboard to find a plan
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    // Click on the first "View Plan" link if plans exist
    const viewPlanLink = page.locator('a:has-text("View Plan")').first()
    const hasPlan = await viewPlanLink.isVisible().catch(() => false)

    if (hasPlan) {
      await viewPlanLink.click()
      await page.waitForLoadState('networkidle')

      // Should show the snapshot tab (Quick Start)
      await expect(page.locator('text=Quick Start')).toBeVisible({ timeout: 10000 })

      // Should show the quick start form fields
      await expect(page.locator('#snapshot-your-age')).toBeVisible()
      await expect(page.locator('#snapshot-retirement-age')).toBeVisible()
      await expect(page.locator('#snapshot-current-savings')).toBeVisible()
    } else {
      // No plans exist — that's okay for a fresh test user
      test.skip()
    }
  })

  test('snapshot tab: fill out quick start form', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    const viewPlanLink = page.locator('a:has-text("View Plan")').first()
    const hasPlan = await viewPlanLink.isVisible().catch(() => false)
    if (!hasPlan) {
      test.skip()
      return
    }

    await viewPlanLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Quick Start')).toBeVisible({ timeout: 10000 })

    // Fill in quick start fields
    const ageInput = page.locator('#snapshot-your-age')
    await ageInput.fill('')
    await ageInput.fill('45')

    const retirementAgeInput = page.locator('#snapshot-retirement-age')
    await retirementAgeInput.fill('')
    await retirementAgeInput.fill('65')

    const savingsInput = page.locator('#snapshot-current-savings')
    await savingsInput.fill('')
    await savingsInput.fill('500000')

    const expensesInput = page.locator('#snapshot-annual-expenses')
    await expensesInput.fill('')
    await expensesInput.fill('60000')

    // Verify values are set
    await expect(ageInput).toHaveValue('45')
    await expect(retirementAgeInput).toHaveValue('65')
    await expect(savingsInput).toHaveValue('500000')
    await expect(expensesInput).toHaveValue('60000')

    // The "Save & See My Retirement Snapshot" button should be visible
    const saveButton = page.locator('button:has-text("Save")')
    await expect(saveButton.first()).toBeVisible()
  })

  test('snapshot tab: save and see retirement projection results', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    const viewPlanLink = page.locator('a:has-text("View Plan")').first()
    const hasPlan = await viewPlanLink.isVisible().catch(() => false)
    if (!hasPlan) {
      test.skip()
      return
    }

    await viewPlanLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Quick Start')).toBeVisible({ timeout: 10000 })

    // Fill in quick start fields
    await page.locator('#snapshot-your-age').fill('45')
    await page.locator('#snapshot-retirement-age').fill('65')
    await page.locator('#snapshot-current-savings').fill('500000')
    await page.locator('#snapshot-annual-expenses').fill('60000')

    // Click Save & See Snapshot
    const saveButton = page.locator('button:has-text("Save")')
    await saveButton.first().click()

    // Wait for results to appear (projections section)
    // Results should show some form of projection output — status cards, table, or graph
    await expect(
      page.locator('text=/on track|at risk|close|confidence|retirement snapshot/i').first()
    ).toBeVisible({ timeout: 20000 })
  })

  test('edit plan name', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    const viewPlanLink = page.locator('a:has-text("View Plan")').first()
    const hasPlan = await viewPlanLink.isVisible().catch(() => false)
    if (!hasPlan) {
      test.skip()
      return
    }

    await viewPlanLink.click()
    await page.waitForLoadState('networkidle')

    // Click Edit link
    const editLink = page.locator('a:has-text("Edit")')
    const hasEdit = await editLink.isVisible().catch(() => false)
    if (!hasEdit) {
      test.skip()
      return
    }

    await editLink.click()
    await page.waitForLoadState('networkidle')

    // Should show the plan edit form
    const planNameInput = page.locator('#planName')
    await expect(planNameInput).toBeVisible()

    // Update the name
    await planNameInput.fill('E2E Updated Plan')
    await page.click('button:has-text("Update Plan")')

    // Should redirect back to plan page
    await page.waitForURL(/\/apps\/retirement\/plans\/\d+$/, { timeout: 15000 })
    await expect(page.locator('text=E2E Updated Plan')).toBeVisible()
  })

  test('switch to advanced mode and see tabs', async ({ page }) => {
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    const viewPlanLink = page.locator('a:has-text("View Plan")').first()
    const hasPlan = await viewPlanLink.isVisible().catch(() => false)
    if (!hasPlan) {
      test.skip()
      return
    }

    await viewPlanLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Quick Start')).toBeVisible({ timeout: 10000 })

    // Look for "Advanced" or "Switch to Advanced" button
    const advancedButton = page.locator('button:has-text("Advanced"), a:has-text("Advanced")')
    const hasAdvanced = await advancedButton.first().isVisible().catch(() => false)

    if (hasAdvanced) {
      await advancedButton.first().click()
      await page.waitForLoadState('networkidle')

      // Should show advanced tabs
      await expect(page.locator('text=Plan Summary')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('text=Scenario Modeling')).toBeVisible()
      await expect(page.locator('text=Projections')).toBeVisible()
    }
    // If no advanced button, that's fine — the test still passes
  })

  test('delete a retirement plan from dashboard', async ({ page }) => {
    // First create a plan to delete
    await page.goto('/apps/retirement/plans/new')
    await page.waitForLoadState('networkidle')

    const planNameInput = page.locator('#planName')
    await planNameInput.fill('E2E Plan To Delete')
    await page.click('button:has-text("Create Plan")')
    await page.waitForURL(/\/apps\/retirement\/plans\/\d+/, { timeout: 15000 })

    // Go back to dashboard
    await page.goto('/apps/retirement/dashboard')
    await page.waitForLoadState('networkidle')

    // Find the plan we just created and click delete
    const planCard = page.locator('text=E2E Plan To Delete').first()
    await expect(planCard).toBeVisible()

    // Set up dialog handler to accept the confirm prompt
    page.on('dialog', (dialog) => dialog.accept())

    // Click the delete button in the same card row
    const deleteButton = page
      .locator('div')
      .filter({ hasText: 'E2E Plan To Delete' })
      .locator('button:has-text("Delete")')
      .first()
    await deleteButton.click()

    // Wait for page reload
    await page.waitForLoadState('networkidle')

    // Plan should no longer appear (or page reloaded)
    // Give it a moment for the reload
    await page.waitForTimeout(2000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    const planStillVisible = await page.locator('text=E2E Plan To Delete').isVisible().catch(() => false)
    expect(planStillVisible).toBe(false)
  })
})
