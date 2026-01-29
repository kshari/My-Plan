import { describe, it, expect } from 'vitest'
import { calculateRetirementProjections } from '@/lib/utils/retirement-projections'

describe('calculateRetirementProjections', () => {
  const mockBirthYear = 1970
  const mockAccounts = [
    {
      id: '1',
      name: '401(k)',
      account_type: '401k' as const,
      balance: 100000,
      contribution_limit: 23000,
      employer_match: 0.05,
      employer_match_limit: 0.06,
      growth_rate: 0.07,
    },
  ]
  const mockExpenses = [
    {
      id: '1',
      name: 'Living Expenses',
      amount_before_65: 5000,
      amount_after_65: 4000,
      start_age: 0,
      end_age: 100,
    },
  ]
  const mockOtherIncome: any[] = []
  const mockSettings = {
    retirement_age: 65,
    growth_rate_before_retirement: 0.07,
    growth_rate_during_retirement: 0.05,
    inflation_rate: 0.03,
    planner_ssa_income: true,
    spouse_ssa_income: false,
    ssa_start_age: 67,
    filing_status: 'Single' as const,
  }

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
    const projections = calculateRetirementProjections(
      mockBirthYear,
      mockAccounts,
      mockExpenses,
      mockOtherIncome,
      { ...mockSettings, retirement_age: 60 }
    )

    const retirementYear = projections.find(
      (p) => p.age === 60
    )
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
      // Account should grow before retirement
      const firstYear = preRetirement[0]
      const laterYear = preRetirement[preRetirement.length - 1]
      expect(laterYear.totalAccountBalance).toBeGreaterThan(
        firstYear.totalAccountBalance
      )
    }
  })

  it('should handle zero balance accounts', () => {
    const zeroBalanceAccounts = [
      {
        ...mockAccounts[0],
        balance: 0,
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
    expect(projections[0].totalAccountBalance).toBe(0)
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
      const retirementYear = retirementYears[0]
      expect(retirementYear.totalWithdrawals).toBeGreaterThan(0)
    }
  })
})
