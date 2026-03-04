// Retirement projection calculation engine
import {
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
  DEFAULT_INFLATION_RATE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_FILING_STATUS,
  DEFAULT_ENABLE_BORROWING,
  DEFAULT_DEBT_INTEREST_RATE,
  DEFAULT_MAX_PROJECTION_AGE,
  SAFE_WITHDRAWAL_RATE,
  DEFAULT_FIXED_DOLLAR_WITHDRAWAL,
  GUARDRAIL_CEILING,
  GUARDRAIL_FLOOR,
  ROTH_CONVERSION_FRACTION,
  ROTH_CONVERSION_MAX,
  QCD_MAX_ANNUAL,
  QCD_FRACTION_OF_RMD,
  RMD_START_AGE,
  RMD_LIFE_EXPECTANCY_FACTOR_AT_73,
  MEDICARE_ELIGIBILITY_AGE,
} from '@/lib/constants/retirement-defaults'
import {
  INCOME_TAX_BRACKETS,
  CAPITAL_GAINS_BRACKETS,
  DEFAULT_MARGINAL_TAX_RATE,
  DEFAULT_ESTIMATED_TAX_RATE,
  DEFAULT_ROTH_CONVERSION_TAX_RATE,
  DEFAULT_TAXABLE_ACCOUNT_RATIO,
  SSA_TAXABLE_PORTION,
  getStandardDeduction,
  type FilingStatus,
} from '@/lib/constants/tax-brackets'
import {
  SSA_WAGE_BASE,
  SSA_BEND_POINT_1,
  SSA_BEND_POINT_2,
  SSA_RATE_TIER_1,
  SSA_RATE_TIER_2,
  SSA_RATE_TIER_3,
  SSA_SPOUSE_BENEFIT_MULTIPLIER,
  SSA_MIN_BENEFIT_PLANNER,
  SSA_MIN_BENEFIT_SPOUSE,
  SSA_MAX_BENEFIT_PLANNER,
  SSA_MAX_BENEFIT_SPOUSE,
  SSA_DEFAULT_PLANNER_BENEFIT,
  SSA_DEFAULT_SPOUSE_BENEFIT,
  ssaClaimingMultiplier,
} from '@/lib/constants/ssa-constants'

/**
 * Calculate estimated SSA (Social Security) benefit based on annual income
 * @param annualIncome - Annual income in today's dollars
 * @param isPlanner - true for primary earner, false for spouse
 * @returns Estimated annual SSA benefit in today's dollars
 */
export function calculateEstimatedSSA(annualIncome: number, isPlanner: boolean = true): number {
  if (!annualIncome || annualIncome <= 0) {
    // Use default estimates if no income provided
    return isPlanner ? 20000 : 15000
  }
  
  // Simplified SSA estimation based on income
  // SSA uses average indexed monthly earnings (AIME) and bend points
  // For quick estimation, we'll use a simplified formula:
  // - For income up to ~$50k: ~40% replacement
  // - For income $50k-$100k: ~30% replacement  
  // - For income above $100k: ~20% replacement (due to cap)
  
  const cappedIncome = Math.min(annualIncome, SSA_WAGE_BASE)
  
  let estimatedSSA = 0
  if (cappedIncome <= SSA_BEND_POINT_1) {
    estimatedSSA = cappedIncome * SSA_RATE_TIER_1
  } else if (cappedIncome <= SSA_BEND_POINT_2) {
    estimatedSSA = SSA_BEND_POINT_1 * SSA_RATE_TIER_1 + (cappedIncome - SSA_BEND_POINT_1) * SSA_RATE_TIER_2
  } else {
    estimatedSSA = SSA_BEND_POINT_1 * SSA_RATE_TIER_1 + (SSA_BEND_POINT_2 - SSA_BEND_POINT_1) * SSA_RATE_TIER_2 + (cappedIncome - SSA_BEND_POINT_2) * SSA_RATE_TIER_3
  }
  
  if (!isPlanner) {
    estimatedSSA = estimatedSSA * SSA_SPOUSE_BENEFIT_MULTIPLIER
  }
  
  const minSSA = isPlanner ? SSA_MIN_BENEFIT_PLANNER : SSA_MIN_BENEFIT_SPOUSE
  const maxSSA = isPlanner ? SSA_MAX_BENEFIT_PLANNER : SSA_MAX_BENEFIT_SPOUSE
  return Math.max(minSSA, Math.min(maxSSA, estimatedSSA))
}

export interface Account {
  id?: number
  account_name: string
  owner: string
  balance: number
  account_type?: string
  annual_contribution?: number
}

export interface Expense {
  id?: number
  expense_name: string
  amount_after_65: number
  amount_before_65: number
}

export interface OtherIncome {
  id?: number
  income_name: string
  amount: number
  start_year?: number
  end_year?: number
  inflation_adjusted?: boolean
}

export type WithdrawalPriority = 
  | 'longevity' 
  | 'legacy' 
  | 'tax_optimization' 
  | 'stable_income' 
  | 'sequence_risk' 
  | 'liquidity'
  | 'default' // Default tax-efficient strategy

export type WithdrawalStrategyType = 
  | 'goal_based' // Use priority-based strategy (existing)
  | 'amount_based_expense_coverage' // Expense Based - Cover Expenses and Tax
  | 'amount_based_4_percent' // 4% Rule
  | 'amount_based_fixed_percentage' // Fixed percentage of portfolio
  | 'amount_based_fixed_dollar' // Fixed dollar amount
  | 'amount_based_swp' // Systematic Withdrawal Plan (earnings only)
  | 'sequence_proportional' // Proportional withdrawals
  | 'sequence_bracket_topping' // Bracket-topping strategy
  | 'market_bucket' // Bucket strategy
  | 'market_guardrails' // Guardrails (Guyton-Klinger)
  | 'market_floor_upside' // Floor-and-Upside
  | 'tax_roth_conversion' // Roth Conversion Bridge
  | 'tax_qcd' // Qualified Charitable Distributions

export interface CalculatorSettings {
  current_year: number
  retirement_age: number
  retirement_start_year: number
  years_to_retirement: number
  annual_retirement_expenses: number
  growth_rate_before_retirement: number // decimal (e.g., 0.1 for 10%)
  growth_rate_during_retirement: number // decimal
  inflation_rate: number // decimal
  filing_status?: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household'
  debt_interest_rate?: number // decimal, default 0.06 (6%)
  enable_borrowing?: boolean // Enable borrowing to cover negative cashflow
  ssa_start_age?: number // Age to start SSA income, defaults to retirement age
  withdrawal_priority?: WithdrawalPriority // Primary withdrawal strategy priority (for goal-based)
  withdrawal_secondary_priority?: WithdrawalPriority // Secondary priority for tie-breaking
  withdrawal_strategy_type?: WithdrawalStrategyType // Strategy type selection
  // Healthcare premiums (annual, in today's dollars; inflated per year)
  pre_medicare_annual_premium?: number
  post_medicare_annual_premium?: number
  // Strategy-specific parameters
  fixed_percentage_rate?: number // For fixed percentage strategy (e.g., 0.04 for 4%)
  fixed_dollar_amount?: number // For fixed dollar strategy
  guardrails_ceiling?: number // For guardrails strategy (e.g., 0.06 for 6%)
  guardrails_floor?: number // For guardrails strategy (e.g., 0.03 for 3%)
  bracket_topping_threshold?: number // Tax bracket threshold for bracket-topping
  /** Optional override: per-year decimal returns for pre-retirement years. Falls back to growth_rate_before_retirement for any year beyond the array length. */
  pre_retirement_return_sequence?: number[]
  /** Optional override: per-year decimal returns for retirement years (e.g. [-0.15, -0.05, 0.02] for stress test). Falls back to growth_rate_during_retirement for any year beyond the array length. */
  retirement_return_sequence?: number[]
}

export interface ProjectionDetail {
  year: number
  age: number
  event?: string
  ssa_income?: number
  distribution_401k?: number
  distribution_roth?: number
  distribution_taxable?: number
  distribution_hsa?: number
  distribution_ira?: number
  distribution_other?: number
  investment_income?: number
  other_investments_income?: number
  other_recurring_income?: number
  total_income?: number
  after_tax_income?: number
  living_expenses?: number
  healthcare_expenses?: number
  special_expenses?: number
  total_expenses?: number
  gap_excess?: number
  cumulative_liability?: number
  debt_balance?: number
  debt_interest_paid?: number
  debt_principal_paid?: number
  assets_remaining?: number
  networth?: number
  balance_401k?: number
  balance_roth?: number
  balance_investment?: number
  balance_other_investments?: number
  balance_hsa?: number
  balance_ira?: number
  taxable_income?: number
  tax?: number
  annual_contribution?: number
}

interface AccountBalances {
  '401k': number
  'Roth IRA': number
  'Roth': number
  'Taxable': number
  'HSA': number
  'IRA': number
  'Traditional IRA': number
  'Other': number
  [key: string]: number
}

// Track cost basis for taxable account to avoid double taxation
// When excess after-tax income is added to taxable account, it has cost basis = value
interface TaxableAccountBasis {
  principal: number  // Amount that has already been taxed (cost basis)
  total: number      // Total balance including gains
}

interface WithdrawalResult {
  distribution401k: number
  distributionRoth: number
  distributionTaxable: number
  distributionHsa: number
  distributionIra: number
  distributionOther: number
}

/**
 * Determines withdrawal order based on priority and current situation
 * Evaluates dynamically each year based on account balances, age, and priorities
 */
