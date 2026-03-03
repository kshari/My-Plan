/**
 * Shared type for the retirement calculator / plan inputs form.
 * Used by both the dashboard calculator and the snapshot "Change Plan Inputs" flow.
 */
import {
  DEFAULT_AGE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_CURRENT_SAVINGS,
  DEFAULT_ANNUAL_CONTRIBUTION,
  DEFAULT_MONTHLY_EXPENSES,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  DEFAULT_INFLATION_RATE_PCT,
  DEFAULT_INCLUDE_SSA,
  DEFAULT_SSA_START_AGE,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_INCLUDE_SPOUSE,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
  DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
} from '@/lib/constants/retirement-defaults'

export interface RetirementAssumptions {
  age: number
  retirementAge: number
  lifeExpectancy: number
  currentSavings: number
  annualContribution: number
  monthlyExpenses: number
  growthRatePreRetirement: number
  growthRateDuringRetirement: number
  inflationRate: number
  includeSsa: boolean
  ssaStartAge: number
  ssaAnnualBenefit: number
  includeSpouse: boolean
  spouseAge: number
  spouseSsaBenefit: number
  preMedicareAnnualPremium: number
  postMedicareAnnualPremium: number
}

export const DEFAULT_RETIREMENT_ASSUMPTIONS: RetirementAssumptions = {
  age: DEFAULT_AGE,
  retirementAge: DEFAULT_RETIREMENT_AGE,
  lifeExpectancy: DEFAULT_LIFE_EXPECTANCY,
  currentSavings: DEFAULT_CURRENT_SAVINGS,
  annualContribution: DEFAULT_ANNUAL_CONTRIBUTION,
  monthlyExpenses: DEFAULT_MONTHLY_EXPENSES,
  growthRatePreRetirement: DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  growthRateDuringRetirement: DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  inflationRate: DEFAULT_INFLATION_RATE_PCT,
  includeSsa: DEFAULT_INCLUDE_SSA,
  ssaStartAge: DEFAULT_SSA_START_AGE,
  ssaAnnualBenefit: DEFAULT_SSA_ANNUAL_BENEFIT,
  includeSpouse: DEFAULT_INCLUDE_SPOUSE,
  spouseAge: DEFAULT_AGE,
  spouseSsaBenefit: DEFAULT_SPOUSE_SSA_BENEFIT,
  preMedicareAnnualPremium: DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
  postMedicareAnnualPremium: DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
}
