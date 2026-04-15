"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import type { K1Allocation } from "@/lib/types/partnerships"

function fmt(n: number) {
  if (n === 0) return "—"
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function K1SummaryList() {
  const { entityId } = useParams<{ entityId: string }>()
  const router = useRouter()
  const [k1s, setK1s] = useState<K1Allocation[]>([])
  const [fiscalYears, setFiscalYears] = useState<{ id: string; label: string; tax_year: number }[]>([])
  const [selectedFy, setSelectedFy] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const loadFys = useCallback(async () => {
    const res = await fetch(`/api/partnerships/${entityId}/accounting/fiscal-years`)
    const json = await res.json()
    const fys = json.fiscal_years ?? []
    setFiscalYears(fys)
    if (fys.length > 0) setSelectedFy(fys[0].id)
  }, [entityId])

  const loadK1s = useCallback(async (fyId: string) => {
    if (!fyId) return
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/k1s?fiscal_year_id=${fyId}`)
    const json = await res.json()
    setK1s(json.k1s ?? [])
    setLoading(false)
  }, [entityId])

  useEffect(() => { loadFys() }, [loadFys])
  useEffect(() => { if (selectedFy) loadK1s(selectedFy) }, [selectedFy, loadK1s])

  async function handleGenerate() {
    if (!selectedFy) return
    setGenerating(true)
    setGenError(null)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/k1s/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year_id: selectedFy }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setGenError(json.error); return }
    loadK1s(selectedFy)
  }

  const selectedFyLabel = fiscalYears.find(fy => fy.id === selectedFy)?.label ?? ""

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schedule K-1 Management</h2>
          <p className="text-sm text-gray-500">Generate, review, and export partner K-1s (Form 1065)</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedFy} onChange={e => setSelectedFy(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm">
            {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating || !selectedFy}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {generating ? "Generating…" : "Generate / Refresh K-1s"}
          </button>
        </div>
      </div>

      {genError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{genError}</div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Workflow:</strong> Click "Generate / Refresh K-1s" to compute allocations from posted journal entries.
        Then review and manually adjust boxes as needed. Click "Finalize" when ready for partner distribution.
        Use the print view for PDF export.
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading K-1s…</div>
      ) : k1s.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center border-2 border-dashed rounded-lg">
          No K-1s for {selectedFyLabel}. Click "Generate / Refresh K-1s" to compute allocations from journal entries.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {k1s.map(k1 => (
            <div key={k1.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/k1s/${k1.member_id}?fiscal_year_id=${k1.fiscal_year_id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{(k1 as any).member?.display_name ?? "Partner"}</p>
                  <p className="text-xs text-gray-500">{k1.ownership_pct.toFixed(2)}% ownership · {selectedFyLabel}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k1.is_final ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {k1.is_final ? "Finalized" : "Draft"}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Box 1: Ordinary Income</span>
                  <span className={k1.box_1_ordinary_income < 0 ? "text-red-600" : "text-gray-900"}>{fmt(k1.box_1_ordinary_income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Box 9a: LT Capital Gain</span>
                  <span className="text-gray-900">{fmt(k1.box_9a_lt_capital_gain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Box 19a: Cash Distributions</span>
                  <span className="text-gray-900">{fmt(k1.box_19a_distributions_cash)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-gray-500">Ending Capital</span>
                  <span className="font-semibold text-gray-900">{fmt(k1.ending_capital)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