function determineWithdrawalOrder(
  priority: WithdrawalPriority,
  secondaryPriority: WithdrawalPriority,
  age: number,
  rmdAge: number,
  requiresRMD: boolean,
  requiredRMD: number,
  remainingNeed: number,
  accountBalances: AccountBalances,
  yearsRemaining: number,
  totalNetworth: number
): string[] {
  const order: string[] = []
  
  // Always handle RMDs first if required (mandatory by law)
  if (requiresRMD && requiredRMD > 0) {
    if (accountBalances['401k'] > 0) order.push('401k')
    if (accountBalances['IRA'] > 0) order.push('IRA')
  }
  
  // Strategy-specific withdrawal orders
  if (priority === 'longevity') {
    // Preserve assets for long retirement - use taxable first, then traditional, preserve Roth
    if (!requiresRMD) {
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['401k'] > 0 && !order.includes('401k')) order.push('401k')
      if (accountBalances['IRA'] > 0 && !order.includes('IRA')) order.push('IRA')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA') // Last resort
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs, use Roth to preserve taxable for later years
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else if (priority === 'legacy') {
    // Maximize inheritance - preserve taxable (step-up basis), use traditional accounts first
    if (!requiresRMD) {
      if (accountBalances['401k'] > 0) order.push('401k')
      if (accountBalances['IRA'] > 0) order.push('IRA')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable') // Last - preserve for heirs
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs, use Roth, preserve taxable
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable') // Last
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else if (priority === 'tax_optimization') {
    // Minimize taxes - use taxable first (lower capital gains), then traditional strategically
    if (!requiresRMD) {
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['401k'] > 0 && !order.includes('401k')) order.push('401k')
      if (accountBalances['IRA'] > 0 && !order.includes('IRA')) order.push('IRA')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs, use Roth (tax-free), then taxable
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else if (priority === 'stable_income') {
    // Maintain consistent income - balance withdrawals across account types
    // Use taxable and traditional accounts more evenly to smooth income
    if (!requiresRMD) {
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['401k'] > 0) order.push('401k')
      if (accountBalances['IRA'] > 0) order.push('IRA')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs, supplement with Roth for stability
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else if (priority === 'sequence_risk') {
    // Protect against early market downturns - use taxable and Roth first in early retirement
    const isEarlyRetirement = yearsRemaining > 20
    if (!requiresRMD) {
      if (isEarlyRetirement) {
        // Early retirement: use taxable and Roth to preserve traditional accounts
        if (accountBalances['Taxable'] > 0) order.push('Taxable')
        if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
        if (accountBalances['HSA'] > 0) order.push('HSA')
        if (accountBalances['401k'] > 0) order.push('401k')
        if (accountBalances['IRA'] > 0) order.push('IRA')
        if (accountBalances['Other'] > 0) order.push('Other')
      } else {
        // Later retirement: more balanced approach
        if (accountBalances['Taxable'] > 0) order.push('Taxable')
        if (accountBalances['HSA'] > 0) order.push('HSA')
        if (accountBalances['401k'] > 0) order.push('401k')
        if (accountBalances['IRA'] > 0) order.push('IRA')
        if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
        if (accountBalances['Other'] > 0) order.push('Other')
      }
    } else {
      // After RMDs, use Roth to minimize sequence risk
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else if (priority === 'liquidity') {
    // Easy access - prioritize taxable and Roth (no penalties)
    if (!requiresRMD) {
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['401k'] > 0) order.push('401k')
      if (accountBalances['IRA'] > 0) order.push('IRA')
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs, use Roth and taxable for liquidity
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  } else {
    // Default: Tax-efficient strategy (original logic)
    if (!requiresRMD) {
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['401k'] > 0) order.push('401k')
      if (accountBalances['IRA'] > 0) order.push('IRA')
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Other'] > 0) order.push('Other')
    } else {
      // After RMDs
      if (accountBalances['Roth IRA'] > 0) order.push('Roth IRA')
      if (accountBalances['Taxable'] > 0) order.push('Taxable')
      if (accountBalances['HSA'] > 0) order.push('HSA')
      if (accountBalances['Other'] > 0) order.push('Other')
    }
  }
  
  return order
}

// Calculate progressive income tax based on 2024 federal tax brackets
export function calculateProgressiveTax(taxableIncome: number, filingStatus: string): number {
  if (taxableIncome <= 0) return 0
  
  const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
  const bracketList = INCOME_TAX_BRACKETS[status] || INCOME_TAX_BRACKETS['Single']
  
  let tax = 0
  let remainingIncome = taxableIncome
  
  for (const bracket of bracketList) {
    if (remainingIncome <= 0) break
    
    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
    tax += taxableInBracket * bracket.rate
    remainingIncome -= taxableInBracket
    
    if (bracket.max === Infinity) break
  }
  
  return tax
}

/**
 * Determines the filing status for tax calculations
 * Primary logic: If includeSpouseSsa is true, use 'Married Filing Jointly', otherwise use settings.filing_status or default to 'Single'
 */
export function determineFilingStatus(
  includeSpouseSsa: boolean | undefined,
  settingsFilingStatus?: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household'
): 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' {
  if (includeSpouseSsa) {
    return 'Married Filing Jointly'
  }
  return settingsFilingStatus || DEFAULT_FILING_STATUS
}

// Calculate long-term capital gains tax (2024 rates)
export function calculateCapitalGainsTax(capitalGains: number, filingStatus: string): number {
  if (capitalGains <= 0) return 0
  
  const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
  const bracketList = CAPITAL_GAINS_BRACKETS[status] || CAPITAL_GAINS_BRACKETS['Single']
  
  let tax = 0
  let remainingGains = capitalGains
  
  for (const bracket of bracketList) {
    if (remainingGains <= 0) break
    
    const taxableInBracket = Math.min(remainingGains, bracket.max - bracket.min)
    tax += taxableInBracket * bracket.rate
    remainingGains -= taxableInBracket
    
    if (bracket.max === Infinity) break
  }
  
  return tax
}

// Estimate marginal tax rate for additional income (simplified)
function estimateMarginalTaxRate(currentTaxableIncome: number, filingStatus: string): number {
  const standardDeduction = getStandardDeduction(filingStatus)
  const adjustedIncome = Math.max(0, currentTaxableIncome - standardDeduction)
  
  const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
  const bracketList = INCOME_TAX_BRACKETS[status] || INCOME_TAX_BRACKETS['Single']
  
  for (const bracket of bracketList) {
    if (adjustedIncome >= bracket.min && adjustedIncome < bracket.max) {
      return bracket.rate
    }
  }
  
  return DEFAULT_MARGINAL_TAX_RATE
}

// Estimate capital gains tax rate for additional gains
function estimateCapitalGainsTaxRate(currentTaxableIncome: number, filingStatus: string): number {
  const standardDeduction = getStandardDeduction(filingStatus)
  const adjustedIncome = Math.max(0, currentTaxableIncome - standardDeduction)
  
  const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
  const bracketList = CAPITAL_GAINS_BRACKETS[status] || CAPITAL_GAINS_BRACKETS['Single']
  
  for (const bracket of bracketList) {
    if (adjustedIncome >= bracket.min && adjustedIncome < bracket.max) {
      return bracket.rate
    }
  }
  
  return 0.15
}

/**
 * Builds CalculatorSettings from database settings data
 * Ensures consistent settings structure across snapshot and details tabs
 */
export function buildCalculatorSettings(
  settingsData: any,
  planData: any,
  currentYear: number,
  retirementAge: number,
  yearsToRetirement: number,
  annualExpenses: number
): CalculatorSettings {
  return {
    current_year: settingsData?.current_year || currentYear,
    retirement_age: retirementAge,
    retirement_start_year: settingsData?.retirement_start_year || (currentYear + yearsToRetirement),
    years_to_retirement: yearsToRetirement,
    annual_retirement_expenses: settingsData?.annual_retirement_expenses || annualExpenses,
    growth_rate_before_retirement: parseFloat(settingsData?.growth_rate_before_retirement?.toString() || String(DEFAULT_GROWTH_RATE_PRE_RETIREMENT)),
    growth_rate_during_retirement: parseFloat(settingsData?.growth_rate_during_retirement?.toString() || String(DEFAULT_GROWTH_RATE_DURING_RETIREMENT)),
    inflation_rate: parseFloat(settingsData?.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE)),
    enable_borrowing: settingsData?.enable_borrowing || DEFAULT_ENABLE_BORROWING,
    ssa_start_age: settingsData?.ssa_start_age || retirementAge,
    filing_status: (planData?.include_spouse ? 'Married Filing Jointly' : (planData?.filing_status as any)) || DEFAULT_FILING_STATUS,
    withdrawal_strategy_type: (settingsData?.withdrawal_strategy_type as any) || 'amount_based_expense_coverage',
    withdrawal_priority: settingsData?.withdrawal_priority || 'default',
    withdrawal_secondary_priority: settingsData?.withdrawal_secondary_priority || 'tax_optimization',
    fixed_percentage_rate: settingsData?.fixed_percentage_rate ? parseFloat(settingsData.fixed_percentage_rate.toString()) : undefined,
    fixed_dollar_amount: settingsData?.fixed_dollar_amount ? parseFloat(settingsData.fixed_dollar_amount.toString()) : undefined,
    guardrails_ceiling: settingsData?.guardrails_ceiling ? parseFloat(settingsData.guardrails_ceiling.toString()) : undefined,
    guardrails_floor: settingsData?.guardrails_floor ? parseFloat(settingsData.guardrails_floor.toString()) : undefined,
    bracket_topping_threshold: settingsData?.bracket_topping_threshold ? parseFloat(settingsData.bracket_topping_threshold.toString()) : undefined,
    pre_medicare_annual_premium: settingsData?.pre_medicare_annual_premium != null ? parseFloat(settingsData.pre_medicare_annual_premium.toString()) : undefined,
    post_medicare_annual_premium: settingsData?.post_medicare_annual_premium != null ? parseFloat(settingsData.post_medicare_annual_premium.toString()) : undefined,
  }
}

export function calculateRetirementProjections(
  birthYear: number,
  accounts: Account[],
  expenses: Expense[],
  otherIncome: OtherIncome[],
  settings: CalculatorSettings,
  projectionEndAge: number = DEFAULT_MAX_PROJECTION_AGE,
  spouseBirthYear?: number,
  spouseLifeExpectancy?: number,
  includePlannerSsa: boolean = true,
  includeSpouseSsa?: boolean,
  estimatedPlannerSsaAtStartAge?: number, // Estimated SSA at start age (in today's dollars)
  estimatedSpouseSsaAtStartAge?: number // Estimated spouse SSA at start age (in today's dollars)
): ProjectionDetail[] {
  const currentYear = settings.current_year
  const currentAge = currentYear - birthYear
  const retirementAge = settings.retirement_age
  const retirementStartYear = settings.retirement_start_year
  const debtInterestRate = settings.debt_interest_rate || DEFAULT_DEBT_INTEREST_RATE
  
  // Determine filing status early so it can be used throughout (for tax bracket estimation)
  const filingStatus = determineFilingStatus(includeSpouseSsa, settings.filing_status)
  
  // Initialize account balances by type
  const accountBalances: AccountBalances = {
    '401k': 0,
    'Roth IRA': 0,
    'Roth': 0,
    'Taxable': 0,
    'HSA': 0,
    'IRA': 0,
    'Traditional IRA': 0,
    'Other': 0,
  }
  
  // Group accounts by type
  accounts.forEach(acc => {
    const type = (acc.account_type || 'Other').trim()
    const key = type === 'Roth IRA' ? 'Roth IRA' : 
                type === '401k' ? '401k' :
                type === 'HSA' ? 'HSA' :
                type === 'IRA' || type === 'Traditional IRA' ? 'IRA' :
                type === 'Taxable' ? 'Taxable' : 'Other'
    const balance = acc.balance || 0
    accountBalances[key] = (accountBalances[key] || 0) + balance
  })
  
  const projections: ProjectionDetail[] = []
  let cumulativeLiability = 0
  let debtBalance = 0 // Track outstanding debt
  let year = currentYear
  let age = currentAge
  let initialRetirementPortfolioValue: number | null = null // Track initial portfolio value for 4% rule
  
  // Track cost basis for taxable account to avoid double taxation
  // Initialize with current taxable balance as principal (already taxed)
  let taxableAccountBasis: TaxableAccountBasis = {
    principal: accountBalances['Taxable'],
    total: accountBalances['Taxable']
  }
  
  // Calculate base monthly expenses
  const baseMonthlyExpenses = expenses.reduce((sum, exp) => {
    const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
    return sum + (amount || 0)
  }, 0)
  
  // Calculate annual expenses for current year (before retirement)
  const baseAnnualExpenses = baseMonthlyExpenses * 12
  
  // Calculate expenses at retirement start year (inflated from current expenses)
  // This ensures expenses at retirement start are properly adjusted for inflation
  const yearsToRetirement = settings.years_to_retirement || (retirementStartYear - currentYear)
  const retirementStartExpenses = baseAnnualExpenses * Math.pow(1 + settings.inflation_rate, Math.max(0, yearsToRetirement))
  
  // Use the calculated retirement start expenses (from current expenses inflated to retirement)
  // This ensures continuity: pre-retirement expenses inflate to retirement start, then continue inflating
  const annualRetirementExpensesAtStart = retirementStartExpenses
  
  while (age <= projectionEndAge) {
    const isRetired = age >= retirementAge
    const yearsSinceRetirement = isRetired ? year - retirementStartYear : 0
    const yearsFromNow = year - currentYear
    
    // Calculate living expenses (adjusted for inflation)
    const inflationMultiplier = Math.pow(1 + settings.inflation_rate, yearsFromNow)
    let livingExpenses = 0
    
    if (isRetired) {
      // Use retirement expenses adjusted for inflation from retirement start year
      // annualRetirementExpensesAtStart is already inflated to retirement start, so we only need to
      // inflate from retirement start year forward
      livingExpenses = annualRetirementExpensesAtStart * Math.pow(1 + settings.inflation_rate, Math.max(0, yearsSinceRetirement))
    } else {
      // Use pre-retirement expenses adjusted for inflation
      livingExpenses = baseAnnualExpenses * inflationMultiplier
    }

    // Healthcare is a separate expense from living expenses, inflated from today's dollars
    let healthcareExpenses = 0
    const preMedicarePremium = settings.pre_medicare_annual_premium ?? 0
    const postMedicarePremium = settings.post_medicare_annual_premium ?? 0
    if (preMedicarePremium > 0 || postMedicarePremium > 0) {
      const basePremium = age < MEDICARE_ELIGIBILITY_AGE ? preMedicarePremium : postMedicarePremium
      healthcareExpenses = basePremium * inflationMultiplier
    }
    
    // Calculate growth rate for this year (per-year sequences override for Monte Carlo / stress tests)
    const retSeq = settings.retirement_return_sequence
    const preSeq = settings.pre_retirement_return_sequence
    const growthRate = isRetired
      ? (retSeq && yearsSinceRetirement < retSeq.length ? retSeq[yearsSinceRetirement] : settings.growth_rate_during_retirement)
      : (preSeq && yearsFromNow < preSeq.length ? preSeq[yearsFromNow] : settings.growth_rate_before_retirement)
    
    // Calculate income sources
    let ssaIncome = 0
    let distribution401k = 0
    let distributionRoth = 0
    let distributionTaxable = 0
    let distributionHsa = 0
    let distributionIra = 0
    let distributionOther = 0
    // Investment income (dividends/interest) - NOT INCLUDED per user request
    let investmentIncome = 0
    let otherRecurringIncome = 0
    
    // Planner SSA income (starts at configured age)
    // SSA reductions for early retirement are PERMANENT based on the age you START collecting
    // Default to retirement age if not explicitly set
    const ssaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
    const ssaStartYear = birthYear + ssaStartAge
    if (includePlannerSsa && age >= ssaStartAge) {
      // Calculate base SSA amount at start age
      // If estimated amount provided, use it; otherwise use default $20k
      const baseSsaAtStartAge = estimatedPlannerSsaAtStartAge || SSA_DEFAULT_PLANNER_BENEFIT
      
      const ssaMultiplier = ssaClaimingMultiplier(ssaStartAge)
      
      // Apply inflation from SSA start year to current year
      const yearsSinceSsaStart = year - ssaStartYear
      const inflationFromSsaStart = Math.pow(1 + settings.inflation_rate, Math.max(0, yearsSinceSsaStart))
      
      ssaIncome = baseSsaAtStartAge * ssaMultiplier * inflationFromSsaStart
    }
    
    // Spouse SSA income
    // If spouse birth year or life expectancy is not provided, use planner's values
    let spouseSsaIncome = 0
    if (includeSpouseSsa) {
      // Use spouse values if provided, otherwise fall back to planner values
      const effectiveSpouseBirthYear = spouseBirthYear || birthYear
      const effectiveSpouseLifeExpectancy = spouseLifeExpectancy || projectionEndAge
      
      // Calculate spouse's age: current year - spouse birth year
      // Current year = birthYear + age, so spouse age = (birthYear + age) - effectiveSpouseBirthYear
      const spouseAge = (birthYear + age) - effectiveSpouseBirthYear
      const spouseSsaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
      const spouseSsaStartYear = effectiveSpouseBirthYear + spouseSsaStartAge
      
      if (spouseAge >= spouseSsaStartAge && spouseAge <= effectiveSpouseLifeExpectancy) {
        // Calculate base SSA amount at start age
        // If estimated amount provided, use it; otherwise use default $15k
        const baseSpouseSsaAtStartAge = estimatedSpouseSsaAtStartAge || SSA_DEFAULT_SPOUSE_BENEFIT
        
        const spouseSsaMultiplier = ssaClaimingMultiplier(spouseSsaStartAge)
        
        // Apply inflation from spouse SSA start year to current year
        const yearsSinceSpouseSsaStart = year - spouseSsaStartYear
        const inflationFromSpouseSsaStart = Math.pow(1 + settings.inflation_rate, Math.max(0, yearsSinceSpouseSsaStart))
        
        spouseSsaIncome = baseSpouseSsaAtStartAge * spouseSsaMultiplier * inflationFromSpouseSsaStart
      }
    }
    
    // Combine SSA incomes
    const totalSsaIncome = ssaIncome + spouseSsaIncome
    
    // Other recurring income
    otherIncome.forEach(income => {
      if (income.start_year && year < income.start_year) return
      if (income.end_year && year > income.end_year) return
      
      let amount = income.amount || 0
      if (income.inflation_adjusted) {
        amount = amount * inflationMultiplier
      }
      otherRecurringIncome += amount
    })
    
    // Calculate distributions needed to cover expenses AND taxes
    // We need to estimate taxes first, then withdraw enough to cover both expenses and taxes
    // Initial estimate: assume we need to withdraw enough to cover expenses
    // Taxes will be calculated on withdrawals, so we need to account for that
    const totalLivingAndHealthcare = livingExpenses + healthcareExpenses
    const initialExpensesToCover = totalLivingAndHealthcare - totalSsaIncome - otherRecurringIncome
    
    // Estimate taxes on initial withdrawal using IRS tax brackets
    // Estimate based on expected income level (SSA + other income + initial withdrawal estimate)
    const estimatedTotalIncome = totalSsaIncome + otherRecurringIncome + Math.max(0, initialExpensesToCover)
    const estimatedTaxRate = estimateMarginalTaxRate(estimatedTotalIncome, filingStatus)
    const estimatedTaxOnWithdrawals = initialExpensesToCover > 0 ? initialExpensesToCover * estimatedTaxRate : 0
    
    // Total amount needed: expenses + estimated taxes
    const expensesToCover = initialExpensesToCover + estimatedTaxOnWithdrawals
    
    // Required Minimum Distribution (RMD) starts at age 73
    const rmdAge = RMD_START_AGE
    const requiresRMD = age >= rmdAge
    
    // Calculate RMD if required (simplified: balance / life expectancy factor)
    // Life expectancy factor roughly: 27.4 at 73, decreases each year
    let requiredRMD = 0
    if (requiresRMD) {
      const lifeExpectancyFactor = Math.max(1, RMD_LIFE_EXPECTANCY_FACTOR_AT_73 - (age - RMD_START_AGE))
      const totalTraditionalBalance = accountBalances['401k'] + accountBalances['IRA']
      requiredRMD = totalTraditionalBalance / lifeExpectancyFactor
    }
    
    // Calculate current situation metrics (before withdrawals)
    const totalNetworth = accountBalances['401k'] + accountBalances['IRA'] + accountBalances['Roth IRA'] + 
                         accountBalances['Taxable'] + accountBalances['HSA'] + accountBalances['Other']
    
    // Track initial portfolio value for 4% rule (first year of retirement, before any withdrawals)
    const isFirstRetirementYear = isRetired && yearsSinceRetirement === 1
    if (isFirstRetirementYear && initialRetirementPortfolioValue === null) {
      initialRetirementPortfolioValue = totalNetworth
    }
    const initialPortfolioValue = initialRetirementPortfolioValue || totalNetworth
    
    if (isRetired && expensesToCover > 0) {
      let remainingNeed = expensesToCover
      
      // Get strategy type (default to amount_based_expense_coverage if not specified)
      const strategyType = settings.withdrawal_strategy_type || 'amount_based_expense_coverage'
      
      // Calculate current situation metrics
      const yearsRemaining = projectionEndAge - age
      const traditionalBalance = accountBalances['401k'] + accountBalances['IRA']
      const rothBalance = accountBalances['Roth IRA']
      const taxableBalance = accountBalances['Taxable']
      const hsaBalance = accountBalances['HSA']
      
      // Handle RMDs first if required (mandatory by law, except for QCD strategy)
      if (requiresRMD && requiredRMD > 0 && strategyType !== 'tax_qcd') {
        const totalTraditionalBalance = accountBalances['401k'] + accountBalances['IRA']
        if (totalTraditionalBalance > 0) {
          const rmdFrom401k = (accountBalances['401k'] / totalTraditionalBalance) * requiredRMD
          const rmdFromIRA = (accountBalances['IRA'] / totalTraditionalBalance) * requiredRMD
          
          const actual401kRMD = Math.min(rmdFrom401k, accountBalances['401k'])
          const actualIRARMD = Math.min(rmdFromIRA, accountBalances['IRA'])
          
          distribution401k = actual401kRMD
          distributionIra = actualIRARMD
          accountBalances['401k'] -= actual401kRMD
          accountBalances['IRA'] -= actualIRARMD
          
          // Adjust remaining need after RMDs
          const totalRmd = distribution401k + distributionIra
          if (totalRmd >= expensesToCover) {
            remainingNeed = 0 // RMD covers everything
          } else {
            remainingNeed = expensesToCover - totalRmd
          }
        }
      }
      
      // Calculate target withdrawal amount based on strategy type
      // For amount-based strategies, we use the strategy's target amount
      // For other strategies, we use the remaining need
      let useStrategyAmount = false
      let targetWithdrawalAmount = remainingNeed
      
      if (strategyType === 'amount_based_expense_coverage') {
        // Expense Based - Cover Expenses and Tax: Withdraw enough to cover expenses plus estimated tax
        useStrategyAmount = true
        const totalExpenses = totalLivingAndHealthcare
        const otherIncomeTotal = totalSsaIncome + otherRecurringIncome
        const expensesNeedingCoverage = Math.max(0, totalExpenses - otherIncomeTotal)
        
        // Estimate tax on withdrawal - use iterative approach to account for tax on withdrawal itself
        // Start with a rough estimate: assume 20% effective tax rate on withdrawal
        let estimatedTax = expensesNeedingCoverage * DEFAULT_ESTIMATED_TAX_RATE
        let grossWithdrawalNeeded = expensesNeedingCoverage + estimatedTax
        
        // Refine estimate: calculate actual tax on the withdrawal
        // Estimate taxable income from withdrawal (assume mostly from tax-deferred accounts)
        const estimatedTaxableIncome = otherRecurringIncome + grossWithdrawalNeeded * 0.7 // Assume 70% from tax-deferred
        const standardDeduction = getStandardDeduction(filingStatus)
        const adjustedIncome = Math.max(0, estimatedTaxableIncome - standardDeduction)
        const estimatedTaxOnWithdrawal = calculateProgressiveTax(adjustedIncome, filingStatus)
        const estimatedCapitalGains = grossWithdrawalNeeded * DEFAULT_TAXABLE_ACCOUNT_RATIO
        const estimatedCapGainsTax = calculateCapitalGainsTax(estimatedCapitalGains, filingStatus)
        const taxOnOtherIncome = otherRecurringIncome > 0 ? calculateProgressiveTax(Math.max(0, otherRecurringIncome - standardDeduction), filingStatus) : 0
        estimatedTax = estimatedTaxOnWithdrawal + estimatedCapGainsTax - taxOnOtherIncome
        
        // Final calculation: expenses + tax (ensure we cover everything)
        targetWithdrawalAmount = expensesNeedingCoverage + Math.max(0, estimatedTax)
      } else if (strategyType === 'amount_based_4_percent') {
        // 4% Rule: 4% of initial portfolio in year 1, then adjust for inflation
        useStrategyAmount = true
        if (isFirstRetirementYear) {
          targetWithdrawalAmount = initialPortfolioValue * SAFE_WITHDRAWAL_RATE
        } else {
          const firstYearWithdrawal = initialPortfolioValue * SAFE_WITHDRAWAL_RATE
          targetWithdrawalAmount = firstYearWithdrawal * Math.pow(1 + settings.inflation_rate, yearsSinceRetirement - 1)
        }
      } else if (strategyType === 'amount_based_fixed_percentage') {
        // Fixed Percentage: Set percentage of current portfolio value
        useStrategyAmount = true
        const percentage = settings.fixed_percentage_rate || SAFE_WITHDRAWAL_RATE
        targetWithdrawalAmount = totalNetworth * percentage
      } else if (strategyType === 'amount_based_fixed_dollar') {
        // Fixed Dollar: Specific dollar amount regardless of market
        useStrategyAmount = true
        targetWithdrawalAmount = settings.fixed_dollar_amount || DEFAULT_FIXED_DOLLAR_WITHDRAWAL
      } else if (strategyType === 'amount_based_swp') {
        // SWP: Only withdraw earnings (dividends/interest)
        // Estimate earnings as a percentage of portfolio (simplified)
        useStrategyAmount = true
        const earningsRate = settings.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT
        targetWithdrawalAmount = totalNetworth * earningsRate
      } else if (strategyType === 'market_guardrails') {
        // Guardrails: Set ceiling and floor based on market performance
        useStrategyAmount = true
        const ceiling = settings.guardrails_ceiling || GUARDRAIL_CEILING
        const floor = settings.guardrails_floor || GUARDRAIL_FLOOR
        // Simplified: use base rate, adjust based on portfolio performance vs initial
        const baseRate = 0.045 // 4.5% base
        const portfolioPerformance = initialPortfolioValue > 0 ? totalNetworth / initialPortfolioValue : 1.0
        let adjustedRate = baseRate
        if (portfolioPerformance > 1.1) {
          // Portfolio up >10%, can take raise (up to ceiling)
          adjustedRate = Math.min(ceiling, baseRate * 1.1)
        } else if (portfolioPerformance < 0.9) {
          // Portfolio down >10%, reduce to floor
          adjustedRate = Math.max(floor, baseRate * 0.9)
        }
        targetWithdrawalAmount = totalNetworth * adjustedRate
      }
      
      // For amount-based strategies, use the strategy's target amount
      // This means we may withdraw less than needed (creating a shortfall) or more than needed
      if (useStrategyAmount) {
        // Calculate total income from other sources
        const otherIncomeTotal = totalSsaIncome + otherRecurringIncome
        // The strategy amount is the total withdrawal target (including other income)
        // We need to withdraw from accounts: targetWithdrawalAmount - otherIncomeTotal
        // Always use the strategy amount, even if it's less than needed (this creates shortfalls)
        remainingNeed = Math.max(0, targetWithdrawalAmount - otherIncomeTotal)
      }
      // For other strategies, remainingNeed stays as calculated (expenses - other income)
      
      // Execute withdrawals based on strategy type
      if (strategyType === 'sequence_proportional') {
        // Proportional: Withdraw from all account types proportionally
        const totalBalance = totalNetworth
        if (totalBalance > 0 && remainingNeed > 0) {
          if (accountBalances['401k'] > 0) {
            const proportional401k = (accountBalances['401k'] / totalBalance) * remainingNeed
            const withdrawal401k = Math.min(proportional401k, accountBalances['401k'])
            distribution401k += withdrawal401k
            accountBalances['401k'] -= withdrawal401k
            remainingNeed -= withdrawal401k
          }
          if (accountBalances['IRA'] > 0 && remainingNeed > 0) {
            const proportionalIRA = (accountBalances['IRA'] / totalBalance) * remainingNeed
            const withdrawalIRA = Math.min(proportionalIRA, accountBalances['IRA'])
            distributionIra += withdrawalIRA
            accountBalances['IRA'] -= withdrawalIRA
            remainingNeed -= withdrawalIRA
          }
          if (accountBalances['Roth IRA'] > 0 && remainingNeed > 0) {
            const proportionalRoth = (accountBalances['Roth IRA'] / totalBalance) * remainingNeed
            const withdrawalRoth = Math.min(proportionalRoth, accountBalances['Roth IRA'])
            distributionRoth += withdrawalRoth
            accountBalances['Roth IRA'] -= withdrawalRoth
            remainingNeed -= withdrawalRoth
          }
          if (accountBalances['Taxable'] > 0 && remainingNeed > 0) {
            const proportionalTaxable = (accountBalances['Taxable'] / totalBalance) * remainingNeed
            const withdrawalTaxable = Math.min(proportionalTaxable, accountBalances['Taxable'])
            distributionTaxable += withdrawalTaxable
            accountBalances['Taxable'] -= withdrawalTaxable
            remainingNeed -= withdrawalTaxable
          }
          if (accountBalances['HSA'] > 0 && remainingNeed > 0) {
            const proportionalHsa = (accountBalances['HSA'] / totalBalance) * remainingNeed
            const withdrawalHsa = Math.min(proportionalHsa, accountBalances['HSA'])
            distributionHsa += withdrawalHsa
            accountBalances['HSA'] -= withdrawalHsa
            remainingNeed -= withdrawalHsa
          }
          if (accountBalances['Other'] > 0 && remainingNeed > 0) {
            const proportionalOther = (accountBalances['Other'] / totalBalance) * remainingNeed
            const withdrawalOther = Math.min(proportionalOther, accountBalances['Other'])
            distributionOther += withdrawalOther
            accountBalances['Other'] -= withdrawalOther
            remainingNeed -= withdrawalOther
          }
        }
      } else if (strategyType === 'sequence_bracket_topping') {
        // Bracket-Topping: Fill low tax bracket with tax-deferred, then use taxable/Roth
        const bracketThreshold = settings.bracket_topping_threshold || 12 // 12% bracket
        // Simplified: estimate taxable income from traditional accounts to fill bracket
        // Assume we want to fill up to bracket threshold
        const estimatedBracketIncome = 50000 // Simplified threshold amount
        const currentTaxableIncome = distribution401k + distributionIra + otherRecurringIncome
        
        if (currentTaxableIncome < estimatedBracketIncome && traditionalBalance > 0) {
          // Fill bracket with traditional accounts first
          const bracketFillAmount = estimatedBracketIncome - currentTaxableIncome
          if (accountBalances['401k'] > 0 && remainingNeed > 0) {
            const withdrawal401k = Math.min(remainingNeed, accountBalances['401k'], bracketFillAmount)
            distribution401k += withdrawal401k
            accountBalances['401k'] -= withdrawal401k
            remainingNeed -= withdrawal401k
          }
          if (accountBalances['IRA'] > 0 && remainingNeed > 0) {
            const withdrawalIRA = Math.min(remainingNeed, accountBalances['IRA'], bracketFillAmount - distribution401k)
            distributionIra += withdrawalIRA
            accountBalances['IRA'] -= withdrawalIRA
            remainingNeed -= withdrawalIRA
          }
        }
        // Then use taxable and Roth for remaining need
        if (remainingNeed > 0 && accountBalances['Taxable'] > 0) {
          const withdrawalTaxable = Math.min(remainingNeed, accountBalances['Taxable'])
          distributionTaxable += withdrawalTaxable
          accountBalances['Taxable'] -= withdrawalTaxable
          remainingNeed -= withdrawalTaxable
        }
        if (remainingNeed > 0 && accountBalances['Roth IRA'] > 0) {
          const withdrawalRoth = Math.min(remainingNeed, accountBalances['Roth IRA'])
          distributionRoth += withdrawalRoth
          accountBalances['Roth IRA'] -= withdrawalRoth
          remainingNeed -= withdrawalRoth
        }
        if (remainingNeed > 0 && accountBalances['HSA'] > 0) {
          const withdrawalHsa = Math.min(remainingNeed, accountBalances['HSA'])
          distributionHsa += withdrawalHsa
          accountBalances['HSA'] -= withdrawalHsa
          remainingNeed -= withdrawalHsa
        }
        if (remainingNeed > 0 && accountBalances['Other'] > 0) {
          const withdrawalOther = Math.min(remainingNeed, accountBalances['Other'])
          distributionOther += withdrawalOther
          accountBalances['Other'] -= withdrawalOther
          remainingNeed -= withdrawalOther
        }
      } else if (strategyType === 'market_bucket') {
        // Bucket Strategy: Cash (1-3y), Fixed Income (3-10y), Equities (10+y)
        // Simplified: Use Taxable/HSA for short-term (Bucket 1), Traditional for medium (Bucket 2), Roth for long-term (Bucket 3)
        const yearsInRetirement = yearsSinceRetirement
        if (yearsInRetirement <= 3) {
          // Bucket 1: Use Taxable and HSA first
          if (remainingNeed > 0 && accountBalances['Taxable'] > 0) {
            const withdrawalTaxable = Math.min(remainingNeed, accountBalances['Taxable'])
            distributionTaxable += withdrawalTaxable
            accountBalances['Taxable'] -= withdrawalTaxable
            remainingNeed -= withdrawalTaxable
          }
          if (remainingNeed > 0 && accountBalances['HSA'] > 0) {
            const withdrawalHsa = Math.min(remainingNeed, accountBalances['HSA'])
            distributionHsa += withdrawalHsa
            accountBalances['HSA'] -= withdrawalHsa
            remainingNeed -= withdrawalHsa
          }
        } else if (yearsInRetirement <= 10) {
          // Bucket 2: Use Traditional accounts
          if (remainingNeed > 0 && accountBalances['401k'] > 0) {
            const withdrawal401k = Math.min(remainingNeed, accountBalances['401k'])
            distribution401k += withdrawal401k
            accountBalances['401k'] -= withdrawal401k
            remainingNeed -= withdrawal401k
          }
          if (remainingNeed > 0 && accountBalances['IRA'] > 0) {
            const withdrawalIRA = Math.min(remainingNeed, accountBalances['IRA'])
            distributionIra += withdrawalIRA
            accountBalances['IRA'] -= withdrawalIRA
            remainingNeed -= withdrawalIRA
          }
        } else {
          // Bucket 3: Use Roth for long-term
          if (remainingNeed > 0 && accountBalances['Roth IRA'] > 0) {
            const withdrawalRoth = Math.min(remainingNeed, accountBalances['Roth IRA'])
            distributionRoth += withdrawalRoth
            accountBalances['Roth IRA'] -= withdrawalRoth
            remainingNeed -= withdrawalRoth
          }
        }
        // Fallback to any remaining accounts
        if (remainingNeed > 0) {
          if (accountBalances['Taxable'] > 0) {
            const withdrawalTaxable = Math.min(remainingNeed, accountBalances['Taxable'])
            distributionTaxable += withdrawalTaxable
            accountBalances['Taxable'] -= withdrawalTaxable
            remainingNeed -= withdrawalTaxable
          }
          if (accountBalances['401k'] > 0 && remainingNeed > 0) {
            const withdrawal401k = Math.min(remainingNeed, accountBalances['401k'])
            distribution401k += withdrawal401k
            accountBalances['401k'] -= withdrawal401k
            remainingNeed -= withdrawal401k
          }
          if (accountBalances['IRA'] > 0 && remainingNeed > 0) {
            const withdrawalIRA = Math.min(remainingNeed, accountBalances['IRA'])
            distributionIra += withdrawalIRA
            accountBalances['IRA'] -= withdrawalIRA
            remainingNeed -= withdrawalIRA
          }
          if (accountBalances['Other'] > 0 && remainingNeed > 0) {
            const withdrawalOther = Math.min(remainingNeed, accountBalances['Other'])
            distributionOther += withdrawalOther
            accountBalances['Other'] -= withdrawalOther
            remainingNeed -= withdrawalOther
          }
        }
      } else if (strategyType === 'market_floor_upside') {
        // Floor-and-Upside: Guaranteed income for essentials, portfolio for discretionary
        // Use SSA + other income for essentials, portfolio for remaining
        const essentialExpenses = totalLivingAndHealthcare * 0.7 // Assume 70% are essential
        const guaranteedIncome = totalSsaIncome + otherRecurringIncome
        const essentialShortfall = Math.max(0, essentialExpenses - guaranteedIncome)
        const discretionaryNeed = remainingNeed - essentialShortfall
        
        // Cover essential shortfall first from portfolio
        if (essentialShortfall > 0) {
          // Use tax-efficient order for essentials
          if (accountBalances['Taxable'] > 0) {
            const withdrawalTaxable = Math.min(essentialShortfall, accountBalances['Taxable'])
            distributionTaxable += withdrawalTaxable
            accountBalances['Taxable'] -= withdrawalTaxable
            remainingNeed -= withdrawalTaxable
          }
          if (accountBalances['HSA'] > 0 && remainingNeed > 0) {
            const withdrawalHsa = Math.min(remainingNeed, accountBalances['HSA'])
            distributionHsa += withdrawalHsa
            accountBalances['HSA'] -= withdrawalHsa
            remainingNeed -= withdrawalHsa
          }
          if (accountBalances['401k'] > 0 && remainingNeed > 0) {
            const withdrawal401k = Math.min(remainingNeed, accountBalances['401k'])
            distribution401k += withdrawal401k
            accountBalances['401k'] -= withdrawal401k
            remainingNeed -= withdrawal401k
          }
          if (accountBalances['IRA'] > 0 && remainingNeed > 0) {
            const withdrawalIRA = Math.min(remainingNeed, accountBalances['IRA'])
            distributionIra += withdrawalIRA
            accountBalances['IRA'] -= withdrawalIRA
            remainingNeed -= withdrawalIRA
          }
        }
        // Then use Roth for discretionary
        if (remainingNeed > 0 && accountBalances['Roth IRA'] > 0) {
          const withdrawalRoth = Math.min(remainingNeed, accountBalances['Roth IRA'])
          distributionRoth += withdrawalRoth
          accountBalances['Roth IRA'] -= withdrawalRoth
          remainingNeed -= withdrawalRoth
        }
        if (remainingNeed > 0 && accountBalances['Other'] > 0) {
          const withdrawalOther = Math.min(remainingNeed, accountBalances['Other'])
          distributionOther += withdrawalOther
          accountBalances['Other'] -= withdrawalOther
          remainingNeed -= withdrawalOther
        }
      } else if (strategyType === 'tax_roth_conversion') {
        // Roth Conversion Bridge: Convert Traditional to Roth before RMD age
        if (age < rmdAge) {
          // Convert a portion of traditional to Roth each year (simplified: convert 10% or $10k, whichever is less)
          const conversionAmount = Math.min(ROTH_CONVERSION_MAX, traditionalBalance * ROTH_CONVERSION_FRACTION)
          if (conversionAmount > 0 && traditionalBalance > 0) {
            if (accountBalances['401k'] > 0) {
              const convertFrom401k = Math.min(conversionAmount * (accountBalances['401k'] / traditionalBalance), accountBalances['401k'])
              accountBalances['401k'] -= convertFrom401k
              accountBalances['Roth IRA'] += convertFrom401k * (1 - DEFAULT_ROTH_CONVERSION_TAX_RATE)
              distribution401k += convertFrom401k * DEFAULT_ROTH_CONVERSION_TAX_RATE
            }
            if (accountBalances['IRA'] > 0) {
              const convertFromIRA = Math.min(conversionAmount * (accountBalances['IRA'] / traditionalBalance), accountBalances['IRA'])
              accountBalances['IRA'] -= convertFromIRA
              accountBalances['Roth IRA'] += convertFromIRA * (1 - DEFAULT_ROTH_CONVERSION_TAX_RATE)
              distributionIra += convertFromIRA * DEFAULT_ROTH_CONVERSION_TAX_RATE
            }
          }
        }
        // Then use standard tax-efficient withdrawal order
        const priority = settings.withdrawal_priority || 'default'
        const secondaryPriority = settings.withdrawal_secondary_priority || 'tax_optimization'
        const withdrawalOrder = determineWithdrawalOrder(
          priority,
          secondaryPriority,
          age,
          rmdAge,
          requiresRMD,
          requiredRMD,
          remainingNeed,
          accountBalances,
          yearsRemaining,
          totalNetworth
        )
        for (const accountType of withdrawalOrder) {
          if (remainingNeed <= 0) break
          let withdrawal = 0
          switch (accountType) {
            case '401k':
              if (accountBalances['401k'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['401k'])
                distribution401k += withdrawal
                accountBalances['401k'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'IRA':
              if (accountBalances['IRA'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['IRA'])
                distributionIra += withdrawal
                accountBalances['IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Roth IRA':
              if (accountBalances['Roth IRA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Roth IRA'])
                distributionRoth += withdrawal
                accountBalances['Roth IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Taxable':
              if (accountBalances['Taxable'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Taxable'])
                distributionTaxable += withdrawal
                accountBalances['Taxable'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'HSA':
              if (accountBalances['HSA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['HSA'])
                distributionHsa += withdrawal
                accountBalances['HSA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Other':
              if (accountBalances['Other'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Other'])
                distributionOther += withdrawal
                accountBalances['Other'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
          }
        }
      } else if (strategyType === 'tax_qcd') {
        // QCDs: After age 70½, send IRA distributions directly to charity
        if (age >= 70.5 && requiredRMD > 0) {
          // QCD can satisfy RMD up to $100k/year (simplified: use 50% of RMD for QCD)
          const qcdAmount = Math.min(requiredRMD * QCD_FRACTION_OF_RMD, QCD_MAX_ANNUAL)
          if (accountBalances['IRA'] > 0) {
            const qcdFromIRA = Math.min(qcdAmount, accountBalances['IRA'])
            distributionIra += qcdFromIRA
            accountBalances['IRA'] -= qcdFromIRA
            // QCD is not taxable, so reduce taxable income
            remainingNeed = Math.max(0, remainingNeed - qcdFromIRA)
          }
          // Remaining RMD must still be taken
          const remainingRMD = requiredRMD - qcdAmount
          if (remainingRMD > 0) {
            const totalTraditionalBalance = accountBalances['401k'] + accountBalances['IRA']
            if (totalTraditionalBalance > 0) {
              const rmdFrom401k = (accountBalances['401k'] / totalTraditionalBalance) * remainingRMD
              const rmdFromIRA = (accountBalances['IRA'] / totalTraditionalBalance) * remainingRMD
              const actual401kRMD = Math.min(rmdFrom401k, accountBalances['401k'])
              const actualIRARMD = Math.min(rmdFromIRA, accountBalances['IRA'])
              distribution401k += actual401kRMD
              distributionIra += actualIRARMD
              accountBalances['401k'] -= actual401kRMD
              accountBalances['IRA'] -= actualIRARMD
            }
          }
        }
        // Then use standard withdrawal for remaining need
        const priority = settings.withdrawal_priority || 'default'
        const secondaryPriority = settings.withdrawal_secondary_priority || 'tax_optimization'
        const withdrawalOrder = determineWithdrawalOrder(
          priority,
          secondaryPriority,
          age,
          rmdAge,
          requiresRMD,
          requiredRMD,
          remainingNeed,
          accountBalances,
          yearsRemaining,
          totalNetworth
        )
        for (const accountType of withdrawalOrder) {
          if (remainingNeed <= 0) break
          let withdrawal = 0
          switch (accountType) {
            case '401k':
              if (accountBalances['401k'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['401k'])
                distribution401k += withdrawal
                accountBalances['401k'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'IRA':
              if (accountBalances['IRA'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['IRA'])
                distributionIra += withdrawal
                accountBalances['IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Roth IRA':
              if (accountBalances['Roth IRA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Roth IRA'])
                distributionRoth += withdrawal
                accountBalances['Roth IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Taxable':
              if (accountBalances['Taxable'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Taxable'])
                distributionTaxable += withdrawal
                accountBalances['Taxable'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'HSA':
              if (accountBalances['HSA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['HSA'])
                distributionHsa += withdrawal
                accountBalances['HSA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Other':
              if (accountBalances['Other'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Other'])
                distributionOther += withdrawal
                accountBalances['Other'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
          }
        }
      } else {
        // Goal-based strategy (default) - use existing logic
        const priority = settings.withdrawal_priority || 'default'
        const secondaryPriority = settings.withdrawal_secondary_priority || 'tax_optimization'
        const withdrawalOrder = determineWithdrawalOrder(
          priority,
          secondaryPriority,
          age,
          rmdAge,
          requiresRMD,
          requiredRMD,
          remainingNeed,
          accountBalances,
          yearsRemaining,
          totalNetworth
        )
        for (const accountType of withdrawalOrder) {
          if (remainingNeed <= 0) break
          let withdrawal = 0
          switch (accountType) {
            case '401k':
              if (accountBalances['401k'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['401k'])
                distribution401k += withdrawal
                accountBalances['401k'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'IRA':
              if (accountBalances['IRA'] > 0 && (!requiresRMD || requiredRMD === 0)) {
                withdrawal = Math.min(remainingNeed, accountBalances['IRA'])
                distributionIra += withdrawal
                accountBalances['IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Roth IRA':
              if (accountBalances['Roth IRA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Roth IRA'])
                distributionRoth += withdrawal
                accountBalances['Roth IRA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Taxable':
              if (accountBalances['Taxable'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Taxable'])
                distributionTaxable += withdrawal
                accountBalances['Taxable'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'HSA':
              if (accountBalances['HSA'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['HSA'])
                distributionHsa += withdrawal
                accountBalances['HSA'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
            case 'Other':
              if (accountBalances['Other'] > 0) {
                withdrawal = Math.min(remainingNeed, accountBalances['Other'])
                distributionOther += withdrawal
                accountBalances['Other'] -= withdrawal
                remainingNeed -= withdrawal
              }
              break
          }
        }
      }
    } else if (isRetired && requiresRMD && requiredRMD > 0 && expensesToCover <= 0) {
      // Even if expenses are covered, must take RMDs after age 73 (unless QCD strategy)
      const strategyType = settings.withdrawal_strategy_type || 'amount_based_expense_coverage'
      if (strategyType !== 'tax_qcd') {
        const totalTraditionalBalance = accountBalances['401k'] + accountBalances['IRA']
        if (totalTraditionalBalance > 0) {
          const rmdFrom401k = (accountBalances['401k'] / totalTraditionalBalance) * requiredRMD
          const rmdFromIRA = (accountBalances['IRA'] / totalTraditionalBalance) * requiredRMD
          
          const actual401kRMD = Math.min(rmdFrom401k, accountBalances['401k'])
          const actualIRARMD = Math.min(rmdFromIRA, accountBalances['IRA'])
          
          distribution401k = actual401kRMD
          distributionIra = actualIRARMD
          accountBalances['401k'] -= actual401kRMD
          accountBalances['IRA'] -= actualIRARMD
        }
      }
    }
    
    // Investment income (dividends, interest) - NOT INCLUDED
    // Removed per user request - only account for withdrawals, not passive income
    
    // Calculate total income (include all distributions)
    let totalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                       distributionHsa + distributionIra + distributionOther + otherRecurringIncome
    
    // Calculate taxable income (401k, IRA, Taxable distributions, and other recurring income)
    const taxableIncome = distribution401k + distributionIra + distributionTaxable + otherRecurringIncome
    
    // Calculate taxes using progressive brackets and standard deductions
    // Filing status was determined at function start
    
    // Calculate taxable income after standard deduction
    // 2024 standard deductions: Single = $14,600, Married Filing Jointly = $29,200
    const standardDeduction = getStandardDeduction(filingStatus)
    
    // Taxable income = distributions from traditional accounts + other recurring income - standard deduction
    // Note: SSA income may be partially taxable, but for simplicity we'll exclude it from taxable income
    // Capital gains from taxable accounts are taxed separately at capital gains rates
    const ordinaryIncome = distribution401k + distributionIra + otherRecurringIncome
    const taxableIncomeAfterDeduction = Math.max(0, ordinaryIncome - standardDeduction)
    
    // Calculate income tax using progressive brackets (2024 rates)
    const incomeTax = calculateProgressiveTax(taxableIncomeAfterDeduction, filingStatus)
    
    // Capital gains tax on taxable account distributions (long-term capital gains rates)
    // 2024 long-term capital gains brackets (for taxable accounts)
    const capitalGainsTax = calculateCapitalGainsTax(distributionTaxable, filingStatus)
    
    let tax = incomeTax + capitalGainsTax
    
    // If after-tax income doesn't cover expenses, withdraw more (prefer Roth since it's tax-free)
    // This is critical: we must always cover expenses + taxes, but withdraw exactly enough
    if (isRetired) {
      let iterations = 0
      const maxIterations = 10 // Allow more iterations for precision
      
      while (iterations < maxIterations) {
        // Recalculate taxes with current distributions
        // Include taxable portion of SSA income
        const taxableSsaPortion = totalSsaIncome * SSA_TAXABLE_PORTION // 50% of SSA is typically taxable
        const currentOrdinaryIncome = distribution401k + distributionIra + otherRecurringIncome + taxableSsaPortion
        const currentTaxableIncomeAfterDeduction = Math.max(0, currentOrdinaryIncome - standardDeduction)
        const currentIncomeTax = calculateProgressiveTax(currentTaxableIncomeAfterDeduction, filingStatus)
        const currentCapitalGainsTax = calculateCapitalGainsTax(distributionTaxable, filingStatus)
        const currentTax = currentIncomeTax + currentCapitalGainsTax
        
        // Recalculate total income
        const currentTotalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                                  distributionHsa + distributionIra + distributionOther + otherRecurringIncome
        
        const afterTaxIncome = currentTotalIncome - currentTax
        const shortfall = totalLivingAndHealthcare - afterTaxIncome
        
        // If we're within $1 of covering expenses, we're done (allow small rounding)
        if (shortfall <= 1) {
          tax = currentTax
          totalIncome = currentTotalIncome
          break
        }
        
        // If shortfall is negative (we have excess), we're done
        if (shortfall < 0) {
          tax = currentTax
          totalIncome = currentTotalIncome
          break
        }
        
        // Need to withdraw more to cover the shortfall
        let additionalNeed = shortfall
        
        // Withdraw additional from Roth (tax-free) first - best option
        if (additionalNeed > 0 && accountBalances['Roth IRA'] > 0) {
          const additionalRoth = Math.min(additionalNeed, accountBalances['Roth IRA'])
          distributionRoth += additionalRoth
          accountBalances['Roth IRA'] -= additionalRoth
          totalIncome += additionalRoth
          // No tax on Roth, so additionalNeed is fully covered
          additionalNeed -= additionalRoth
        }
        
        // If still needed, withdraw from taxable (will incur capital gains tax)
        if (additionalNeed > 0 && accountBalances['Taxable'] > 0) {
          // Estimate capital gains tax rate based on current income
          const currentTaxableIncome = distribution401k + distributionIra + otherRecurringIncome
          const estimatedCapGainsRate = estimateCapitalGainsTaxRate(currentTaxableIncome, filingStatus)
          
          // Need to withdraw enough to cover the shortfall plus the tax on the withdrawal
          // Net needed = gross * (1 - taxRate), so gross = net / (1 - taxRate)
          const grossNeeded = additionalNeed / (1 - estimatedCapGainsRate)
          const additionalTaxable = Math.min(grossNeeded, accountBalances['Taxable'])
          
          if (additionalTaxable > 0) {
            distributionTaxable += additionalTaxable
            accountBalances['Taxable'] -= additionalTaxable
            totalIncome += additionalTaxable
            // Tax will be recalculated in next iteration
          }
        }
        
        // If still needed, withdraw from traditional accounts (will incur income tax)
        if (additionalNeed > 0) {
          const currentTaxableIncome = distribution401k + distributionIra + otherRecurringIncome
          const estimatedMarginalRate = estimateMarginalTaxRate(currentTaxableIncome, filingStatus)
          
          // Need to withdraw enough to cover the shortfall plus the tax on the withdrawal
          const grossNeeded = additionalNeed / (1 - estimatedMarginalRate)
          
          if (accountBalances['401k'] > 0) {
            const additional401k = Math.min(grossNeeded, accountBalances['401k'])
            if (additional401k > 0) {
              distribution401k += additional401k
              accountBalances['401k'] -= additional401k
              totalIncome += additional401k
              // Tax will be recalculated in next iteration
            }
          }
          
          if (additionalNeed > 0 && accountBalances['IRA'] > 0) {
            // Recalculate gross needed based on remaining need
            const remainingTaxableIncome = distribution401k + distributionIra + otherRecurringIncome
            const remainingMarginalRate = estimateMarginalTaxRate(remainingTaxableIncome, filingStatus)
            const remainingGrossNeeded = additionalNeed / (1 - remainingMarginalRate)
            
            const additionalIRA = Math.min(remainingGrossNeeded, accountBalances['IRA'])
            if (additionalIRA > 0) {
              distributionIra += additionalIRA
              accountBalances['IRA'] -= additionalIRA
              totalIncome += additionalIRA
              // Tax will be recalculated in next iteration
            }
          }
        }
        
        // If still needed and we have HSA, use it (tax-free for qualified expenses)
        if (additionalNeed > 0 && accountBalances['HSA'] > 0) {
          const additionalHsa = Math.min(additionalNeed, accountBalances['HSA'])
          if (additionalHsa > 0) {
            distributionHsa += additionalHsa
            accountBalances['HSA'] -= additionalHsa
            totalIncome += additionalHsa
            // No tax on HSA, so additionalNeed is fully covered
            additionalNeed -= additionalHsa
          }
        }
        
        // If still needed, use Other accounts
        if (additionalNeed > 0 && accountBalances['Other'] > 0) {
          const additionalOther = Math.min(additionalNeed, accountBalances['Other'])
          if (additionalOther > 0) {
            distributionOther += additionalOther
            accountBalances['Other'] -= additionalOther
            totalIncome += additionalOther
            // No tax on Other, so additionalNeed is fully covered
            additionalNeed -= additionalOther
          }
        }
        
        // If we still have a shortfall and no more assets, break
        const currentTotalNetworth = accountBalances['401k'] + accountBalances['IRA'] + accountBalances['Roth IRA'] + 
                                    accountBalances['Taxable'] + accountBalances['HSA'] + accountBalances['Other']
        if (additionalNeed > 0 && currentTotalNetworth <= 0) {
          break
        }
        
        iterations++
      }
      
      // Final tax recalculation after all withdrawals
      // Include taxable portion of SSA income in taxable income calculation
      const taxableSsaPortion = totalSsaIncome * SSA_TAXABLE_PORTION // 50% of SSA is typically taxable
      const finalOrdinaryIncome = distribution401k + distributionIra + otherRecurringIncome + taxableSsaPortion
      const finalTaxableIncomeAfterDeduction = Math.max(0, finalOrdinaryIncome - standardDeduction)
      const finalIncomeTax = calculateProgressiveTax(finalTaxableIncomeAfterDeduction, filingStatus)
      
      // Calculate capital gains tax on gains only (not principal)
      let finalTaxableCapitalGains = 0
      if (distributionTaxable > 0) {
        const taxableBalance = accountBalances['Taxable'] + distributionTaxable // Balance before withdrawal
        if (taxableBalance > 0) {
          const withdrawalRatio = distributionTaxable / taxableBalance
          const principalWithdrawn = taxableAccountBasis.principal * withdrawalRatio
          const gainsWithdrawn = distributionTaxable - principalWithdrawn
          finalTaxableCapitalGains = Math.max(0, gainsWithdrawn)
        } else {
          finalTaxableCapitalGains = distributionTaxable
        }
      }
      const finalCapitalGainsTax = calculateCapitalGainsTax(finalTaxableCapitalGains, filingStatus)
      tax = finalIncomeTax + finalCapitalGainsTax
      
      // Recalculate total income
      totalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                   distributionHsa + distributionIra + distributionOther + otherRecurringIncome
    }
    
    // Calculate final taxable income for reporting
    // Taxable income should include:
    // - Traditional account withdrawals (401k, IRA) - fully taxable as ordinary income
    // - Taxable portion of SSA income (typically 50%, can be up to 85% for higher incomes)
    // - Other recurring income - fully taxable
    // - Standard deduction is subtracted to get taxable income after deduction
    // Note: Taxable account withdrawals are capital gains (separate from ordinary income)
    // Reuse standardDeduction that was already calculated above
    const taxableSsaPortion = totalSsaIncome * SSA_TAXABLE_PORTION // 50% of SSA is typically taxable
    const finalOrdinaryIncome = distribution401k + distributionIra + taxableSsaPortion + otherRecurringIncome
    const finalTaxableIncome = Math.max(0, finalOrdinaryIncome - standardDeduction)
    // Note: This represents taxable income after standard deduction
    // Capital gains from taxable account are taxed separately and not included here
    
    // Total income and tax are already calculated in the withdrawal loop above
    // If not retired, calculate taxes normally
    if (!isRetired) {
      // 2024 standard deductions: Single = $14,600, Married Filing Jointly = $29,200
      const standardDeduction = getStandardDeduction(filingStatus)
      
      // Calculate taxable portion of SSA income
      // SSA is partially taxable: up to 50% or 85% depending on combined income
      // Combined income = AGI + nontaxable interest + 50% of SSA
      // Simplified: include 50% of SSA in taxable income (can be up to 85% for higher incomes)
      const taxableSsaIncome = totalSsaIncome * SSA_TAXABLE_PORTION // 50% of SSA is typically taxable
      
      const finalOrdinaryIncome = distribution401k + distributionIra + otherRecurringIncome + taxableSsaIncome
      const finalTaxableIncomeAfterDeduction = Math.max(0, finalOrdinaryIncome - standardDeduction)
      const finalIncomeTax = calculateProgressiveTax(finalTaxableIncomeAfterDeduction, filingStatus)
      
      // Calculate capital gains tax on gains only (not principal)
      let finalTaxableCapitalGains = 0
      if (distributionTaxable > 0) {
        const taxableBalance = accountBalances['Taxable'] + distributionTaxable // Balance before withdrawal
        if (taxableBalance > 0) {
          const withdrawalRatio = distributionTaxable / taxableBalance
          const principalWithdrawn = taxableAccountBasis.principal * withdrawalRatio
          const gainsWithdrawn = distributionTaxable - principalWithdrawn
          finalTaxableCapitalGains = Math.max(0, gainsWithdrawn)
        } else {
          finalTaxableCapitalGains = distributionTaxable
        }
      }
      const finalCapitalGainsTax = calculateCapitalGainsTax(finalTaxableCapitalGains, filingStatus)
      tax = finalIncomeTax + finalCapitalGainsTax
      
      totalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                   distributionHsa + distributionIra + distributionOther + otherRecurringIncome
    }
    
    const afterTaxIncome = totalIncome - tax
    
    // Calculate initial gap/excess (before debt payments)
    // After retirement: gap/excess = income - expenses
    // Before retirement: gap/excess is 0 (we're not drawing income for living expenses yet)
    // Note: Pre-retirement income (like early SSA) is tracked but doesn't create "excess" to reinvest
    const initialGapExcess = isRetired 
      ? afterTaxIncome - totalLivingAndHealthcare
      : 0 // Before retirement, no gap/excess - income isn't being used for expenses
    
    // DEBT MANAGEMENT STRATEGY (only if enabled)
    let debtBorrowed = 0
    let debtInterestPaid = 0
    let debtPrincipalPaid = 0
    const enableBorrowing = settings.enable_borrowing === true // Only borrow if explicitly enabled
    
    if (enableBorrowing) {
      // 1. Apply interest to existing debt first (compound annually)
      if (debtBalance > 0) {
        debtBalance *= (1 + debtInterestRate)
      }
      
      // 2. If there's a shortfall (initialGapExcess < 0), borrow to cover it
      if (initialGapExcess < 0) {
        // Borrow to cover the shortfall
        debtBorrowed = Math.abs(initialGapExcess)
        debtBalance += debtBorrowed
      } else if (initialGapExcess > 0 && debtBalance > 0) {
        // Use excess income to pay down debt
        // Strategy: Pay interest first, then principal
        const interestDue = debtBalance * debtInterestRate
        debtInterestPaid = Math.min(initialGapExcess, interestDue)
        debtBalance = Math.max(0, debtBalance - debtInterestPaid)
        
        // After paying interest, use remaining excess to pay principal
        const remainingExcess = initialGapExcess - debtInterestPaid
        if (remainingExcess > 0 && debtBalance > 0) {
          debtPrincipalPaid = Math.min(remainingExcess, debtBalance)
          debtBalance = Math.max(0, debtBalance - debtPrincipalPaid)
        }
      }
    }
    
    // Calculate final gap/excess (after debt payments)
    // This represents the actual cash flow: income - expenses - debt payments
    const gapExcess = initialGapExcess - debtInterestPaid - debtPrincipalPaid
    
    // Update cumulative liability (for tracking purposes, includes debt)
    if (gapExcess < 0) {
      cumulativeLiability += Math.abs(gapExcess)
    } else {
      // Reduce liability if there's excess
      if (gapExcess > 0) {
        cumulativeLiability = Math.max(0, cumulativeLiability - gapExcess)
      }
    }
    
    // If there's surplus after debt is cleared during RETIREMENT, add it to taxable account
    // Only do this during retirement - before retirement, income isn't being used for expenses
    // so there's no meaningful "surplus" to reinvest
    if (isRetired && gapExcess > 0 && debtBalance <= 0) {
      // Add surplus to taxable account (simulating reinvestment)
      // Excess after-tax income is treated as principal (cost basis) since it's already been taxed
      accountBalances['Taxable'] += gapExcess
      taxableAccountBasis.principal += gapExcess
      taxableAccountBasis.total += gapExcess
    }
    
    // Note: Negative gap/excess is tracked in cumulativeLiability and deducted from networth
    // Account balances remain unchanged - the shortfall is reflected in networth reduction
    
    // Apply growth to account balances
    Object.keys(accountBalances).forEach(key => {
      if (accountBalances[key] > 0) {
        accountBalances[key] *= (1 + growthRate)
      }
    })
    
    // Update taxable account basis after growth
    // Only the gains portion should be subject to capital gains tax
    if (accountBalances['Taxable'] > 0) {
      // When account grows, the principal (cost basis) stays the same, but total increases
      // This means gains = total - principal
      taxableAccountBasis.total = accountBalances['Taxable']
      // Principal remains the same (cost basis doesn't change with market growth)
    }
    
    // Add contributions if before retirement
    // Contributions are adjusted for inflation to reflect that savings typically increase with salary growth
    let totalAnnualContribution = 0
    if (!isRetired) {
      accounts.forEach(acc => {
        const type = (acc.account_type || 'Other').trim()
        const key = type === 'Roth IRA' ? 'Roth IRA' : 
                    type === '401k' ? '401k' :
                    type === 'HSA' ? 'HSA' :
                    type === 'IRA' || type === 'Traditional IRA' ? 'IRA' :
                    type === 'Taxable' ? 'Taxable' : 'Other'
        // Adjust contribution for inflation (base contribution in today's dollars, adjusted for future years)
        const baseContribution = acc.annual_contribution || 0
        const contribution = baseContribution * inflationMultiplier
        totalAnnualContribution += contribution
        accountBalances[key] = (accountBalances[key] || 0) + contribution
        
        // Track contributions to taxable account as principal (cost basis)
        // Contributions are made with after-tax money, so they have cost basis = value
        if (key === 'Taxable' && contribution > 0) {
          taxableAccountBasis.principal += contribution
          taxableAccountBasis.total += contribution
        }
      })
    }
    
    // Calculate net worth (assets minus debt minus cumulative liability)
    // Cumulative liability represents accumulated shortfalls (negative gap/excess) that reduce networth
    const totalAssets = Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0)
    const networth = totalAssets - debtBalance - cumulativeLiability
    
    // Calculate assets remaining (same as networth)
    const assetsRemaining = networth
    
    // Determine event
    let event: string | undefined
    const plannerSsaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
    if (age === retirementAge) {
      event = 'Retirement'
    } else if (age === plannerSsaStartAge) {
      event = 'SSA Eligibility'
    } else if (age === 65) {
      event = 'Medicare Eligibility'
    } else if (age === 67) {
      event = 'Full SSA'
    } else if (age === 70) {
      event = 'Max SSA'
    } else if (age === 73) {
      event = 'RMD Starts'
    }
    
    // Check for spouse SSA eligibility
    if (includeSpouseSsa && spouseBirthYear) {
      // Calculate spouse's age: current year - spouse birth year
      // Current year = birthYear + age, so spouse age = (birthYear + age) - spouseBirthYear
      const spouseAge = (birthYear + age) - spouseBirthYear
      const spouseSsaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
      if (spouseAge === spouseSsaStartAge && !event) {
        event = 'Spouse SSA Eligibility'
      } else if (spouseAge === spouseSsaStartAge && event) {
        event = `${event}, Spouse SSA Eligibility`
      }
    }
    
    projections.push({
      year,
      age,
      event,
      ssa_income: totalSsaIncome, // Combined SSA income (primary + spouse)
      distribution_401k: distribution401k,
      distribution_roth: distributionRoth,
      distribution_taxable: distributionTaxable,
      distribution_hsa: distributionHsa,
      distribution_ira: distributionIra,
      distribution_other: distributionOther,
      investment_income: investmentIncome,
      other_recurring_income: otherRecurringIncome,
      total_income: totalIncome,
      after_tax_income: afterTaxIncome,
      living_expenses: livingExpenses,
      healthcare_expenses: healthcareExpenses,
      special_expenses: 0,
      total_expenses: totalLivingAndHealthcare,
      gap_excess: gapExcess,
      cumulative_liability: cumulativeLiability,
      debt_balance: debtBalance,
      debt_interest_paid: debtInterestPaid,
      debt_principal_paid: debtPrincipalPaid,
      assets_remaining: assetsRemaining,
      networth: networth,
      balance_401k: accountBalances['401k'],
      balance_roth: accountBalances['Roth IRA'],
      balance_investment: accountBalances['Taxable'],
      balance_other_investments: accountBalances['Other'],
      balance_hsa: accountBalances['HSA'],
      balance_ira: accountBalances['IRA'],
      taxable_income: finalTaxableIncome,
      tax: tax,
      annual_contribution: totalAnnualContribution,
    })
    
    year++
    age++
  }
  
  return projections
}
