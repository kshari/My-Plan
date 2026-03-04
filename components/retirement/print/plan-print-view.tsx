'use client'

import { useEffect } from 'react'
import { FileDown, Printer } from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)
    return `$${Math.round(n / 1_000).toLocaleString()}k`
  return `$${n.toFixed(decimals)}`
}

function pct(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(decimals)}%`
}

function num(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function score(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return `${Math.round(n)}/100`
}

const statusLabel: Record<string, string> = {
  'on-track': 'On Track',
  close: 'Close',
  'at-risk': 'At Risk',
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 pb-2 border-b-2 border-gray-200">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Stat grid ───────────────────────────────────────────────────────────────

function StatGrid({ stats }: { stats: Array<{ label: string; value: string; sub?: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stats.map(({ label, value, sub }) => (
        <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Table wrapper ────────────────────────────────────────────────────────────

function PrintTable({
  headers,
  rows,
  caption,
}: {
  headers: string[]
  rows: unknown[][]
  caption?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-gray-200 px-2 py-1 text-gray-700">
                  {(cell as string | number | null | undefined) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <p className="mt-1 text-xs text-gray-400 italic">{caption}</p>}
    </div>
  )
}

// ─── Section: Plan Summary ────────────────────────────────────────────────────

function PlanSummarySection({ metrics }: { metrics: Record<string, unknown> | null }) {
  if (!metrics) return null
  const status = (metrics.status as string) || 'unknown'
  const statusColor =
    status === 'on-track' ? 'text-green-700 bg-green-50 border-green-200' :
    status === 'close'    ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-red-700 bg-red-50 border-red-200'

  return (
    <section className="mb-8 print-section">
      <SectionHeader title="Plan Summary" subtitle="Key retirement readiness metrics" />
      <div className="mb-3">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}>
          {statusLabel[status] ?? status}
        </span>
      </div>
      <StatGrid
        stats={[
          {
            label: 'Confidence Score',
            value: score(metrics.confidence_score as number),
            sub: 'Retirement readiness',
          },
          {
            label: 'Monthly Income',
            value: fmt(metrics.monthly_income as number),
            sub: 'Estimated in retirement',
          },
          {
            label: 'Years Money Lasts',
            value: `${metrics.years_money_lasts ?? '—'} yrs`,
            sub: 'From retirement age',
          },
          {
            label: 'Net Worth at Retirement',
            value: fmt(metrics.networth_at_retirement as number),
            sub: 'Portfolio at retirement',
          },
          {
            label: 'End Net Worth',
            value: fmt(metrics.legacy_value as number),
            sub: 'Legacy / final value',
          },
          {
            label: 'Retirement Age',
            value: `${metrics.retirement_age ?? '—'}`,
            sub: `Current age ${metrics.current_age ?? '—'}`,
          },
        ]}
      />
    </section>
  )
}

// ─── Section: Assumptions ────────────────────────────────────────────────────

function AssumptionsSection({
  settings,
  plan,
}: {
  settings: Record<string, unknown> | null
  plan: Record<string, unknown>
}) {
  if (!settings) return null

  const s = settings as Record<string, unknown>
  const plannerSsa = s.planner_ssa_income !== false
  const spouseSsa = s.spouse_ssa_income === true
  const preMedicare = s.pre_medicare_annual_premium as number | null
  const postMedicare = s.post_medicare_annual_premium as number | null

  const rows: [string, string][] = [
    ['Current Age', `${plan.birth_year ? new Date().getFullYear() - (plan.birth_year as number) : '—'}`],
    ['Retirement Age', `${s.retirement_age ?? plan.retirement_age ?? '—'}`],
    ['Life Expectancy', `${plan.life_expectancy ?? '—'}`],
    ['Filing Status', `${plan.filing_status ?? '—'}`],
    ['Pre-Retirement Growth', pct(s.growth_rate_before_retirement as number)],
    ['In-Retirement Growth', pct(s.growth_rate_during_retirement as number)],
    ['Inflation Rate', pct(s.inflation_rate as number)],
    [
      'Planner SSA Income',
      plannerSsa
        ? `Yes — $${s.planner_ssa_annual_benefit ? num(s.planner_ssa_annual_benefit as number) : '—'}/yr at age ${s.ssa_start_age ?? '—'}`
        : 'No',
    ],
    [
      'Spouse SSA Income',
      spouseSsa
        ? `Yes — $${s.spouse_ssa_annual_benefit ? num(s.spouse_ssa_annual_benefit as number) : '—'}/yr`
        : 'No',
    ],
    [
      'Healthcare (Pre-Medicare)',
      preMedicare != null ? `$${num(preMedicare)}/yr` : '—',
    ],
    [
      'Healthcare (Post-Medicare)',
      postMedicare != null ? `$${num(postMedicare)}/yr` : '—',
    ],
    ['Withdrawal Strategy', `${s.withdrawal_strategy ?? 'Proportional'}`],
    ['Safe Withdrawal Rate', pct(s.safe_withdrawal_rate as number)],
  ]

  return (
    <section className="mb-8 print-section">
      <SectionHeader title="Plan Assumptions" subtitle="Calculator settings for this scenario" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-baseline border-b border-gray-100 py-1">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right ml-2">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section: Yearly Projections (simple) ────────────────────────────────────

function YearlyProjectionsSection({
  projections,
  settings,
}: {
  projections: Record<string, unknown>[]
  settings: Record<string, unknown> | null
}) {
  if (!projections.length) return null

  const retirementAge = (settings?.retirement_age as number) ?? 65
  const retirementRows = projections.filter(p => (p.age as number) >= retirementAge)

  const rows = retirementRows.map(p => [
    p.year,
    p.age,
    p.event || '—',
    fmt(p.after_tax_income as number),
    fmt(p.total_expenses as number),
    fmt(p.gap_excess as number),
    fmt(p.networth as number),
  ])

  return (
    <section className="mb-8 print-section">
      <SectionHeader
        title="Yearly Projections"
        subtitle={`Retirement years (from age ${retirementAge}) — ${retirementRows.length} years shown`}
      />
      <PrintTable
        headers={['Year', 'Age', 'Event', 'After-Tax Income', 'Total Expenses', 'Gap/Surplus', 'Net Worth']}
        rows={rows}
        caption="Values are inflation-adjusted estimates based on your plan assumptions."
      />
    </section>
  )
}

// ─── Section: Advanced Projections ───────────────────────────────────────────

function AdvancedProjectionsSection({ projections }: { projections: Record<string, unknown>[] }) {
  if (!projections.length) return null

  const rows = projections.map(p => [
    p.year,
    p.age,
    p.event || '—',
    fmt(p.ssa_income as number),
    fmt((p.distribution_401k as number) + (p.distribution_ira as number)),
    fmt(p.distribution_roth as number),
    fmt(p.distribution_taxable as number),
    fmt(p.after_tax_income as number),
    fmt(p.living_expenses as number),
    fmt(p.special_expenses as number),
    fmt(p.total_expenses as number),
    fmt(p.networth as number),
  ])

  return (
    <section className="mb-8 print-section">
      <SectionHeader
        title="Advanced Projections"
        subtitle={`All ${projections.length} years including pre-retirement`}
      />
      <PrintTable
        headers={[
          'Year', 'Age', 'Event',
          'SSA Income', '401k/IRA', 'Roth', 'Taxable',
          'After-Tax Inc.', 'Living Exp.', 'Healthcare', 'Total Exp.',
          'Net Worth',
        ]}
        rows={rows}
        caption="SSA = Social Security. 401k/IRA includes both account types. Healthcare is a separate expense."
      />
    </section>
  )
}

// ─── Section: Account Balances (from projections last row) ────────────────────

function AccountBalancesSection({ projections }: { projections: Record<string, unknown>[] }) {
  if (!projections.length) return null
  const last = projections[projections.length - 1]
  return (
    <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
      <p className="text-xs font-semibold text-gray-600 mb-2">Final Account Balances</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          ['401k', last.balance_401k],
          ['IRA', last.balance_ira],
          ['Roth', last.balance_roth],
          ['Taxable', last.balance_investment],
          ['HSA', last.balance_hsa],
          ['Other', last.balance_other_investments],
        ].map(([label, value]) => (
          <div key={label as string} className="text-center">
            <p className="text-xs text-gray-500">{label as string}</p>
            <p className="text-sm font-semibold text-gray-800">{fmt(value as number)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section: Scenario Modeling ───────────────────────────────────────────────

function ScenarioModelingSection({
  scenarios,
  scenariosWithSettings,
}: {
  scenarios: Array<{ id: number; scenario_name: string }>
  scenariosWithSettings: Array<{ id: number; scenario_name: string; settings: Record<string, unknown> | null }>
}) {
  if (!scenariosWithSettings.length && !scenarios.length) return null

  const rows = (scenariosWithSettings.length ? scenariosWithSettings : scenarios).map(s => {
    const st = s as { id: number; scenario_name: string; settings?: Record<string, unknown> | null }
    const settings = st.settings ?? {}
    return [
      s.scenario_name || `Scenario ${s.id}`,
      pct(settings.growth_rate_before_retirement as number),
      pct(settings.growth_rate_during_retirement as number),
      pct(settings.inflation_rate as number),
      settings.planner_ssa_income !== false ? 'Yes' : 'No',
      settings.withdrawal_strategy ?? 'Proportional',
    ]
  })

  return (
    <section className="mb-8 print-section">
      <SectionHeader
        title="Scenario Modeling"
        subtitle={`${rows.length} scenario${rows.length !== 1 ? 's' : ''} saved`}
      />
      <PrintTable
        headers={[
          'Scenario Name',
          'Pre-Ret. Growth',
          'In-Ret. Growth',
          'Inflation',
          'SSA Included',
          'Withdrawal Strategy',
        ]}
        rows={rows}
      />
    </section>
  )
}

// ─── Section: Risk Analysis ───────────────────────────────────────────────────

function RiskAnalysisSection({
  projections,
  settings,
  plan,
}: {
  projections: Record<string, unknown>[]
  settings: Record<string, unknown> | null
  plan: Record<string, unknown>
}) {
  if (!projections.length) return null

  const retirementAge = (settings?.retirement_age as number) ?? 65
  const lifeExpectancy = (plan.life_expectancy as number) ?? 90
  const retYears = projections.filter(p => (p.age as number) >= retirementAge)

  // Longevity: does portfolio last to life expectancy?
  const lastProjectedAge = retYears.length ? (retYears[retYears.length - 1].age as number) : retirementAge
  const portfolioRunsOut = retYears.find(p => (p.networth as number) <= 0)
  const runOutAge = portfolioRunsOut ? (portfolioRunsOut.age as number) : null
  const portfolioSurvives = !portfolioRunsOut || lastProjectedAge >= lifeExpectancy

  // Cashflow coverage
  const coverageRatios = retYears
    .filter(p => (p.total_expenses as number) > 0)
    .map(p => (p.after_tax_income as number) / (p.total_expenses as number))
  const avgCoverage = coverageRatios.length
    ? coverageRatios.reduce((a, b) => a + b, 0) / coverageRatios.length
    : 0
  const yearsShortfall = retYears.filter(
    p => (p.after_tax_income as number) < (p.total_expenses as number)
  ).length

  // Tax burden
  const totalTax = retYears.reduce((s, p) => s + ((p.tax as number) || 0), 0)
  const totalGross = retYears.reduce((s, p) => s + ((p.total_income as number) || 0), 0)
  const taxRate = totalGross > 0 ? totalTax / totalGross : 0

  const risks: string[] = []
  if (!portfolioSurvives) risks.push(`Portfolio may run out around age ${runOutAge}`)
  if (avgCoverage < 0.8) risks.push('Average cashflow coverage below 80% — expenses may exceed income')
  if (yearsShortfall > 5) risks.push(`${yearsShortfall} retirement years with income shortfall`)
  if (taxRate > 0.25) risks.push('Tax rate above 25% — consider Roth conversion strategies')

  const strengths: string[] = []
  if (portfolioSurvives) strengths.push(`Portfolio projected to last through age ${lifeExpectancy}`)
  if (avgCoverage >= 1.0) strengths.push('Income covers expenses throughout retirement')
  if (yearsShortfall === 0) strengths.push('No projected cashflow shortfall years')

  return (
    <section className="mb-8 print-section">
      <SectionHeader title="Risk Analysis" subtitle="Portfolio longevity and cashflow assessment" />

      <StatGrid
        stats={[
          {
            label: 'Portfolio Longevity',
            value: portfolioSurvives ? `Lasts to ${lifeExpectancy}` : `Runs out at ${runOutAge ?? '—'}`,
            sub: portfolioSurvives ? 'Positive outcome' : 'Needs attention',
          },
          {
            label: 'Avg. Cashflow Coverage',
            value: `${(avgCoverage * 100).toFixed(0)}%`,
            sub: 'Income ÷ expenses in retirement',
          },
          {
            label: 'Shortfall Years',
            value: `${yearsShortfall}`,
            sub: `of ${retYears.length} retirement years`,
          },
          {
            label: 'Avg. Tax Rate',
            value: `${(taxRate * 100).toFixed(1)}%`,
            sub: 'In retirement',
          },
        ]}
      />

      {(risks.length > 0 || strengths.length > 0) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {risks.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700 mb-2">Identified Risks</p>
              <ul className="space-y-1">
                {risks.map((r, i) => (
                  <li key={i} className="text-xs text-red-700 flex gap-1.5">
                    <span>•</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {strengths.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-700 mb-2">Strengths</p>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs text-green-700 flex gap-1.5">
                    <span>✓</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Section: Tax Efficiency ──────────────────────────────────────────────────

function TaxEfficiencySection({ projections }: { projections: Record<string, unknown>[] }) {
  if (!projections.length) return null

  // Lifetime totals
  const totalTax = projections.reduce((s, p) => s + ((p.tax as number) || 0), 0)
  const totalAfterTax = projections.reduce((s, p) => s + ((p.after_tax_income as number) || 0), 0)
  const totalGross = totalAfterTax + totalTax
  const efficiency = totalGross > 0 ? ((totalAfterTax / totalGross) * 100).toFixed(1) : '—'

  // Withdrawals by account type (retirement years only)
  const totalRoth = projections.reduce((s, p) => s + ((p.distribution_roth as number) || 0), 0)
  const total401k = projections.reduce(
    (s, p) => s + ((p.distribution_401k as number) || 0) + ((p.distribution_ira as number) || 0),
    0
  )
  const totalTaxable = projections.reduce((s, p) => s + ((p.distribution_taxable as number) || 0), 0)
  const totalWithdrawals = totalRoth + total401k + totalTaxable

  // Year-by-year table (retirement years)
  const rows = projections
    .filter(p => (p.after_tax_income as number) > 0 || (p.tax as number) > 0)
    .map(p => {
      const gross = ((p.after_tax_income as number) || 0) + ((p.tax as number) || 0)
      const eff = gross > 0 ? (((p.after_tax_income as number) / gross) * 100).toFixed(0) : '—'
      return [
        p.year,
        p.age,
        fmt(gross),
        fmt(p.tax as number),
        fmt(p.after_tax_income as number),
        `${eff}%`,
      ]
    })

  return (
    <section className="mb-8 print-section">
      <SectionHeader title="Tax Efficiency" subtitle="Lifetime tax impact and withdrawal breakdown" />

      <StatGrid
        stats={[
          { label: 'Lifetime Gross Income', value: fmt(totalGross), sub: 'Before taxes' },
          { label: 'Lifetime Taxes', value: fmt(totalTax), sub: 'Federal estimates' },
          { label: 'Lifetime After-Tax', value: fmt(totalAfterTax), sub: 'Spendable income' },
          { label: 'Tax Efficiency', value: `${efficiency}%`, sub: 'After-tax ÷ gross' },
        ]}
      />

      {totalWithdrawals > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">Withdrawal Mix (lifetime)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Roth (tax-free)', value: totalRoth, pctVal: totalWithdrawals > 0 ? (totalRoth / totalWithdrawals) * 100 : 0, color: 'text-green-700' },
              { label: '401k/IRA (taxable)', value: total401k, pctVal: totalWithdrawals > 0 ? (total401k / totalWithdrawals) * 100 : 0, color: 'text-orange-600' },
              { label: 'Taxable acct.', value: totalTaxable, pctVal: totalWithdrawals > 0 ? (totalTaxable / totalWithdrawals) * 100 : 0, color: 'text-blue-600' },
            ].map(({ label, value, pctVal, color }) => (
              <div key={label} className="text-center">
                <p className={`text-sm font-bold ${color}`}>{pctVal.toFixed(0)}%</p>
                <p className="text-xs text-gray-700">{fmt(value)}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">Year-by-Year Tax Summary</p>
          <PrintTable
            headers={['Year', 'Age', 'Gross Income', 'Taxes', 'After-Tax Income', 'Efficiency']}
            rows={rows}
          />
        </div>
      )}
    </section>
  )
}

// ─── Section: Plan Details ────────────────────────────────────────────────────

function PlanDetailsSection({ plan }: { plan: Record<string, unknown> }) {
  const birthYear = plan.birth_year as number | null
  const currentAge = birthYear ? new Date().getFullYear() - birthYear : null

  const rows: [string, string][] = [
    ['Plan Name', String(plan.plan_name ?? '—')],
    ['Current Age', currentAge != null ? String(currentAge) : '—'],
    ['Birth Year', String(plan.birth_year ?? '—')],
    ['Retirement Age', String(plan.retirement_age ?? '—')],
    ['Life Expectancy', String(plan.life_expectancy ?? '—')],
    ['Filing Status', String(plan.filing_status ?? '—')],
    ['State', String(plan.state ?? '—')],
  ]

  return (
    <section className="mb-8 print-section">
      <SectionHeader title="Plan Details" subtitle="Basic plan configuration" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-baseline border-b border-gray-100 py-1">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right ml-2">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section: Accounts ───────────────────────────────────────────────────────

function AccountsSection({ accounts }: { accounts: Record<string, unknown>[] }) {
  if (!accounts.length) return null

  const rows = accounts.map(a => [
    a.account_name ?? '—',
    a.owner ?? '—',
    a.account_type ?? '—',
    fmt(a.balance as number),
    fmt(a.annual_contribution as number),
  ])

  const totalBalance = accounts.reduce((s, a) => s + ((a.balance as number) || 0), 0)
  const totalContrib = accounts.reduce((s, a) => s + ((a.annual_contribution as number) || 0), 0)

  return (
    <section className="mb-8 print-section">
      <SectionHeader
        title="Accounts"
        subtitle={`${accounts.length} account${accounts.length !== 1 ? 's' : ''} — Total balance: ${fmt(totalBalance)}, Annual contributions: ${fmt(totalContrib)}`}
      />
      <PrintTable
        headers={['Account Name', 'Owner', 'Type', 'Balance', 'Annual Contribution']}
        rows={[
          ...rows,
          ['', '', 'Total', fmt(totalBalance), fmt(totalContrib)],
        ]}
      />
    </section>
  )
}

// ─── Section: Expenses ────────────────────────────────────────────────────────

function ExpensesSection({ expenses }: { expenses: Record<string, unknown>[] }) {
  if (!expenses.length) return null

  const rows = expenses.map(e => [
    e.expense_name ?? '—',
    e.expense_type ?? 'Living',
    fmt(e.amount_before_65 as number),
    fmt(e.amount_after_65 as number),
  ])

  const totalBefore = expenses.reduce((s, e) => s + ((e.amount_before_65 as number) || 0), 0)
  const totalAfter = expenses.reduce((s, e) => s + ((e.amount_after_65 as number) || 0), 0)

  return (
    <section className="mb-8 print-section">
      <SectionHeader
        title="Expenses"
        subtitle="Monthly amounts. Healthcare is tracked separately from living expenses."
      />
      <PrintTable
        headers={['Expense Name', 'Type', 'Before Age 65 (mo)', 'After Age 65 (mo)']}
        rows={[
          ...rows,
          ['', '', fmt(totalBefore), fmt(totalAfter)],
        ]}
        caption="Healthcare (pre/post-Medicare premiums) is configured in Plan Assumptions and calculated separately."
      />
    </section>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface PlanPrintViewProps {
  plan: Record<string, unknown>
  settings: Record<string, unknown> | null
  metrics: Record<string, unknown> | null
  projections: Record<string, unknown>[]
  accounts: Record<string, unknown>[]
  expenses: Record<string, unknown>[]
  otherIncome: Record<string, unknown>[]
  scenarios: Array<{ id: number; scenario_name: string }>
  scenariosWithSettings: Array<{ id: number; scenario_name: string; settings: Record<string, unknown> | null }>
  selectedSections: string[]
  generatedAt: string
}

const sectionOrder = [
  'plan-summary',
  'assumptions',
  'yearly-projections',
  'advanced-projections',
  'scenario-modeling',
  'risk-analysis',
  'tax-efficiency',
  'plan-details',
  'accounts',
  'expenses',
]

export default function PlanPrintView({
  plan,
  settings,
  metrics,
  projections,
  accounts,
  expenses,
  otherIncome,
  scenarios,
  scenariosWithSettings,
  selectedSections,
  generatedAt,
}: PlanPrintViewProps) {
  const has = (id: string) => selectedSections.includes(id)

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 900)
    return () => clearTimeout(timer)
  }, [])

  const sectionTitles: Record<string, string> = {
    'plan-summary': 'Plan Summary',
    assumptions: 'Plan Assumptions',
    'yearly-projections': 'Yearly Projections',
    'advanced-projections': 'Advanced Projections',
    'scenario-modeling': 'Scenario Modeling',
    'risk-analysis': 'Risk Analysis',
    'tax-efficiency': 'Tax Efficiency',
    'plan-details': 'Plan Details',
    accounts: 'Accounts',
    expenses: 'Expenses',
  }

  const visibleSections = sectionOrder.filter(id => has(id))

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media screen {
          #plan-print-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }
        }

        @media print {
          /* Make <html> the containing block for absolute positioning */
          html { position: relative !important; }

          /* 1. Hide ALL body descendants (sidebar, header, nav, etc.) */
          body * { visibility: hidden !important; }

          /* 2. Show only our overlay and everything inside it */
          #plan-print-overlay,
          #plan-print-overlay * { visibility: visible !important; }

          /* 3. Re-hide the screen-only controls */
          .no-print,
          .no-print * { visibility: hidden !important; display: none !important; }

          /* 4. Stretch the overlay to full page width,
                bypassing the flex sidebar layout */
          #plan-print-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-section { page-break-inside: avoid; }
          table { font-size: 10px; }
          @page { margin: 1.5cm; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div id="plan-print-overlay">
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="flex items-start justify-between mb-8 pb-4 border-b-2 border-gray-300">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{String(plan.plan_name ?? 'Retirement Plan')}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Retirement Plan Report &nbsp;·&nbsp;{new Date(generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {visibleSections.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Sections: {visibleSections.map(id => sectionTitles[id]).join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-gray-400 no-print">
              <p>My Plan</p>
              <p>Retirement Planner</p>
            </div>
          </div>

          {/* Sections in order */}
          {has('plan-summary') && <PlanSummarySection metrics={metrics} />}
          {has('assumptions') && <AssumptionsSection settings={settings} plan={plan} />}
          {has('yearly-projections') && (
            <>
              <YearlyProjectionsSection projections={projections} settings={settings} />
              {has('yearly-projections') && projections.length > 0 && (
                <AccountBalancesSection projections={projections} />
              )}
            </>
          )}
          {has('advanced-projections') && <AdvancedProjectionsSection projections={projections} />}
          {has('scenario-modeling') && (
            <ScenarioModelingSection
              scenarios={scenarios}
              scenariosWithSettings={scenariosWithSettings}
            />
          )}
          {has('risk-analysis') && (
            <RiskAnalysisSection projections={projections} settings={settings} plan={plan} />
          )}
          {has('tax-efficiency') && <TaxEfficiencySection projections={projections} />}
          {has('plan-details') && <PlanDetailsSection plan={plan} />}
          {has('accounts') && <AccountsSection accounts={accounts} />}
          {has('expenses') && <ExpensesSection expenses={expenses} />}

          {/* Disclaimer */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 italic">
              This report is for informational and planning purposes only. Projections are estimates based on the
              assumptions entered and do not constitute financial advice. Past performance does not guarantee
              future results. Consult a licensed financial advisor before making investment decisions.
            </p>
          </div>

          {/* Screen-only controls */}
          <div className="no-print mt-6 flex flex-wrap gap-3 border-t pt-6">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </button>
            <button
              onClick={() => window.close()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
