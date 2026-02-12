import { describe, it, expect } from 'vitest'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
} from '@/lib/utils/retirement-projections'

describe('calculateRetirementProjections', () => {
  const currentYear = new Date().getFullYear()
  const mockBirthYear = currentYear - 55 // age 55

  const mockAccounts: Account[] = [
    {
      account_name: '401(k)',
      owner: 'planner',
      balance: 100000,
      account_type: '401k',
      annual_contribution: 23000,
    },
  ]

  const mockExpenses: Expense[] = [
    {
      expense_name: 'Living Expenses',
      amount_before_65: 60000,
      amount_after_65: 48000,
    },
  ]

  const mockOtherIncome: OtherIncome[] = []

  const retirementAge = 65
  const yearsToRetirement = retirementAge - 55

  const mockSettings: CalculatorSettings = buildCalculatorSettings(
    null, // settingsData
    null, // planData
    currentYear,
    retirementAge,
    yearsToRetirement,
    60000 // annualExpenses
  )

  it('should calculate projections for a basic scenario', () => {
    const projections = calculateRetirementProjections(
      mockBirthYear,
      mockAccounts,
      mockExpenses,
      mockOtherIncome,
      mockSettings
    )

    expect(projections).toBeDefined()
    expect(Array.isArray(projections)).toBe(true)
    expect(projections.length).toBeGreaterThan(0)
  })

  it('should handle retirement age correctly', () => {
    const earlyRetirementAge = 60
    const earlyYearsToRetirement = earlyRetirementAge - 55
    const earlySettings = buildCalculatorSettings(
      null,
      null,
      currentYear,
      earlyRetirementAge,
      earlyYearsToRetirement,
      60000
    )

    const projections = calculateRetirementProjections(
      mockBirthYear,
      mockAccounts,
      mockExpenses,
      mockOtherIncome,
      earlySettings
    )

    const retirementYear = projections.find((p) => p.age === 60)
    expect(retirementYear).toBeDefined()
  })

  it('should apply growth rate before retirement', () => {
    const projections = calculateRetirementProjections(
      mockBirthYear,
      mockAccounts,
      mockExpenses,
      mockOtherIncome,
      mockSettings
    )

    const preRetirement = projections.filter((p) => p.age < 65)
    if (preRetirement.length > 1) {
      // Account balances should grow before retirement (contributions + growth)
      const firstYear = preRetirement[0]
      const laterYear = preRetirement[preRetirement.length - 1]
      const firstTotal =
        (firstYear.balance_401k || 0) +
        (firstYear.balance_roth || 0) +
        (firstYear.balance_investment || 0) +
        (firstYear.balance_hsa || 0) +
        (firstYear.balance_ira || 0)
      const laterTotal =
        (laterYear.balance_401k || 0) +
        (laterYear.balance_roth || 0) +
        (laterYear.balance_investment || 0) +
        (laterYear.balance_hsa || 0) +
        (laterYear.balance_ira || 0)
      expect(laterTotal).toBeGreaterThan(firstTotal)
    }
  })

  it('should handle zero balance accounts', () => {
    const zeroBalanceAccounts: Account[] = [
      {
        account_name: '401(k)',
        owner: 'planner',
        balance: 0,
        account_type: '401k',
        annual_contribution: 0,
      },
    ]

    const projections = calculateRetirementProjections(
      mockBirthYear,
      zeroBalanceAccounts,
      mockExpenses,
      mockOtherIncome,
      mockSettings
    )

    expect(projections).toBeDefined()
    expect(projections.length).toBeGreaterThan(0)
    // First year 401k balance should be 0 (no balance, no contribution)
    expect(projections[0].balance_401k).toBe(0)
  })

  it('should calculate withdrawals during retirement', () => {
    const projections = calculateRetirementProjections(
      mockBirthYear,
      mockAccounts,
      mockExpenses,
      mockOtherIncome,
      mockSettings
    )

    const retirementYears = projections.filter((p) => p.age >= 65)
    if (retirementYears.length > 0) {
      // There should be some form of distribution from accounts during retirement
      const hasWithdrawals = retirementYears.some(
        (p) =>
          (p.distribution_401k || 0) > 0 ||
          (p.distribution_roth || 0) > 0 ||
          (p.distribution_taxable || 0) > 0 ||
          (p.distribution_ira || 0) > 0
      )
      expect(hasWithdrawals).toBe(true)
    }
  })
})

describe('calculateEstimatedSSA', () => {
  it('should return default estimates for zero income', () => {
    const result = calculateEstimatedSSA(0)
    expect(result).toBe(20000) // default planner estimate
  })

  it('should return lower estimates for spouse', () => {
    const plannerSSA = calculateEstimatedSSA(75000, true)
    const spouseSSA = calculateEstimatedSSA(75000, false)
    expect(spouseSSA).toBeLessThan(plannerSSA)
  })

  it('should cap at maximum SSA income', () => {
    const result = calculateEstimatedSSA(500000, true)
    expect(result).toBeLessThanOrEqual(45000) // max planner SSA
  })
})
