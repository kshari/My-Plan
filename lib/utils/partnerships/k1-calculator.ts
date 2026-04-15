/**
 * K-1 allocation calculator for Schedule K-1 (Form 1065).
 * Allocates partnership income/deductions to partners based on ownership percentage.
 * Supports time-weighted average for mid-year ownership changes.
 */

import type {
  Account,
  FiscalYear,
  JournalLine,
  K1Allocation,
  K1JsonItem,
} from '@/lib/types/partnerships'

interface MemberInfo {
  id: string
  display_name: string
  email: string | null
  ownership_pct: number
}

interface OwnershipSnapshot {
  member_id: string
  ownership_pct: number
  effective_date: string  // ISO date — start of this ownership period
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return Math.max(0, Math.round((e - s) / 86400000))
}

function totalDays(fy: FiscalYear): number {
  return daysBetween(fy.start_date, fy.end_date) + 1
}

/**
 * Compute time-weighted average ownership % for a member over a fiscal year.
 * If no snapshots are provided, falls back to `currentPct`.
 */
export function timeWeightedOwnership(
  memberId: string,
  fy: FiscalYear,
  snapshots: OwnershipSnapshot[],
  currentPct: number,
): number {
  const memberSnaps = snapshots
    .filter(s => s.member_id === memberId && s.effective_date <= fy.end_date)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))

  if (memberSnaps.length === 0) return currentPct

  const fyDays = totalDays(fy)
  let weighted = 0

  for (let i = 0; i < memberSnaps.length; i++) {
    const snap = memberSnaps[i]
    const periodStart = snap.effective_date > fy.start_date ? snap.effective_date : fy.start_date
    const periodEnd = i + 1 < memberSnaps.length ? memberSnaps[i + 1].effective_date : fy.end_date
    const days = daysBetween(periodStart, periodEnd) + (i === memberSnaps.length - 1 ? 1 : 0)
    weighted += snap.ownership_pct * (days / fyDays)
  }

  return round2(weighted)
}

/**
 * Get the net balance for an account from posted lines within a date range.
 * For income accounts: credit − debit (credit-normal)
 * For expense accounts: debit − credit (debit-normal)
 */
function accountBalance(accountId: string, type: 'income' | 'expense', lines: JournalLine[]): number {
  const acctLines = lines.filter(l => l.account_id === accountId)
  const totalDebit = acctLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = acctLines.reduce((s, l) => s + l.credit, 0)
  return type === 'income' ? round2(totalCredit - totalDebit) : round2(totalDebit - totalCredit)
}

// ─── Income allocation ────────────────────────────────────────────────────────

export interface AllocatedIncome {
  memberId: string
  ownershipPct: number
  ordinaryIncome: number
  capitalGains: number
  interestIncome: number
  dividendIncome: number
  rentalIncome: number
  section1231Gain: number
  guaranteedPaymentsSvc: number
  guaranteedPaymentsCap: number
  otherIncome: number
  otherIncomeItems: K1JsonItem[]
  totalExpenses: number
  otherDeductions: K1JsonItem[]
  contributions: number
  distributions: number
  beginningCapital: number
  endingCapital: number
}

