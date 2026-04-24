/**
 * Single shared metrics computation for property investment scenarios.
 * Replaces duplicate logic scattered across financial-scenarios-list,
 * scenario-comparer, financial-metrics, and property-details.
 */

export interface ScenarioMetrics {
  price: number
  // Income
  grossIncome: number       // annual gross rent before vacancy
  vacancyRate: number       // vacancy % (e.g. 5 = 5%)
  vacancyLoss: number       // annual dollar lost to vacancy
  effectiveIncome: number   // grossIncome * (1 - vacancyRate/100)
  /** @deprecated use effectiveIncome — kept for back-compat */
  income: number
  // Expenses
  opex: number              // base annual operating expenses (excludes prop mgmt)
  propMgmtRate: number      // property management % of effective income
  propMgmtExpense: number   // annual property management cost
  totalExpenses: number     // opex + propMgmtExpense
  noi: number               // effectiveIncome - totalExpenses
  // Loan
  hasLoan: boolean
  dp: number
  rate: number
  term: number
  principal: number
  loanCC: number          // loan closing costs
  purchaseCC: number      // purchase (buyer-side) closing costs
  totalCashInvested: number
  // Returns
  capRate: number
  grm: number
  onePercent: number
  annualMortgage: number
  monthlyMortgage: number
  firstYearInterest: number
  firstYearPrincipal: number
  firstYearCF: number
  monthlyCF: number
  cocr: number
  dscr: number | null
}

export function computeScenarioMetrics(s: Record<string, unknown>): ScenarioMetrics {
  const price = +(s['Purchase Price'] ?? 0) || 0
  const grossIncome = +(s['Gross Income'] ?? 0) || 0
  const opex = +(s['Operating Expenses'] ?? 0) || 0
  const vacancyRate = +(s['Vacancy Rate'] ?? 0) || 0
  const propMgmtRate = +(s['Property Management Rate'] ?? 0) || 0

  const vacancyLoss = grossIncome * (vacancyRate / 100)
  const effectiveIncome = grossIncome - vacancyLoss
  const propMgmtExpense = effectiveIncome * (propMgmtRate / 100)
  const totalExpenses = opex + propMgmtExpense
  const noi = effectiveIncome - totalExpenses

  const hasLoan = !!s['Has Loan']
  const dp = +(s['Down Payment Amount'] ?? 0) || 0
  const rate = +(s['Interest Rate'] ?? 0) || 0
  const term = +(s['Loan Term'] ?? 0) || 0
  const loanCC = +(s['Closing Costs'] ?? 0) || 0
  const purchaseCC = +(s['Purchase Closing Costs'] ?? 0) || 0
  const principal = price - dp

  const totalCashInvested = hasLoan
    ? dp + loanCC + purchaseCC
    : price + purchaseCC

  const capRate = price > 0 ? (noi / price) * 100 : 0
  // GRM and 1% Rule both use gross rent by convention (before vacancy deduction)
  const grm = grossIncome > 0 ? price / grossIncome : 0
  const onePercent = price > 0 && grossIncome > 0 ? (grossIncome / 12 / price) * 100 : 0

  let annualMortgage = 0
  let firstYearInterest = 0
  let firstYearPrincipal = 0

  if (hasLoan && principal > 0 && rate > 0 && term > 0) {
    const mr = rate / 100 / 12
    const np = term * 12
    const mp = principal * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
    annualMortgage = mp * 12
    let balance = principal
    for (let m = 1; m <= 12; m++) {
      const intPay = balance * mr
      const prinPay = mp - intPay
      firstYearInterest += intPay
      firstYearPrincipal += Math.min(prinPay, balance)
      balance = Math.max(0, balance - prinPay)
    }
  }

  const firstYearCF = hasLoan ? noi - firstYearInterest - firstYearPrincipal : noi
  const monthlyCF = firstYearCF / 12
  const monthlyMortgage = annualMortgage / 12
  const cocr = totalCashInvested > 0 ? (firstYearCF / totalCashInvested) * 100 : 0
  const dscr = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null

  return {
    price,
    grossIncome, vacancyRate, vacancyLoss, effectiveIncome,
    income: effectiveIncome, // back-compat alias
    opex, propMgmtRate, propMgmtExpense, totalExpenses, noi,
    hasLoan, dp, rate, term, principal,
    loanCC, purchaseCC,
    totalCashInvested, capRate, grm, onePercent,
    annualMortgage, monthlyMortgage, firstYearInterest, firstYearPrincipal,
    firstYearCF, monthlyCF, cocr, dscr,
  }
}

export function fmtDollar(v: number, decimals = 0): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function fmtCompact(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
