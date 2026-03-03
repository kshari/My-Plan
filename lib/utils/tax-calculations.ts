import {
  INCOME_TAX_BRACKETS,
  TOP_MARGINAL_RATE,
} from '@/lib/constants/tax-brackets'
import { DEFAULT_FILING_STATUS } from '@/lib/constants/retirement-defaults'

type FilingStatus = keyof typeof INCOME_TAX_BRACKETS

/**
 * Returns the marginal tax bracket rate for a given taxable income and filing status.
 */
export function calculateMarginalTaxRate(income: number, filingStatus?: string): number {
  const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
  const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]

  for (const bracket of bracketList) {
    if (income >= bracket.min && income < bracket.max) {
      return bracket.rate
    }
  }

  return TOP_MARGINAL_RATE
}
