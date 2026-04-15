/**
 * Financial report computation utilities for the partnerships accounting module.
 * All functions are pure — they accept pre-fetched journal lines + accounts and
 * return typed report structures.  No Supabase calls here.
 */

import type {
  Account,
  AccountType,
  BalanceSheetReport,
  CashFlowReport,
  IncomeStatementReport,
  JournalLine,
  PartnersCapitalReport,
  PartnersCapitalRow,
  ReportLineItem,
  ReportSection,
  TrialBalanceReport,
} from '@/lib/types/partnerships'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * For a given account type, returns the "normal balance" direction.
 * Asset & Expense accounts increase with debits (debit-normal).
 * Liability, Equity & Income accounts increase with credits (credit-normal).
 */
function isDebitNormal(type: AccountType): boolean {
  return type === 'asset' || type === 'expense'
}

/**
 * Net balance for a single account from all posted journal lines.
 * Returns positive for normal balance direction, negative for contra.
 */
function netBalance(
  accountId: string,
  type: AccountType,
  lines: JournalLine[],
): number {
  const acctLines = lines.filter(l => l.account_id === accountId)
  const totalDebit = acctLines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = acctLines.reduce((s, l) => s + l.credit, 0)
  return isDebitNormal(type) ? totalDebit - totalCredit : totalCredit - totalDebit
}

function sumLines(lines: JournalLine[], accountId: string): { debit: number; credit: number } {
  return lines
    .filter(l => l.account_id === accountId)
    .reduce((acc, l) => ({ debit: acc.debit + l.debit, credit: acc.credit + l.credit }), { debit: 0, credit: 0 })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Trial Balance ────────────────────────────────────────────────────────────

export function buildTrialBalance(
  lines: JournalLine[],
  accounts: Account[],
  asOf: string,
): TrialBalanceReport {
  const filteredLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date <= asOf && entry.status === 'posted'
  })

  const tbLines = accounts
    .filter(a => a.is_active)
    .map(a => {
      const { debit, credit } = sumLines(filteredLines, a.id)
      const net = debit - credit
      return {
        account_id: a.id,
        account_code: a.account_code,
        name: a.name,
        type: a.type,
        debit_total: round2(debit),
        credit_total: round2(credit),
        net_debit: net > 0 ? round2(net) : 0,
        net_credit: net < 0 ? round2(-net) : 0,
      }
    })
    .filter(l => l.debit_total !== 0 || l.credit_total !== 0)
    .sort((a, b) => a.account_code.localeCompare(b.account_code))

  const total_debits = round2(tbLines.reduce((s, l) => s + l.net_debit, 0))
  const total_credits = round2(tbLines.reduce((s, l) => s + l.net_credit, 0))

  return {
    as_of: asOf,
    lines: tbLines,
    total_debits,
    total_credits,
    is_balanced: Math.abs(total_debits - total_credits) < 0.01,
  }
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function buildSection(
  type: AccountType,
  title: string,
  lines: JournalLine[],
  accounts: Account[],
): ReportSection {
  const accts = accounts.filter(a => a.type === type && a.is_active && !a.parent_id)
  const items: ReportLineItem[] = []

  for (const acct of accts.sort((a, b) => a.account_code.localeCompare(b.account_code))) {
    const { debit, credit } = sumLines(lines, acct.id)
    const balance = round2(isDebitNormal(type) ? debit - credit : credit - debit)
    items.push({
      account_id: acct.id,
      account_code: acct.account_code,
      name: acct.name,
      subtype: acct.subtype ?? null,
      balance,
      debit_total: round2(debit),
      credit_total: round2(credit),
      indent: 1,
    })
    // Sub-accounts
    const children = accounts.filter(a => a.parent_id === acct.id && a.is_active)
    for (const child of children.sort((a, b) => a.account_code.localeCompare(b.account_code))) {
      const { debit: cd, credit: cc } = sumLines(lines, child.id)
      const cBalance = round2(isDebitNormal(type) ? cd - cc : cc - cd)
      items.push({
        account_id: child.id,
        account_code: child.account_code,
        name: child.name,
        subtype: child.subtype ?? null,
        balance: cBalance,
        debit_total: round2(cd),
        credit_total: round2(cc),
        indent: 2,
      })
    }
  }

  return {
    title,
    lines: items,
    total: round2(items.filter(i => i.indent >= 1).reduce((s, i) => s + i.balance, 0)),
  }
}

