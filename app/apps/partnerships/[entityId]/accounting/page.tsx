"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"

function fmt(n: number) {
  if (n === undefined || n === null) return "—"
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(2)
}

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default function AccountingDashboardPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const router = useRouter()
  const [fiscalYears, setFiscalYears] = useState<any[]>([])
  const [selectedFy, setSelectedFy] = useState<any>(null)
  const [bs, setBs] = useState<any>(null)
  const [is_, setIs] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (fy?: any) => {
    setLoading(true)
    const fyToUse = fy ?? selectedFy
    const [fyRes, acctRes, jeRes] = await Promise.all([
      fetch(`/api/partnerships/${entityId}/accounting/fiscal-years`),
      fetch(`/api/partnerships/${entityId}/accounting/accounts`),
      fetch(`/api/partnerships/${entityId}/accounting/journal-entries`),
    ])
    const fyJson = await fyRes.json()
    const acctJson = await acctRes.json()
    const jeJson = await jeRes.json()

    const fys = fyJson.fiscal_years ?? []
    setFiscalYears(fys)
    setAccounts(acctJson.accounts ?? [])
    setEntries(jeJson.journal_entries ?? [])

    const activeFy = fyToUse ?? fys[0]
    setSelectedFy(activeFy)

    if (activeFy) {
      const [bsRes, isRes] = await Promise.all([
        fetch(`/api/partnerships/${entityId}/accounting/reports/balance-sheet?as_of=${activeFy.end_date}`),
        fetch(`/api/partnerships/${entityId}/accounting/reports/income-statement?start_date=${activeFy.start_date}&end_date=${activeFy.end_date}`),
      ])
      const bsJson = await bsRes.json()
      const isJson = await isRes.json()
      setBs(bsJson.report)
      setIs(isJson.report)
    }
    setLoading(false)
  }, [entityId, selectedFy])

  useEffect(() => { load() }, [entityId])

  const activeAccounts = accounts.filter(a => a.is_active).length
  const draftEntries = entries.filter(e => e.status === "draft").length
  const postedEntries = entries.filter(e => e.status === "posted").length

  const NAV_ITEMS = [
    { label: "Chart of Accounts", path: "chart-of-accounts", icon: "📋", desc: "Manage your account structure" },
    { label: "Journal Entries", path: "journal-entries", icon: "📝", desc: "Record and post transactions" },
    { label: "Balance Sheet", path: "balance-sheet", icon: "⚖️", desc: "Assets, liabilities, equity" },
    { label: "Income Statement", path: "income-statement", icon: "📈", desc: "Revenue and expenses P&L" },
    { label: "Cash Flows", path: "cash-flows", icon: "💧", desc: "Operating, investing, financing" },
    { label: "Partners' Capital", path: "partners-capital", icon: "🤝", desc: "Capital account changes" },
    { label: "Trial Balance", path: "trial-balance", icon: "🔢", desc: "Verify accounting equation" },
    { label: "Schedule K-1", path: "k1s", icon: "🗂️", desc: "Generate and export K-1s" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Accounting</h2>
          <p className="text-sm text-gray-500 mt-0.5">Full double-entry accounting system</p>
        </div>
        {fiscalYears.length > 0 && (
          <select
            value={selectedFy?.id ?? ""}
            onChange={e => {
              const fy = fiscalYears.find(f => f.id === e.target.value)
              setSelectedFy(fy)
              load(fy)
            }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
          </select>
        )}
      </div>

      {/* Quick stats */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Assets" value={bs ? fmtFull(bs.assets_total) : "—"} color="blue"
            sub={bs?.is_balanced === false ? "⚠ Unbalanced" : undefined} />
          <StatCard label="Net Income" value={is_ ? fmtFull(is_.net_income) : "—"} color={is_?.net_income >= 0 ? "green" : "red"}
            sub={selectedFy?.label} />
          <StatCard label="Posted Entries" value={postedEntries.toString()} color="purple"
            sub={`${draftEntries} drafts pending`} />
          <StatCard label="Active Accounts" value={activeAccounts.toString()} color="gray"
            sub="in chart of accounts" />
        </div>
      )}

      {/* Navigation grid */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Accounting Modules</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {NAV_ITEMS.map(item => (
            <button key={item.path}
              onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/${item.path}`)}
              className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors group">
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent entries */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Journal Entries</p>
            <button onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries`)}
              className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {entries.slice(0, 5).map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries/${entry.id}`)}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 w-24">{entry.entry_date}</td>
                    <td className="px-4 py-2.5 text-gray-800">{entry.description}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${entry.status === "posted" ? "bg-green-100 text-green-700" : entry.status === "voided" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fiscalYears.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500 mb-2">No fiscal years set up yet.</p>
          <p className="text-sm text-gray-400">Create a new entity to automatically set up the first fiscal year and chart of accounts.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  }
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] ?? colorMap.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}
