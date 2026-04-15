"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import type { K1Allocation } from "@/lib/types/partnerships"

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

interface BoxField {
  key: keyof K1Allocation
  label: string
  description: string
  isJson?: boolean
}

const BOX_FIELDS: { section: string; fields: BoxField[] }[] = [
  {
    section: "Partner Capital Account Analysis",
    fields: [
      { key: "beginning_capital", label: "Beginning Capital", description: "Capital account balance at start of year" },
      { key: "contributions", label: "Contributions", description: "Capital contributed during the year" },
      { key: "net_income_allocated", label: "Net Income (Loss) Allocated", description: "Partner's share of entity net income" },
      { key: "withdrawals", label: "Withdrawals / Distributions", description: "Capital withdrawn during the year" },
      { key: "ending_capital", label: "Ending Capital", description: "Capital account balance at end of year" },
    ],
  },
  {
    section: "Income (Loss)",
    fields: [
      { key: "box_1_ordinary_income", label: "Box 1 — Ordinary Business Income (Loss)", description: "Partner's share of ordinary income or loss from the partnership's business" },
      { key: "box_2_net_rental_re_income", label: "Box 2 — Net Rental Real Estate Income (Loss)", description: "Partner's share of rental real estate net income or loss" },
      { key: "box_3_other_net_rental_income", label: "Box 3 — Other Net Rental Income (Loss)", description: "Partner's share of other rental income or loss" },
      { key: "box_4_guaranteed_payments_svc", label: "Box 4 — Guaranteed Payments for Services", description: "Guaranteed payments to this partner for services" },
      { key: "box_5_guaranteed_payments_cap", label: "Box 5 — Guaranteed Payments for Capital", description: "Guaranteed payments to this partner for use of capital" },
      { key: "box_6_net_1231_gain", label: "Box 6 — Net Section 1231 Gain (Loss)", description: "Partner's share of Section 1231 gain or loss" },
      { key: "box_7_other_income", label: "Box 7 — Other Income (Loss)", description: "Other income or loss not classified elsewhere" },
      { key: "box_11_other_income_loss", label: "Box 11 — Other Income (Loss) [JSON]", description: "Array of other income/loss items with code, description, amount", isJson: true },
    ],
  },
  {
    section: "Capital Gains",
    fields: [
      { key: "box_9a_lt_capital_gain", label: "Box 9a — Net Long-Term Capital Gain (Loss)", description: "Partner's share of long-term capital gains or losses" },
      { key: "box_9b_collectibles_gain", label: "Box 9b — Collectibles (28%) Gain (Loss)", description: "Partner's share of 28% rate gain from collectibles" },
      { key: "box_9c_unrec_1250_gain", label: "Box 9c — Unrecaptured Section 1250 Gain", description: "Partner's share of unrecaptured Section 1250 gain" },
      { key: "box_10_net_1231_gain_28", label: "Box 10 — Net Section 1231 Gain (28%)", description: "28% rate Section 1231 gain" },
    ],
  },
  {
    section: "Deductions & Credits",
    fields: [
      { key: "box_12_section_179", label: "Box 12 — Section 179 Deduction", description: "Partner's share of Section 179 expense deduction" },
      { key: "box_13_other_deductions", label: "Box 13 — Other Deductions [JSON]", description: "Array of other deductions with code, description, amount", isJson: true },
      { key: "box_15_credits", label: "Box 15 — Credits [JSON]", description: "Array of credits with code, description, amount", isJson: true },
    ],
  },
  {
    section: "Tax Information",
    fields: [
      { key: "box_17_amt_items", label: "Box 17 — AMT Items [JSON]", description: "Alternative minimum tax items", isJson: true },
      { key: "box_18_tax_exempt", label: "Box 18 — Tax-Exempt Income [JSON]", description: "Tax-exempt income and nondeductible expenses", isJson: true },
    ],
  },
  {
    section: "Distributions",
    fields: [
      { key: "box_19a_distributions_cash", label: "Box 19a — Cash Distributions", description: "Cash distributions during the year" },
      { key: "box_19c_distributions_prop", label: "Box 19c — Property Distributions", description: "Property distributions (fair market value)" },
    ],
  },
  {
    section: "Other",
    fields: [
      { key: "box_20_other_info", label: "Box 20 — Other Information [JSON]", description: "Other information items with code, description, amount", isJson: true },
    ],
  },
]