export function allocateIncome(
  lines: JournalLine[],
  accounts: Account[],
  members: MemberInfo[],
  fy: FiscalYear,
  ownershipSnapshots: OwnershipSnapshot[] = [],
): AllocatedIncome[] {
  const fyLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return (
      entry &&
      entry.entry_date >= fy.start_date &&
      entry.entry_date <= fy.end_date &&
      entry.status === 'posted'
    )
  })

  const priorLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date < fy.start_date && entry.status === 'posted'
  })

  // Aggregate income/expense by subtype
  const bySubtype = (subtype: string, type: 'income' | 'expense') =>
    accounts
      .filter(a => a.subtype === subtype)
      .reduce((sum, a) => sum + accountBalance(a.id, type, fyLines), 0)

  const ordinaryIncomeTotal =
    bySubtype('revenue', 'income') +
    bySubtype('other_income', 'income') -
    bySubtype('operating_expense', 'expense') -
    bySubtype('tax_expense', 'expense') -
    bySubtype('other_expense', 'expense') -
    bySubtype('depreciation', 'expense')

  const capitalGainsTotal = bySubtype('capital_gain', 'income')
  const interestTotal = accounts
    .filter(a => a.account_code === '4100')
    .reduce((s, a) => s + accountBalance(a.id, 'income', fyLines), 0)
  const dividendTotal = accounts
    .filter(a => a.account_code === '4200')
    .reduce((s, a) => s + accountBalance(a.id, 'income', fyLines), 0)
  const rentalTotal =
    accounts.filter(a => a.account_code?.startsWith('42') && a.name.toLowerCase().includes('rent'))
      .reduce((s, a) => s + accountBalance(a.id, 'income', fyLines), 0)
  const interestExpenseTotal = bySubtype('interest_expense', 'expense')

  return members.map(m => {
    const pct = timeWeightedOwnership(m.id, fy, ownershipSnapshots, m.ownership_pct) / 100
    const capitalAcct = accounts.find(a => a.member_id === m.id && a.subtype === 'partner_capital')

    // Beginning capital: all posted lines before FY start
    let beginningCapital = 0
    if (capitalAcct) {
      const { d, c } = priorLines
        .filter(l => l.account_id === capitalAcct.id)
        .reduce((acc, l) => ({ d: acc.d + l.debit, c: acc.c + l.credit }), { d: 0, c: 0 })
      beginningCapital = round2(c - d)
    }

    // Contributions & distributions from per-partner capital account during FY
    let contributions = 0
    let distributions = 0
    if (capitalAcct) {
      const { d, c } = fyLines
        .filter(l => l.account_id === capitalAcct.id)
        .reduce((acc, l) => ({ d: acc.d + l.debit, c: acc.c + l.credit }), { d: 0, c: 0 })
      contributions = round2(c)
      distributions = round2(d)
    }

    const allocate = (total: number) => round2(total * pct)
    const ordinaryIncome = allocate(ordinaryIncomeTotal)
    const capitalGains = allocate(capitalGainsTotal)
    const interestIncome = allocate(interestTotal)
    const dividendIncome = allocate(dividendTotal)
    const rentalIncome = allocate(rentalTotal)
    const section1231Gain = 0  // user enters manually for section 1231
    const otherIncome = 0
    const totalExpenses = allocate(interestExpenseTotal)

    const netIncomeAllocated = round2(ordinaryIncome + capitalGains + interestIncome + dividendIncome + rentalIncome)
    const endingCapital = round2(beginningCapital + contributions + netIncomeAllocated - distributions)

    return {
      memberId: m.id,
      ownershipPct: round2(pct * 100),
      ordinaryIncome,
      capitalGains,
      interestIncome,
      dividendIncome,
      rentalIncome,
      section1231Gain,
      guaranteedPaymentsSvc: 0,
      guaranteedPaymentsCap: 0,
      otherIncome,
      otherIncomeItems: [],
      totalExpenses,
      otherDeductions: [],
      contributions,
      distributions,
      beginningCapital,
      endingCapital,
    }
  })
}

// ─── Build K-1 from allocation ────────────────────────────────────────────────

export function buildK1(
  entityId: string,
  fiscalYearId: string,
  allocation: AllocatedIncome,
  existingK1?: Partial<K1Allocation>,  // preserves manual overrides
): Omit<K1Allocation, 'id' | 'generated_at' | 'created_at'> {
  return {
    entity_id: entityId,
    member_id: allocation.memberId,
    fiscal_year_id: fiscalYearId,
    ownership_pct: allocation.ownershipPct,
    capital_method: existingK1?.capital_method ?? 'tax',
    // Capital account analysis
    beginning_capital: allocation.beginningCapital,
    contributions: allocation.contributions,
    net_income_allocated: round2(
      allocation.ordinaryIncome +
      allocation.capitalGains +
      allocation.interestIncome +
      allocation.dividendIncome +
      allocation.rentalIncome
    ),
    withdrawals: allocation.distributions,
    ending_capital: allocation.endingCapital,
    // Schedule K-1 boxes
    box_1_ordinary_income: allocation.ordinaryIncome,
    box_2_net_rental_re_income: allocation.rentalIncome,
    box_3_other_net_rental_income: 0,
    box_4_guaranteed_payments_svc: existingK1?.box_4_guaranteed_payments_svc ?? allocation.guaranteedPaymentsSvc,
    box_5_guaranteed_payments_cap: existingK1?.box_5_guaranteed_payments_cap ?? allocation.guaranteedPaymentsCap,
    box_6_net_1231_gain: existingK1?.box_6_net_1231_gain ?? allocation.section1231Gain,
    box_7_other_income: allocation.otherIncome,
    box_9a_lt_capital_gain: allocation.capitalGains,
    box_9b_collectibles_gain: existingK1?.box_9b_collectibles_gain ?? 0,
    box_9c_unrec_1250_gain: existingK1?.box_9c_unrec_1250_gain ?? 0,
    box_10_net_1231_gain_28: existingK1?.box_10_net_1231_gain_28 ?? 0,
    box_11_other_income_loss: existingK1?.box_11_other_income_loss ?? allocation.otherIncomeItems,
    box_12_section_179: existingK1?.box_12_section_179 ?? 0,
    box_13_other_deductions: existingK1?.box_13_other_deductions ?? allocation.otherDeductions,
    box_15_credits: existingK1?.box_15_credits ?? [],
    box_17_amt_items: existingK1?.box_17_amt_items ?? [],
    box_18_tax_exempt: existingK1?.box_18_tax_exempt ?? [],
    box_19a_distributions_cash: allocation.distributions,
    box_19c_distributions_prop: existingK1?.box_19c_distributions_prop ?? 0,
    box_20_other_info: existingK1?.box_20_other_info ?? [],
    is_final: false,
    finalized_at: null,
    notes: existingK1?.notes ?? null,
    generated_by: null,
  }
}