export function buildBalanceSheet(
  lines: JournalLine[],
  accounts: Account[],
  asOf: string,
): BalanceSheetReport {
  const filteredLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date <= asOf && entry.status === 'posted'
  })

  const assets = [buildSection('asset', 'Assets', filteredLines, accounts)]
  const liabilities = [buildSection('liability', 'Liabilities', filteredLines, accounts)]
  const equity = [buildSection('equity', 'Equity', filteredLines, accounts)]

  const assets_total = round2(assets.reduce((s, s2) => s + s2.total, 0))
  const liabilities_total = round2(liabilities.reduce((s, s2) => s + s2.total, 0))
  const equity_total = round2(equity.reduce((s, s2) => s + s2.total, 0))
  const liabilities_equity_total = round2(liabilities_total + equity_total)

  return {
    as_of: asOf,
    assets,
    assets_total,
    liabilities,
    liabilities_total,
    equity,
    equity_total,
    liabilities_equity_total,
    is_balanced: Math.abs(assets_total - liabilities_equity_total) < 0.01,
  }
}

// ─── Income Statement ─────────────────────────────────────────────────────────

export function buildIncomeStatement(
  lines: JournalLine[],
  accounts: Account[],
  startDate: string,
  endDate: string,
): IncomeStatementReport {
  const filteredLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date >= startDate && entry.entry_date <= endDate && entry.status === 'posted'
  })

  const revenue = [buildSection('income', 'Revenue', filteredLines, accounts)]
  const expenses = [buildSection('expense', 'Expenses', filteredLines, accounts)]

  const revenue_total = round2(revenue.reduce((s, s2) => s + s2.total, 0))
  const expenses_total = round2(expenses.reduce((s, s2) => s + s2.total, 0))

  return {
    start_date: startDate,
    end_date: endDate,
    revenue,
    revenue_total,
    expenses,
    expenses_total,
    net_income: round2(revenue_total - expenses_total),
  }
}

// ─── Statement of Cash Flows (indirect method) ───────────────────────────────

export function buildCashFlows(
  lines: JournalLine[],
  accounts: Account[],
  startDate: string,
  endDate: string,
): CashFlowReport {
  const periodLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date >= startDate && entry.entry_date <= endDate && entry.status === 'posted'
  })

  const allPostedLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date < startDate && entry.status === 'posted'
  })

  const is = buildIncomeStatement(periodLines, accounts, startDate, endDate)
  const netIncome = is.net_income

  // Operating: start with net income, then adjust for non-cash & working capital
  const operating: { label: string; amount: number }[] = [
    { label: 'Net income', amount: netIncome },
  ]

  // Depreciation & amortization (non-cash add-back)
  const depAccts = accounts.filter(a => a.subtype === 'depreciation')
  for (const a of depAccts) {
    const { debit, credit } = sumLines(periodLines, a.id)
    const dep = round2(debit - credit)
    if (dep !== 0) operating.push({ label: a.name, amount: dep })
  }

  // Changes in working capital (AR, AP, prepaid, accrued)
  const wcMap: Record<string, string> = {
    ar: 'Change in accounts receivable',
    prepaid: 'Change in prepaid expenses',
    ap: 'Change in accounts payable',
    accrued: 'Change in accrued liabilities',
    deferred_rev: 'Change in deferred revenue',
  }
  for (const [subtype, label] of Object.entries(wcMap)) {
    const accts = accounts.filter(a => a.subtype === subtype)
    for (const a of accts) {
      const isAsset = a.type === 'asset'
      const { debit, credit } = sumLines(periodLines, a.id)
      const change = round2(isAsset ? credit - debit : debit - credit) // increase in asset = use of cash
      if (change !== 0) operating.push({ label: `${label} (${a.name})`, amount: change })
    }
  }

  // Investing: fixed assets and investments
  const investingSubtypes = ['fixed_asset', 'investment']
  const investing: { label: string; amount: number }[] = []
  for (const subtype of investingSubtypes) {
    const accts = accounts.filter(a => a.subtype === subtype)
    for (const a of accts) {
      const { debit, credit } = sumLines(periodLines, a.id)
      const change = round2(credit - debit) // increase in asset = cash outflow, negate
      if (change !== 0) investing.push({ label: a.name, amount: change })
    }
  }

  // Financing: notes payable, partner capital, distributions
  const financingSubtypes = ['note_payable', 'other_liab', 'partner_capital', 'retained_earnings']
  const financing: { label: string; amount: number }[] = []
  for (const subtype of financingSubtypes) {
    const accts = accounts.filter(a => a.subtype === subtype)
    for (const a of accts) {
      const { debit, credit } = sumLines(periodLines, a.id)
      const change = round2(credit - debit)
      if (change !== 0) financing.push({ label: a.name, amount: change })
    }
  }

  // Beginning cash
  const cashAccts = accounts.filter(a => a.subtype === 'cash')
  let beginningCash = 0
  for (const a of cashAccts) {
    const { debit, credit } = sumLines(allPostedLines, a.id)
    beginningCash += debit - credit
  }
  beginningCash = round2(beginningCash)

  const operating_total = round2(operating.reduce((s, i) => s + i.amount, 0))
  const investing_total = round2(investing.reduce((s, i) => s + i.amount, 0))
  const financing_total = round2(financing.reduce((s, i) => s + i.amount, 0))
  const net_change = round2(operating_total + investing_total + financing_total)

  return {
    start_date: startDate,
    end_date: endDate,
    operating,
    operating_total,
    investing,
    investing_total,
    financing,
    financing_total,
    net_change,
    beginning_cash: beginningCash,
    ending_cash: round2(beginningCash + net_change),
  }
}