export function K1DetailForm() {
  const { entityId, memberId } = useParams<{ entityId: string; memberId: string }>()
  const searchParams = useSearchParams()
  const fiscalYearId = searchParams.get("fiscal_year_id") ?? ""
  const router = useRouter()
  const [k1, setK1] = useState<K1Allocation | null>(null)
  const [edits, setEdits] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/k1s/${memberId}?fiscal_year_id=${fiscalYearId}`)
    const json = await res.json()
    setK1(json.k1)
    setEdits({})
    setLoading(false)
  }, [entityId, memberId, fiscalYearId])

  useEffect(() => { load() }, [load])

  function getValue(field: BoxField): any {
    if (edits[field.key as string] !== undefined) return edits[field.key as string]
    return (k1 as any)?.[field.key as string] ?? 0
  }

  function handleChange(key: string, value: any) {
    setEdits(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload: Record<string, any> = { fiscal_year_id: fiscalYearId }
    for (const [key, val] of Object.entries(edits)) {
      const field = BOX_FIELDS.flatMap(s => s.fields).find(f => f.key === key)
      if (field?.isJson) {
        try { payload[key] = typeof val === "string" ? JSON.parse(val) : val }
        catch { setError(`Invalid JSON in ${field.label}`); setSaving(false); return }
      } else {
        payload[key] = Number(val) || 0
      }
    }
    const res = await fetch(`/api/partnerships/${entityId}/accounting/k1s/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    setEdits({})
    load()
  }

  async function handleFinalize() {
    if (!confirm("Finalize this K-1? Finalized K-1s cannot be edited.")) return
    setFinalizing(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/k1s/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year_id: fiscalYearId, is_final: true }),
    })
    setFinalizing(false)
    if (res.ok) load()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading K-1…</div>
  if (!k1) return <div className="text-sm text-red-500 py-8 text-center">K-1 not found. Generate K-1s first.</div>

  const isReadOnly = k1.is_final
  const memberName = (k1 as any).member?.display_name ?? "Partner"
  const fyLabel = (k1 as any).fiscal_year?.label ?? fiscalYearId
  const hasEdits = Object.keys(edits).length > 0

  if (printMode) {
    return <K1PrintView k1={k1} memberName={memberName} fyLabel={fyLabel} onClose={() => setPrintMode(false)} />
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">Schedule K-1 — {memberName}</h2>
          <p className="text-sm text-gray-500">{fyLabel} · Form 1065 Partner's Share</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${k1.is_final ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
            {k1.is_final ? "Finalized" : "Draft"}
          </span>
          <button onClick={() => setPrintMode(true)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
            Print / Export PDF
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {isReadOnly && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          This K-1 has been finalized and is read-only.
        </div>
      )}

      {/* Partner info summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Ownership %</p>
          <p className="text-lg font-bold text-gray-900">{k1.ownership_pct.toFixed(2)}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Ending Capital</p>
          <p className="text-lg font-bold text-gray-900">{fmt(k1.ending_capital)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Capital Method</p>
          <p className="text-lg font-bold text-gray-900 uppercase">{k1.capital_method}</p>
        </div>
      </div>

      {/* Box editor sections */}
      {BOX_FIELDS.map(({ section, fields }) => (
        <div key={section} className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{section}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {fields.map(field => {
              const val = getValue(field)
              const isEdited = edits[field.key as string] !== undefined
              return (
                <div key={field.key as string} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{field.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                  </div>
                  <div className="w-52 text-right">
                    {field.isJson ? (
                      <textarea
                        disabled={isReadOnly}
                        rows={2}
                        className={`w-full border rounded px-2 py-1 text-xs font-mono ${isEdited ? "border-blue-400 bg-blue-50" : ""} disabled:bg-gray-50`}
                        value={isEdited ? edits[field.key as string] : JSON.stringify(val, null, 1)}
                        onChange={e => handleChange(field.key as string, e.target.value)}
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        disabled={isReadOnly}
                        className={`w-full border rounded px-2 py-1.5 text-sm text-right ${isEdited ? "border-blue-400 bg-blue-50" : ""} disabled:bg-gray-50`}
                        value={isEdited ? edits[field.key as string] : val}
                        onChange={e => handleChange(field.key as string, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!isReadOnly && (
        <div className="flex items-center gap-3 pb-6">
          <button onClick={handleSave} disabled={saving || !hasEdits}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={handleFinalize} disabled={finalizing}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {finalizing ? "Finalizing…" : "Finalize K-1"}
          </button>
          {hasEdits && (
            <button onClick={() => setEdits({})} className="text-sm text-gray-500 hover:underline">Discard changes</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Print View ───────────────────────────────────────────────────────────────

export function K1PrintView({
  k1,
  memberName,
  fyLabel,
  onClose,
}: {
  k1: K1Allocation
  memberName: string
  fyLabel: string
  onClose: () => void
}) {
  function Row({ label, value }: { label: string; value: number | string }) {
    const num = typeof value === "number" ? value : parseFloat(value as string) || 0
    if (num === 0) return null
    return (
      <tr className="border-b border-gray-100">
        <td className="py-1 text-xs text-gray-600">{label}</td>
        <td className="py-1 text-xs text-right font-mono">{typeof value === "number" ? fmt(value) : value}</td>
      </tr>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h2 className="text-lg font-semibold">K-1 Print Preview</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Print / Save as PDF
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-800 p-6 max-w-2xl mx-auto text-sm print:border-0 print:p-0" id="k1-print">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
          <p className="text-xs text-gray-600">SCHEDULE K-1 (FORM 1065)</p>
          <p className="text-xl font-bold">Partner's Share of Income, Deductions, Credits, etc.</p>
          <p className="text-sm text-gray-600">Tax Year: {fyLabel}</p>
        </div>

        {/* Partner info */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Partner Name</p>
            <p className="font-semibold">{memberName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Ownership %</p>
            <p className="font-semibold">{k1.ownership_pct.toFixed(2)}%</p>
          </div>
        </div>

        {/* Capital account */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2 border-b pb-1">Part II — Partner Capital Account Analysis</p>
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1 text-xs text-gray-600">Beginning Capital Account</td>
                <td className="py-1 text-xs text-right font-mono">{fmt(k1.beginning_capital)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1 text-xs text-gray-600">Capital Contributed During Year</td>
                <td className="py-1 text-xs text-right font-mono">{fmt(k1.contributions)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1 text-xs text-gray-600">Net Income (Loss) Allocated</td>
                <td className="py-1 text-xs text-right font-mono">{fmt(k1.net_income_allocated)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1 text-xs text-gray-600">Withdrawals / Distributions</td>
                <td className="py-1 text-xs text-right font-mono">({fmt(k1.withdrawals)})</td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-1 text-xs">Ending Capital Account</td>
                <td className="py-1 text-xs text-right font-mono">{fmt(k1.ending_capital)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Schedule K-1 boxes */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2 border-b pb-1">Part III — Partner's Share of Current Year Items</p>
          <table className="w-full">
            <tbody>
              <Row label="Box 1 — Ordinary Business Income (Loss)" value={k1.box_1_ordinary_income} />
              <Row label="Box 2 — Net Rental Real Estate Income" value={k1.box_2_net_rental_re_income} />
              <Row label="Box 3 — Other Net Rental Income" value={k1.box_3_other_net_rental_income} />
              <Row label="Box 4 — Guaranteed Payments (Services)" value={k1.box_4_guaranteed_payments_svc} />
              <Row label="Box 5 — Guaranteed Payments (Capital)" value={k1.box_5_guaranteed_payments_cap} />
              <Row label="Box 6 — Net Section 1231 Gain (Loss)" value={k1.box_6_net_1231_gain} />
              <Row label="Box 7 — Other Income (Loss)" value={k1.box_7_other_income} />
              <Row label="Box 9a — Net LT Capital Gain (Loss)" value={k1.box_9a_lt_capital_gain} />
              <Row label="Box 9b — Collectibles (28%) Gain" value={k1.box_9b_collectibles_gain} />
              <Row label="Box 9c — Unrecaptured Sec 1250 Gain" value={k1.box_9c_unrec_1250_gain} />
              <Row label="Box 10 — Net Sec 1231 Gain (28%)" value={k1.box_10_net_1231_gain_28} />
              <Row label="Box 12 — Section 179 Deduction" value={k1.box_12_section_179} />
              <Row label="Box 19a — Cash Distributions" value={k1.box_19a_distributions_cash} />
              <Row label="Box 19c — Property Distributions" value={k1.box_19c_distributions_prop} />
              {(k1.box_13_other_deductions ?? []).map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs text-gray-600">Box 13 ({item.code}) — {item.description}</td>
                  <td className="py-1 text-xs text-right font-mono">{fmt(item.amount)}</td>
                </tr>
              ))}
              {(k1.box_15_credits ?? []).map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs text-gray-600">Box 15 ({item.code}) — {item.description}</td>
                  <td className="py-1 text-xs text-right font-mono">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-gray-300 text-xs text-gray-400 text-center">
          This K-1 is computer-generated. Consult your tax advisor. Capital method: {k1.capital_method.toUpperCase()}
          {k1.is_final && ` · Finalized ${k1.finalized_at?.split("T")[0] ?? ""}`}
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#k1-print) { display: none !important; }
          #k1-print { display: block !important; }
        }
      `}</style>
    </div>
  )
}
