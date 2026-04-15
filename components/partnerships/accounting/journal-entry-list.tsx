"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import type { JournalEntry } from "@/lib/types/partnerships"

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  posted: "bg-green-100 text-green-800",
  voided: "bg-gray-100 text-gray-500 line-through",
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function JournalEntryList() {
  const { entityId } = useParams<{ entityId: string }>()
  const router = useRouter()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "draft" | "posted" | "voided">("all")
  const [search, setSearch] = useState("")
  const [voidingId, setVoidingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== "all") params.set("status", filter)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/journal-entries?${params}`)
    const json = await res.json()
    setEntries(json.journal_entries ?? [])
    setLoading(false)
  }, [entityId, filter])

  useEffect(() => { load() }, [load])

  async function handleVoid(id: string) {
    if (!confirm("Void this journal entry? This cannot be undone.")) return
    setVoidingId(id)
    await fetch(`/api/partnerships/${entityId}/accounting/journal-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "voided" }),
    })
    setVoidingId(null)
    load()
  }

  const filtered = entries.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Journal Entries</h2>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} entries</p>
        </div>
        <button
          onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries/new`)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(["all","draft","posted","voided"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 capitalize ${filter === s ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {s}
            </button>
          ))}
        </div>
        <input
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 max-w-64"
          placeholder="Search descriptions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">
          No journal entries found. <button className="text-blue-600 hover:underline" onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries/new`)}>Create the first one.</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Debits</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Credits</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(entry => {
                const totalDebit = (entry.lines ?? []).reduce((s, l) => s + l.debit, 0)
                const totalCredit = (entry.lines ?? []).reduce((s, l) => s + l.credit, 0)
                return (
                  <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries/${entry.id}`)}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.entry_date}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{entry.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[entry.status]}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700 font-mono text-xs">
                      {totalDebit > 0 ? fmt(totalDebit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-mono text-xs">
                      {totalCredit > 0 ? fmt(totalCredit) : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {entry.status === "draft" && (
                          <button
                            onClick={() => router.push(`/apps/partnerships/${entityId}/accounting/journal-entries/${entry.id}`)}
                            className="text-xs text-blue-600 hover:underline">Edit</button>
                        )}
                        {entry.status === "posted" && (
                          <button
                            onClick={() => handleVoid(entry.id)}
                            disabled={voidingId === entry.id}
                            className="text-xs text-red-500 hover:underline disabled:opacity-50">
                            {voidingId === entry.id ? "Voiding…" : "Void"}
                          </button>
                        )}
                        {entry.status === "draft" && (
                          <button
                            onClick={async () => {
                              await fetch(`/api/partnerships/${entityId}/accounting/journal-entries/${entry.id}`, {
                                method: "DELETE",
                              })
                              load()
                            }}
                            className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
