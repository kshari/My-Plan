// Retirement projection calculation engine

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

export interface CalculatorSettings {
  current_year: number
  retirement_age: number
  retirement_start_year: number
  years_to_retirement: number
  annual_retirement_expenses: number
  growth_rate_before_retirement: number // decimal (e.g., 0.1 for 10%)
  growth_rate_during_retirement: number // decimal
  capital_gains_tax_rate: number // decimal
  income_tax_rate_retirement: number // decimal
  inflation_rate: number // decimal
  filing_status?: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household'
  debt_interest_rate?: number // decimal, default 0.06 (6%)
  enable_borrowing?: boolean // Enable borrowing to cover negative cashflow
  ssa_start_age?: number // Age to start SSA income, default 62
  withdrawal_priority?: WithdrawalPriority // Primary withdrawal strategy priority
  withdrawal_secondary_priority?: WithdrawalPriority // Secondary priority for tie-breaking
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

export function calculateRetirementProjections(
  birthYear: number,
  accounts: Account[],
  expenses: Expense[],
  otherIncome: OtherIncome[],
  settings: CalculatorSettings,
  projectionEndAge: number = 100,
  spouseBirthYear?: number,
  spouseLifeExpectancy?: number,
  includePlannerSsa: boolean = true,
  includeSpouseSsa?: boolean
): ProjectionDetail[] {
  const currentYear = settings.current_year
  const currentAge = currentYear - birthYear
  const retirementAge = settings.retirement_age
  const retirementStartYear = settings.retirement_start_year
  const debtInterestRate = settings.debt_interest_rate || 0.06 // Default 6% annual interest
  
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
  
  // Calculate base monthly expenses
  const baseMonthlyExpenses = expenses.reduce((sum, exp) => {
    const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
    return sum + (amount || 0)
  }, 0)
  
  // Calculate annual expenses for current year (before retirement)
  const baseAnnualExpenses = baseMonthlyExpenses * 12
  
  while (age <= projectionEndAge) {
    const isRetired = age >= retirementAge
    const yearsSinceRetirement = isRetired ? year - retirementStartYear : 0
    const yearsFromNow = year - currentYear
    
    // Calculate living expenses (adjusted for inflation)
    const inflationMultiplier = Math.pow(1 + settings.inflation_rate, yearsFromNow)
    let livingExpenses = 0
    
    if (isRetired) {
      // Use retirement expenses adjusted for inflation
      livingExpenses = settings.annual_retirement_expenses * Math.pow(1 + settings.inflation_rate, yearsSinceRetirement)
    } else {
      // Use pre-retirement expenses adjusted for inflation
      livingExpenses = baseAnnualExpenses * inflationMultiplier
    }
    
    // Calculate growth rate for this year
    const growthRate = isRetired 
      ? settings.growth_rate_during_retirement 
      : settings.growth_rate_before_retirement
    
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
    
    // Planner SSA income (simplified: starts at configured age, increases to full at 67)
    const ssaStartAge = settings.ssa_start_age || 62
    if (includePlannerSsa && age >= ssaStartAge) {
      // Simplified SSA calculation - in reality this is complex
      // Assume a base amount that increases with age
      // If starting before 67, reduce by ~5% per year early
      const ssaMultiplier = age < 67 ? Math.max(0.7, 1.0 - (67 - age) * 0.05) : 1.0
      ssaIncome = 20000 * ssaMultiplier * inflationMultiplier // Base $20k, adjust for inflation
    }
    
    // Spouse SSA income
    let spouseSsaIncome = 0
    if (includeSpouseSsa && spouseBirthYear && spouseLifeExpectancy) {
      // Calculate spouse's age: current year - spouse birth year
      // Current year = birthYear + age, so spouse age = (birthYear + age) - spouseBirthYear
      const spouseAge = (birthYear + age) - spouseBirthYear
      const spouseSsaStartAge = settings.ssa_start_age || 62
      if (spouseAge >= spouseSsaStartAge && spouseAge <= spouseLifeExpectancy) {
        const spouseSsaMultiplier = spouseAge < 67 ? Math.max(0.7, 1.0 - (67 - spouseAge) * 0.05) : 1.0
        spouseSsaIncome = 15000 * spouseSsaMultiplier * inflationMultiplier // Base $15k for spouse, adjust for inflation
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
    const initialExpensesToCover = livingExpenses - totalSsaIncome - otherRecurringIncome
    
    // Estimate taxes on initial withdrawal (simplified: assume all withdrawals are taxable at income tax rate)
    // This is an approximation - actual taxes depend on withdrawal types
    const estimatedTaxRate = settings.income_tax_rate_retirement
    const estimatedTaxOnWithdrawals = initialExpensesToCover > 0 ? initialExpensesToCover * estimatedTaxRate : 0
    
    // Total amount needed: expenses + estimated taxes
    const expensesToCover = initialExpensesToCover + estimatedTaxOnWithdrawals
    
    // Required Minimum Distribution (RMD) starts at age 73
    const rmdAge = 73
    const requiresRMD = age >= rmdAge
    
    // Calculate RMD if required (simplified: balance / life expectancy factor)
    // Life expectancy factor roughly: 27.4 at 73, decreases each year
    let requiredRMD = 0
    if (requiresRMD) {
      const lifeExpectancyFactor = Math.max(1, 27.4 - (age - 73))
      const totalTraditionalBalance = accountBalances['401k'] + accountBalances['IRA']
      requiredRMD = totalTraditionalBalance / lifeExpectancyFactor
    }
    
    if (isRetired && expensesToCover > 0) {
      let remainingNeed = expensesToCover
      
      // DYNAMIC WITHDRAWAL STRATEGY
      // Evaluate situation each year and adjust based on user priorities
      const priority = settings.withdrawal_priority || 'default'
      const secondaryPriority = settings.withdrawal_secondary_priority || 'tax_optimization'
      
      // Calculate current situation metrics
      const totalNetworth = accountBalances['401k'] + accountBalances['IRA'] + accountBalances['Roth IRA'] + 
                           accountBalances['Taxable'] + accountBalances['HSA'] + accountBalances['Other']
      const yearsRemaining = projectionEndAge - age
      const traditionalBalance = accountBalances['401k'] + accountBalances['IRA']
      const rothBalance = accountBalances['Roth IRA']
      const taxableBalance = accountBalances['Taxable']
      const hsaBalance = accountBalances['HSA']
      
      // Handle RMDs first if required (mandatory by law)
      if (requiresRMD && requiredRMD > 0) {
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
      
      // Determine dynamic withdrawal order based on priority and current situation
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
      
      // Execute withdrawals in the determined order
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
    } else if (isRetired && requiresRMD && requiredRMD > 0) {
      // Even if expenses are covered, must take RMDs after age 73
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
    
    // Investment income (dividends, interest) - NOT INCLUDED
    // Removed per user request - only account for withdrawals, not passive income
    
    // Calculate total income (include all distributions)
    const totalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                       distributionHsa + distributionIra + distributionOther + otherRecurringIncome
    
    // Calculate taxable income (401k, IRA, Taxable distributions, and other recurring income)
    const taxableIncome = distribution401k + distributionIra + distributionTaxable + otherRecurringIncome
    
    // Calculate taxes
    // Capital gains tax on taxable account distributions
    const capitalGainsTax = distributionTaxable * settings.capital_gains_tax_rate
    // Income tax on 401k/IRA distributions and other recurring income
    const incomeTax = (distribution401k + distributionIra + otherRecurringIncome) * settings.income_tax_rate_retirement
    let tax = capitalGainsTax + incomeTax
    
    // If after-tax income doesn't cover expenses, withdraw more (prefer Roth since it's tax-free)
    if (isRetired) {
      const afterTaxIncome = totalIncome - tax
      const shortfall = livingExpenses - afterTaxIncome
      
      if (shortfall > 0) {
        // Need to withdraw more to cover the tax shortfall
        let additionalNeed = shortfall
        // Withdraw additional from Roth (tax-free) first
        if (additionalNeed > 0 && accountBalances['Roth IRA'] > 0) {
          const additionalRoth = Math.min(additionalNeed, accountBalances['Roth IRA'])
          distributionRoth += additionalRoth
          accountBalances['Roth IRA'] -= additionalRoth
          additionalNeed -= additionalRoth
        }
        // If still needed, withdraw from taxable (will incur more tax, but we'll recalculate)
        if (additionalNeed > 0 && accountBalances['Taxable'] > 0) {
          const additionalTaxable = Math.min(additionalNeed, accountBalances['Taxable'])
          distributionTaxable += additionalTaxable
          accountBalances['Taxable'] -= additionalTaxable
          // Recalculate tax on additional taxable withdrawal
          const additionalCapitalGainsTax = additionalTaxable * settings.capital_gains_tax_rate
          tax += additionalCapitalGainsTax
        }
      }
    }
    
    // Recalculate total income after additional withdrawals
    const finalTotalIncome = totalSsaIncome + distribution401k + distributionRoth + distributionTaxable + 
                            distributionHsa + distributionIra + distributionOther + otherRecurringIncome
    const finalTaxableIncome = distribution401k + distributionIra + distributionTaxable + otherRecurringIncome
    const finalCapitalGainsTax = distributionTaxable * settings.capital_gains_tax_rate
    const finalIncomeTax = (distribution401k + distributionIra + otherRecurringIncome) * settings.income_tax_rate_retirement
    const finalTax = finalCapitalGainsTax + finalIncomeTax
    
    const afterTaxIncome = finalTotalIncome - finalTax
    
    // Calculate initial gap/excess (before debt payments)
    // Before retirement: expenses are 0, so gap/excess = income (all income is excess)
    // After retirement: gap/excess = income - expenses
    const initialGapExcess = isRetired 
      ? afterTaxIncome - livingExpenses
      : afterTaxIncome // Before retirement, all income is excess (no expenses)
    
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
    
    // If there's surplus after debt is cleared, add it to taxable account
    // This applies both before and after retirement
    if (gapExcess > 0 && debtBalance <= 0) {
      // Add surplus to taxable account (simulating reinvestment)
      accountBalances['Taxable'] += gapExcess
    }
    
    // Apply growth to account balances
    Object.keys(accountBalances).forEach(key => {
      if (accountBalances[key] > 0) {
        accountBalances[key] *= (1 + growthRate)
      }
    })
    
    // Add contributions if before retirement
    if (!isRetired) {
      accounts.forEach(acc => {
        const type = (acc.account_type || 'Other').trim()
        const key = type === 'Roth IRA' ? 'Roth IRA' : 
                    type === '401k' ? '401k' :
                    type === 'HSA' ? 'HSA' :
                    type === 'IRA' || type === 'Traditional IRA' ? 'IRA' :
                    type === 'Taxable' ? 'Taxable' : 'Other'
        const contribution = acc.annual_contribution || 0
        accountBalances[key] = (accountBalances[key] || 0) + contribution
      })
    }
    
    // Calculate net worth (assets minus debt)
    const totalAssets = Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0)
    const networth = totalAssets - debtBalance
    
    // Calculate assets remaining (net worth - cumulative liability, but networth already accounts for debt)
    const assetsRemaining = networth
    
    // Determine event
    let event: string | undefined
    const plannerSsaStartAge = settings.ssa_start_age || 62
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
      const spouseSsaStartAge = settings.ssa_start_age || 62
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
      total_income: finalTotalIncome,
      after_tax_income: afterTaxIncome,
      living_expenses: livingExpenses,
      special_expenses: 0, // Can be added later for one-time expenses
      total_expenses: livingExpenses,
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
      tax: finalTax,
    })
    
    year++
    age++
  }
  
  return projections
}