// ─── Partners' Capital Statement ─────────────────────────────────────────────

export function buildPartnersCapitalStatement(
  lines: JournalLine[],
  accounts: Account[],
  members: { id: string; display_name: string; ownership_pct: number }[],
  startDate: string,
  endDate: string,
): PartnersCapitalReport {
  const periodLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date >= startDate && entry.entry_date <= endDate && entry.status === 'posted'
  })
  const priorLines = lines.filter(l => {
    const entry = (l as any).journal_entry
    return entry && entry.entry_date < startDate && entry.status === 'posted'
  })

  const is = buildIncomeStatement(periodLines, accounts, startDate, endDate)
  const netIncome = is.net_income

  const rows: PartnersCapitalRow[] = members.map(m => {
    const capitalAcct = accounts.find(a => a.member_id === m.id && a.subtype === 'partner_capital')

    let beginningCapital = 0
    let contributions = 0
    let distributions = 0

    if (capitalAcct) {
      const { debit: pd, credit: pc } = sumLines(priorLines, capitalAcct.id)
      beginningCapital = round2(pc - pd)
      const { debit: cd, credit: cc } = sumLines(periodLines, capitalAcct.id)
      // Credits to partner capital = contributions; debits = distributions
      contributions = round2(cc)
      distributions = round2(cd)
    }

    const ownershipFraction = (m.ownership_pct ?? 0) / 100
    const netIncomeAllocated = round2(netIncome * ownershipFraction)

    return {
      member_id: m.id,
      member_name: m.display_name,
      ownership_pct: m.ownership_pct,
      beginning_capital: beginningCapital,
      contributions,
      net_income_allocated: netIncomeAllocated,
      distributions,
      ending_capital: round2(beginningCapital + contributions + netIncomeAllocated - distributions),
    }
  })

  const sumRow = (key: keyof Omit<PartnersCapitalRow, 'member_id' | 'member_name' | 'ownership_pct'>) =>
    round2(rows.reduce((s, r) => s + r[key], 0))

  return {
    start_date: startDate,
    end_date: endDate,
    rows,
    totals: {
      beginning_capital: sumRow('beginning_capital'),
      contributions: sumRow('contributions'),
      net_income_allocated: sumRow('net_income_allocated'),
      distributions: sumRow('distributions'),
      ending_capital: sumRow('ending_capital'),
    },
  }
}
