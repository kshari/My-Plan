"use client"

import { useState, useEffect, useCallback, ReactNode } from "react"

function fmt(n: number) {
  const abs = Math.abs(n)
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${str})` : str
}

function AmountCell({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`font-mono text-sm ${amount < 0 ? "text-red-600" : ""} ${className}`}>
      {fmt(amount)}
    </span>
  )
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────
export function BalanceSheetView({ entityId }: { entityId: string }) {
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/reports/balance-sheet?as_of=${asOf}`)
    const json = await res.json()
    setReport(json.report)
    setLoading(false)
  }, [entityId, asOf])

  useEffect(() => { load() }, [load])

  function Section({ sections, title }: { sections: any[]; title: string }) {
    return (
      <>
        {sections.map((section: any) => (
          <tbody key={section.title}>
            <tr className="bg-gray-50">
              <td colSpan={2} className="px-4 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{section.title}</td>
            </tr>
            {section.lines.map((line: any) => (
              <tr key={line.account_id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-1.5 text-sm text-gray-700" style={{ paddingLeft: `${16 + (line.indent - 1) * 16}px` }}>
                  <span className="text-gray-400 text-xs mr-2">{line.account_code}</span>{line.name}
                </td>
                <td className="px-4 py-1.5 text-right"><AmountCell amount={line.balance} /></td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2 text-sm text-gray-700">Total {section.title}</td>
              <td className="px-4 py-2 text-right border-t border-gray-300"><AmountCell amount={section.total} className="font-bold" /></td>
            </tr>
          </tbody>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Balance Sheet</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">As of</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Computing…</div>
      ) : report && (
        <>
          {!report.is_balanced && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ Balance sheet is unbalanced — Assets ({fmt(report.assets_total)}) ≠ Liabilities + Equity ({fmt(report.liabilities_equity_total)})
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:border-0">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
              <p className="font-bold text-gray-900">Balance Sheet</p>
              <p className="text-sm text-gray-500">As of {asOf}</p>
            </div>
            <table className="w-full">
              <Section sections={report.assets} title="Assets" />
              <tbody>
                <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                  <td className="px-4 py-2 text-sm text-blue-900">TOTAL ASSETS</td>
                  <td className="px-4 py-2 text-right"><AmountCell amount={report.assets_total} className="font-bold text-blue-900" /></td>
                </tr>
              </tbody>
              <Section sections={report.liabilities} title="Liabilities" />
              <Section sections={report.equity} title="Equity" />
              <tbody>
                <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                  <td className="px-4 py-2 text-sm text-blue-900">TOTAL LIABILITIES + EQUITY</td>
                  <td className="px-4 py-2 text-right"><AmountCell amount={report.liabilities_equity_total} className="font-bold text-blue-900" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Income Statement ─────────────────────────────────────────────────────────
export function IncomeStatementView({ entityId }: { entityId: string }) {
  const now = new Date()
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/reports/income-statement?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    setReport(json.report)
    setLoading(false)
  }, [entityId, startDate, endDate])

  useEffect(() => { load() }, [load])

  function Section({ sections }: { sections: any[] }) {
    return (
      <>
        {sections.map((section: any) => (
          <tbody key={section.title}>
            <tr className="bg-gray-50">
              <td colSpan={2} className="px-4 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{section.title}</td>
            </tr>
            {section.lines.map((line: any) => (
              <tr key={line.account_id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-1.5 text-sm text-gray-700" style={{ paddingLeft: `${16 + (line.indent - 1) * 16}px` }}>
                  <span className="text-gray-400 text-xs mr-2">{line.account_code}</span>{line.name}
                </td>
                <td className="px-4 py-1.5 text-right"><AmountCell amount={line.balance} /></td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2 text-sm text-gray-700">Total {section.title}</td>
              <td className="px-4 py-2 text-right border-t border-gray-300"><AmountCell amount={section.total} className="font-bold" /></td>
            </tr>
          </tbody>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Income Statement</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Computing…</div>
      ) : report && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
            <p className="font-bold text-gray-900">Income Statement</p>
            <p className="text-sm text-gray-500">{startDate} to {endDate}</p>
          </div>
          <table className="w-full">
            <Section sections={report.revenue} />
            <tbody>
              <tr className="bg-green-50 font-semibold border-t-2 border-green-200">
                <td className="px-4 py-2 text-sm text-green-900">Total Revenue</td>
                <td className="px-4 py-2 text-right"><AmountCell amount={report.revenue_total} className="text-green-900 font-bold" /></td>
              </tr>
            </tbody>
            <Section sections={report.expenses} />
            <tbody>
              <tr className="bg-red-50 font-semibold border-t-2 border-red-200">
                <td className="px-4 py-2 text-sm text-red-900">Total Expenses</td>
                <td className="px-4 py-2 text-right"><AmountCell amount={report.expenses_total} className="text-red-900 font-bold" /></td>
              </tr>
              <tr className={`font-bold border-t-2 ${report.net_income >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-100 border-red-300"}`}>
                <td className="px-4 py-2.5 text-sm text-blue-900">NET INCOME</td>
                <td className="px-4 py-2.5 text-right"><AmountCell amount={report.net_income} className="font-bold text-blue-900" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Cash Flow Statement ──────────────────────────────────────────────────────
export function CashFlowView({ entityId }: { entityId: string }) {
  const now = new Date()
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/reports/cash-flows?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    setReport(json.report)
    setLoading(false)
  }, [entityId, startDate, endDate])

  useEffect(() => { load() }, [load])

  function CashSection({ title, items, total, color }: { title: string; items: any[]; total: number; color: string }) {
    return (
      <tbody>
        <tr className="bg-gray-50">
          <td colSpan={2} className="px-4 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</td>
        </tr>
        {items.map((item: any, i: number) => (
          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
            <td className="px-8 py-1.5 text-sm text-gray-700">{item.label}</td>
            <td className="px-4 py-1.5 text-right"><AmountCell amount={item.amount} /></td>
          </tr>
        ))}
        <tr className={`font-semibold border-t border-gray-200 ${color}`}>
          <td className="px-4 py-2 text-sm">Net Cash from {title}</td>
          <td className="px-4 py-2 text-right"><AmountCell amount={total} className="font-bold" /></td>
        </tr>
      </tbody>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Statement of Cash Flows</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Computing…</div>
      ) : report && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
            <p className="font-bold text-gray-900">Statement of Cash Flows</p>
            <p className="text-sm text-gray-500">{startDate} to {endDate} · Indirect Method</p>
          </div>
          <table className="w-full">
            <CashSection title="Operating Activities" items={report.operating} total={report.operating_total} color="bg-blue-50" />
            <CashSection title="Investing Activities" items={report.investing} total={report.investing_total} color="bg-yellow-50" />
            <CashSection title="Financing Activities" items={report.financing} total={report.financing_total} color="bg-purple-50" />
            <tbody>
              <tr className="bg-gray-50 font-semibold border-t border-gray-300">
                <td className="px-4 py-2 text-sm">Beginning Cash Balance</td>
                <td className="px-4 py-2 text-right"><AmountCell amount={report.beginning_cash} /></td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2 text-sm">Net Change in Cash</td>
                <td className="px-4 py-2 text-right"><AmountCell amount={report.net_change} /></td>
              </tr>
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td className="px-4 py-2.5 text-sm text-blue-900">ENDING CASH BALANCE</td>
                <td className="px-4 py-2.5 text-right"><AmountCell amount={report.ending_cash} className="font-bold text-blue-900" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Partners' Capital Statement ──────────────────────────────────────────────
export function PartnersCapitalView({ entityId }: { entityId: string }) {
  const now = new Date()
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/reports/partners-capital?start_date=${startDate}&end_date=${endDate}`)
    const json = await res.json()
    setReport(json.report)
    setLoading(false)
  }, [entityId, startDate, endDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Partners' Capital Statement</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Computing…</div>
      ) : report && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
            <p className="font-bold text-gray-900">Statement of Changes in Partners' Capital</p>
            <p className="text-sm text-gray-500">{startDate} to {endDate}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Partner</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Ownership %</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Beginning Capital</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Contributions</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Net Income Alloc.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Distributions</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Ending Capital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((row: any) => (
                  <tr key={row.member_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.member_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.ownership_pct.toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right"><AmountCell amount={row.beginning_capital} /></td>
                    <td className="px-4 py-2.5 text-right text-green-700"><AmountCell amount={row.contributions} /></td>
                    <td className="px-4 py-2.5 text-right"><AmountCell amount={row.net_income_allocated} /></td>
                    <td className="px-4 py-2.5 text-right text-red-600"><AmountCell amount={row.distributions} /></td>
                    <td className="px-4 py-2.5 text-right font-bold"><AmountCell amount={row.ending_capital} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                  <td className="px-4 py-2.5 text-blue-900">Total</td>
                  <td className="px-4 py-2.5 text-right text-blue-900">100%</td>
                  <td className="px-4 py-2.5 text-right"><AmountCell amount={report.totals.beginning_capital} className="font-bold text-blue-900" /></td>
                  <td className="px-4 py-2.5 text-right"><AmountCell amount={report.totals.contributions} className="font-bold text-blue-900" /></td>
                  <td className="px-4 py-2.5 text-right"><AmountCell amount={report.totals.net_income_allocated} className="font-bold text-blue-900" /></td>
                  <td className="px-4 py-2.5 text-right"><AmountCell amount={report.totals.distributions} className="font-bold text-blue-900" /></td>
                  <td className="px-4 py-2.5 text-right"><AmountCell amount={report.totals.ending_capital} className="font-bold text-blue-900" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Trial Balance ────────────────────────────────────────────────────────────
export function TrialBalanceView({ entityId }: { entityId: string }) {
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hideZero, setHideZero] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/reports/trial-balance?as_of=${asOf}`)
    const json = await res.json()
    setReport(json.report)
    setLoading(false)
  }, [entityId, asOf])

  useEffect(() => { load() }, [load])

  const displayLines = report?.lines?.filter((l: any) => !hideZero || (l.net_debit > 0 || l.net_credit > 0)) ?? []

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Trial Balance</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="rounded" />
            Hide zero-balance
          </label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={load} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Computing…</div>
      ) : report && (
        <>
          {!report.is_balanced && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ Trial balance does not balance — review posted entries
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 text-center">
              <p className="font-bold text-gray-900">Trial Balance</p>
              <p className="text-sm text-gray-500">As of {asOf}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-blue-700">Debit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-green-700">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayLines.map((line: any) => (
                  <tr key={line.account_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{line.account_code}</td>
                    <td className="px-4 py-2 text-gray-800">{line.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 capitalize">{line.type}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-blue-700">
                      {line.net_debit > 0 ? fmt(line.net_debit) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-green-700">
                      {line.net_credit > 0 ? fmt(line.net_credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`font-bold border-t-2 ${report.is_balanced ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <td colSpan={3} className="px-4 py-2.5 text-sm">
                    {report.is_balanced ? "✓ Balanced" : "⚠ Unbalanced"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-blue-900">{fmt(report.total_debits)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-green-900">{fmt(report.total_credits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
