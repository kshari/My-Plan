"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Account, JournalLine } from "@/lib/types/partnerships"

const EMPTY_LINE = (): JournalLine & { _tempId: number } => ({
  _tempId: Date.now() + Math.random(),
  id: "",
  journal_entry_id: "",
  entity_id: "",
  account_id: "",
  debit: 0,
  credit: 0,
  memo: null,
  line_order: 0,
})

interface Props {
  entityId: string
  entryId?: string  // undefined = new entry
  onSaved?: () => void
}

export function JournalEntryForm({ entityId, entryId, onSaved }: Props) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fiscalYears, setFiscalYears] = useState<{ id: string; label: string }[]>([])
  const [lines, setLines] = useState<(JournalLine & { _tempId: number })[]>([
    EMPTY_LINE(), EMPTY_LINE(),
  ])
  const [description, setDescription] = useState("")
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0])
  const [fiscalYearId, setFiscalYearId] = useState("")
  const [status, setStatus] = useState<"draft" | "posted">("draft")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff < 0.01

  const load = useCallback(async () => {
    const [acctRes, fyRes] = await Promise.all([
      fetch(`/api/partnerships/${entityId}/accounting/accounts`),
      fetch(`/api/partnerships/${entityId}/accounting/fiscal-years`),
    ])
    const acctJson = await acctRes.json()
    const fyJson = await fyRes.json()
    setAccounts(acctJson.accounts ?? [])
    const fys = fyJson.fiscal_years ?? []
    setFiscalYears(fys)
    if (fys.length > 0 && !fiscalYearId) setFiscalYearId(fys[0].id)

    if (entryId) {
      const entryRes = await fetch(`/api/partnerships/${entityId}/accounting/journal-entries/${entryId}`)
      const entryJson = await entryRes.json()
      const entry = entryJson.journal_entry
      if (entry) {
        setDescription(entry.description)
        setEntryDate(entry.entry_date)
        setFiscalYearId(entry.fiscal_year_id ?? "")
        setStatus(entry.status === "posted" ? "posted" : "draft")
        if (entry.lines?.length) {
          setLines(entry.lines.map((l: any) => ({ ...l, _tempId: Math.random() })))
        }
      }
    }
    setLoading(false)
  }, [entityId, entryId])

  useEffect(() => { load() }, [load])

  function updateLine(tempId: number, field: string, value: string | number) {
    setLines(prev => prev.map(l => {
      if (l._tempId !== tempId) return l
      if (field === "debit") return { ...l, debit: Number(value) || 0, credit: Number(value) > 0 ? 0 : l.credit }
      if (field === "credit") return { ...l, credit: Number(value) || 0, debit: Number(value) > 0 ? 0 : l.debit }
      return { ...l, [field]: value }
    }))
  }

  function addLine() { setLines(prev => [...prev, EMPTY_LINE()]) }
  function removeLine(tempId: number) {
    if (lines.length <= 2) return
    setLines(prev => prev.filter(l => l._tempId !== tempId))
  }

  async function handleSave(saveStatus: "draft" | "posted") {
    setError(null)
    if (!description) { setError("Description is required"); return }
    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0))
    if (validLines.length < 2) { setError("At least 2 lines with amounts are required"); return }
    if (saveStatus === "posted" && !balanced) {
      setError(`Entry is unbalanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`); return
    }
    setSaving(true)

    const payload = {
      description,
      entry_date: entryDate,
      fiscal_year_id: fiscalYearId || null,
      status: saveStatus,
      lines: validLines.map((l, idx) => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo,
        line_order: idx,
      })),
    }

    const url = entryId
      ? `/api/partnerships/${entityId}/accounting/journal-entries/${entryId}`
      : `/api/partnerships/${entityId}/accounting/journal-entries`
    const method = entryId ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    onSaved?.()
    router.push(`/apps/partnerships/${entityId}/accounting/journal-entries`)
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>

  const isPosted = !!entryId && status === "posted"

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {entryId ? (isPosted ? "View Journal Entry" : "Edit Journal Entry") : "New Journal Entry"}
        </h2>
        {isPosted && (
          <span className="text-xs bg-green-100 text-green-800 font-semibold px-2.5 py-1 rounded-full">Posted</span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-600 font-medium">Date</label>
          <input type="date" required disabled={isPosted}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
            value={entryDate} onChange={e => setEntryDate(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-600 font-medium">Description</label>
          <input type="text" required disabled={isPosted}
            placeholder="e.g. Record management fee payment"
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-600 font-medium">Fiscal Year</label>
          <select disabled={isPosted}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
            value={fiscalYearId} onChange={e => setFiscalYearId(e.target.value)}>
            <option value="">— None —</option>
            {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.label}</option>)}
          </select>
        </div>
      </div>

      {/* Journal lines */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-80">Account</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Memo</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-blue-700 w-32">Debit</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-green-700 w-32">Credit</th>
              {!isPosted && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, idx) => (
              <tr key={line._tempId} className="bg-white">
                <td className="px-3 py-2">
                  <select disabled={isPosted}
                    className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                    value={line.account_id}
                    onChange={e => updateLine(line._tempId, "account_id", e.target.value)}>
                    <option value="">— Select account —</option>
                    {["asset","liability","equity","income","expense"].map(type => (
                      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                        {accounts.filter(a => a.type === type && a.is_active).map(a => (
                          <option key={a.id} value={a.id}>{a.account_code} — {a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input disabled={isPosted}
                    className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50"
                    placeholder="Optional memo"
                    value={line.memo ?? ""}
                    onChange={e => updateLine(line._tempId, "memo", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min="0" step="0.01" disabled={isPosted}
                    className="w-full border rounded px-2 py-1.5 text-sm text-right text-blue-700 disabled:bg-gray-50"
                    value={line.debit || ""}
                    onChange={e => updateLine(line._tempId, "debit", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min="0" step="0.01" disabled={isPosted}
                    className="w-full border rounded px-2 py-1.5 text-sm text-right text-green-700 disabled:bg-gray-50"
                    value={line.credit || ""}
                    onChange={e => updateLine(line._tempId, "credit", e.target.value)} />
                </td>
                {!isPosted && (
                  <td className="px-1 py-2 text-center">
                    <button onClick={() => removeLine(line._tempId)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 ${balanced ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
              <td className="px-3 py-2 text-xs font-semibold text-gray-600" colSpan={2}>
                {balanced
                  ? <span className="text-green-700">✓ Balanced</span>
                  : <span className="text-red-600">⚠ Unbalanced — difference: ${diff.toFixed(2)}</span>}
              </td>
              <td className="px-3 py-2 text-right text-sm font-bold text-blue-700">
                ${totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2 text-right text-sm font-bold text-green-700">
                ${totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </td>
              {!isPosted && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!isPosted && (
        <div className="flex items-center gap-3">
          <button onClick={() => addLine()}
            className="text-sm text-blue-600 hover:underline">+ Add line</button>
          <div className="flex-1" />
          <button onClick={() => handleSave("draft")} disabled={saving}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Save as Draft
          </button>
          <button onClick={() => handleSave("posted")} disabled={saving || !balanced}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Posting…" : "Post Entry"}
          </button>
        </div>
      )}
    </div>
  )
}
