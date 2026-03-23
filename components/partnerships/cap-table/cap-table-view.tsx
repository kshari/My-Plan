"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users, Plus, AlertCircle, RefreshCw, History,
  SplitSquareHorizontal, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { CapTableEntry, CapitalEvent, CapitalEventType, PartnershipMember } from "@/lib/types/partnerships"
import { cn } from "@/lib/utils"

interface CapTableViewProps {
  entityId: string
  entries: CapTableEntry[]
  members: PartnershipMember[]
  capitalEvents: CapitalEvent[]
  isAdmin: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function getLatestCapTableByMember(entries: CapTableEntry[]): Map<string, CapTableEntry> {
  const map = new Map<string, CapTableEntry>()
  for (const e of entries) {
    const existing = map.get(e.member_id)
    if (
      !existing ||
      e.effective_date > existing.effective_date ||
      (e.effective_date === existing.effective_date && e.created_at > existing.created_at)
    ) {
      map.set(e.member_id, e)
    }
  }
  return map
}

interface SyntheticRow {
  member_id: string
  ownership_pct: number
  effective_date: string | null
  isSynthetic: true
}

type DisplayRow = (CapTableEntry & { isSynthetic?: false }) | SyntheticRow

interface BulkRow {
  member_id: string
  ownership_pct: string
  capital_contributed: string
}

const EVENT_TYPE_LABELS: Record<CapitalEventType, string> = {
  contribution:       "Contribution",
  distribution:       "Distribution",
  return_of_capital:  "Return of Capital",
  fee:                "Fee",
  correction:         "Correction",
}

export function CapTableView({ entityId, entries, members, capitalEvents, isAdmin }: CapTableViewProps) {
  const router = useRouter()

  // ── Ownership change dialog ───────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    member_id: "",
    ownership_pct: "",
    effective_date: new Date().toISOString().split("T")[0],
    notes: "",
  })

  // ── Capital event dialog ──────────────────────────────────────────────────
  const [capitalOpen, setCapitalOpen] = useState(false)
  const [capitalLoading, setCapitalLoading] = useState(false)
  const [capitalForm, setCapitalForm] = useState({
    member_id: "",
    event_type: "contribution" as CapitalEventType,
    amount: "",
    effective_date: new Date().toISOString().split("T")[0],
    notes: "",
  })

  // ── History dialog ────────────────────────────────────────────────────────
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null)

  // ── Sync ──────────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false)

  // ── Bulk dialog ───────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split("T")[0])
  const [bulkNotes, setBulkNotes] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)

  const activeMembers = members.filter((m) => m.status !== "removed")
  const latestByMember = getLatestCapTableByMember(entries)

  // ── Derive capital aggregates from events (the source of truth) ───────────
  const capitalByMember = capitalEvents.reduce<Record<string, { contributed: number; distributed: number }>>(
    (acc, ev) => {
      if (!acc[ev.member_id]) acc[ev.member_id] = { contributed: 0, distributed: 0 }
      if (ev.event_type === "contribution") {
        acc[ev.member_id].contributed += ev.amount
      } else if (ev.event_type === "distribution" || ev.event_type === "return_of_capital") {
        acc[ev.member_id].distributed += ev.amount
      }
      return acc
    },
    {}
  )

  // ── Display rows ──────────────────────────────────────────────────────────
  const displayRows: DisplayRow[] = activeMembers
    .filter((m) => m.ownership_pct > 0 || latestByMember.has(m.id))
    .map((m): DisplayRow => {
      const entry = latestByMember.get(m.id)
      if (entry) return { ...entry, isSynthetic: false }
      return {
        member_id: m.id,
        ownership_pct: m.ownership_pct,
        effective_date: null,
        isSynthetic: true,
      }
    })
    .sort((a, b) => b.ownership_pct - a.ownership_pct)

  const hasSyntheticRows = displayRows.some((r) => "isSynthetic" in r && r.isSynthetic)

  const totalOwnership     = displayRows.reduce((s, r) => s + r.ownership_pct, 0)
  const totalCapital       = Object.values(capitalByMember).reduce((s, v) => s + v.contributed, 0)
  const totalDistributions = Object.values(capitalByMember).reduce((s, v) => s + v.distributed, 0)
  const ownershipWarning   = Math.abs(totalOwnership - 100) > 0.01 && displayRows.length > 0

  // ── Backfill ──────────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true)
    const today = new Date().toISOString().split("T")[0]
    const toSync = activeMembers.filter((m) => m.ownership_pct > 0 && !latestByMember.has(m.id))
    if (toSync.length === 0) {
      toast.info("All members with ownership already have cap table entries.")
      setSyncing(false)
      return
    }
    try {
      await Promise.all(
        toSync.map((m) =>
          fetch(`/api/partnerships/${entityId}/cap-table`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              member_id: m.id,
              ownership_pct: m.ownership_pct,
              effective_date: today,
              notes: "Backfilled from member record",
            }),
          })
        )
      )
      toast.success(`${toSync.length} cap table entr${toSync.length === 1 ? "y" : "ies"} created`)
      router.refresh()
    } catch {
      toast.error("Some entries failed to sync")
    } finally {
      setSyncing(false)
    }
  }

  // ── Record ownership change ───────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.member_id || !form.ownership_pct || !form.effective_date) {
      toast.error("Member, ownership %, and effective date are required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/cap-table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: form.member_id,
          ownership_pct: Number(form.ownership_pct),
          effective_date: form.effective_date,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Ownership change recorded")
      setAddOpen(false)
      setForm({ member_id: "", ownership_pct: "", effective_date: new Date().toISOString().split("T")[0], notes: "" })
      router.refresh()
    } catch {
      toast.error("Failed to record ownership change")
    } finally {
      setLoading(false)
    }
  }

  // ── Record capital event ──────────────────────────────────────────────────
  async function handleCapitalEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!capitalForm.member_id || !capitalForm.amount || !capitalForm.effective_date) {
      toast.error("Member, amount, and effective date are required")
      return
    }
    setCapitalLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/capital-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id:      capitalForm.member_id,
          event_type:     capitalForm.event_type,
          amount:         Number(capitalForm.amount),
          effective_date: capitalForm.effective_date,
          notes:          capitalForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Unknown error")
      toast.success(`${EVENT_TYPE_LABELS[capitalForm.event_type]} recorded`)
      setCapitalOpen(false)
      setCapitalForm({
        member_id: "",
        event_type: "contribution",
        amount: "",
        effective_date: new Date().toISOString().split("T")[0],
        notes: "",
      })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record capital event")
    } finally {
      setCapitalLoading(false)
    }
  }

  // ── Bulk record ───────────────────────────────────────────────────────────
  function openBulkDialog() {
    setBulkRows(
      activeMembers.map((m) => ({
        member_id: m.id,
        ownership_pct: m.ownership_pct > 0 ? String(m.ownership_pct) : "",
        capital_contributed: "",
      }))
    )
    setBulkDate(new Date().toISOString().split("T")[0])
    setBulkNotes("")
    setBulkOpen(true)
  }

  function distributeEqually() {
    const n = bulkRows.length
    if (n === 0) return
    const base = Math.floor((100 / n) * 100) / 100
    const last = Math.round((100 - base * (n - 1)) * 100) / 100
    setBulkRows((prev) => prev.map((r, i) => ({ ...r, ownership_pct: String(i === n - 1 ? last : base) })))
  }

  function updateBulkRow(idx: number, field: keyof BulkRow, value: string) {
    setBulkRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  async function saveBulk() {
    const valid = bulkRows.filter((r) => r.ownership_pct !== "" && Number(r.ownership_pct) >= 0)
    if (valid.length === 0) { toast.error("Enter ownership % for at least one member"); return }
    if (!bulkDate) { toast.error("Effective date is required"); return }
    const totalPct = valid.reduce((s, r) => s + Number(r.ownership_pct), 0)
    if (Math.abs(totalPct - 100) > 0.01) {
      toast.error(`Ownership totals ${totalPct.toFixed(2)}% — it should equal 100%`)
      return
    }
    setBulkSaving(true)
    try {
      // 1. Save ownership entries
      const ownershipResults = await Promise.all(
        valid.map((r) =>
          fetch(`/api/partnerships/${entityId}/cap-table`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              member_id:      r.member_id,
              ownership_pct:  Number(r.ownership_pct),
              effective_date: bulkDate,
              notes:          bulkNotes || null,
            }),
          })
        )
      )
      const failed = ownershipResults.filter((r) => !r.ok).length
      if (failed > 0) throw new Error(`${failed} ownership entries failed`)

      // 2. Create capital events for rows with capital > 0
      const capitalRows = valid.filter((r) => Number(r.capital_contributed) > 0)
      if (capitalRows.length > 0) {
        const capResults = await Promise.all(
          capitalRows.map((r) =>
            fetch(`/api/partnerships/${entityId}/capital-events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                member_id:      r.member_id,
                event_type:     "contribution",
                amount:         Number(r.capital_contributed),
                effective_date: bulkDate,
                notes:          bulkNotes || null,
              }),
            })
          )
        )
        const capFailed = capResults.filter((r) => !r.ok).length
        if (capFailed > 0) throw new Error(`${capFailed} capital events failed`)
      }

      toast.success(
        `${valid.length} ownership entries recorded` +
        (capitalRows.length > 0 ? ` + ${capitalRows.length} capital contributions` : "")
      )
      setBulkOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bulk entries")
    } finally {
      setBulkSaving(false)
    }
  }

  const historyEntries = historyMemberId
    ? entries
        .filter((e) => e.member_id === historyMemberId)
        .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    : []
  const historyMember = members.find((m) => m.id === historyMemberId)

  // Capital events history per member (for the history dialog future extension)
  const memberCapitalEvents = historyMemberId
    ? capitalEvents
        .filter((e) => e.member_id === historyMemberId)
        .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    : []

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Ownership Recorded</p>
          <p className={cn("text-xl font-bold tabular-nums", ownershipWarning ? "text-amber-600" : "")}>
            {totalOwnership.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Capital Contributed</p>
          <p className="text-xl font-bold tabular-nums">{fmt(totalCapital)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Distributions</p>
          <p className="text-xl font-bold tabular-nums">{fmt(totalDistributions)}</p>
        </div>
      </div>

      {ownershipWarning && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Total ownership ({totalOwnership.toFixed(2)}%) does not equal 100%. Please review entries.
        </div>
      )}

      {isAdmin && hasSyntheticRows && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Some members have ownership % set in their profile but no formal cap table entry.
              Rows marked <em>from member profile</em> are shown as a preview.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Backfill entries"}
          </Button>
        </div>
      )}

      {/* Ownership table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Current Ownership</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openBulkDialog}>
                <SplitSquareHorizontal className="h-4 w-4 mr-1.5" />
                Bulk Record
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCapitalOpen(true)}>
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Record Capital
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Record Change
              </Button>
            </div>
          )}
        </div>

        {displayRows.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No ownership records yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add members with an ownership % or record a change above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Member
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ownership %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Capital Contributed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Distributions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Net Position
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ownership as of
                  </th>
                  {isAdmin && <th className="px-4 py-3 w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayRows.map((row) => {
                  const member = members.find((m) => m.id === row.member_id)
                  const cap   = capitalByMember[row.member_id]?.contributed ?? 0
                  const dist  = capitalByMember[row.member_id]?.distributed ?? 0
                  const net   = dist - cap
                  const isSynthetic = "isSynthetic" in row && row.isSynthetic
                  return (
                    <tr
                      key={row.member_id}
                      className={cn("hover:bg-muted/30", isSynthetic && "opacity-70")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member?.display_name ?? "Unknown"}</span>
                          {isSynthetic && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                              from member profile
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {row.ownership_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {cap > 0 ? fmt(cap) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {dist > 0 ? fmt(dist) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          net > 0 ? "text-emerald-600" : net < 0 ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {cap === 0 && dist === 0 ? "—" : `${net >= 0 ? "+" : ""}${fmt(net)}`}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {row.effective_date ? new Date(row.effective_date).toLocaleDateString() : "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {!isSynthetic && entries.filter((e) => e.member_id === row.member_id).length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="View history"
                              onClick={() => setHistoryMemberId(row.member_id)}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-muted/30 border-t">
                <tr>
                  <td className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Total
                  </td>
                  <td className={cn("px-4 py-3 text-right font-bold tabular-nums", ownershipWarning ? "text-amber-600" : "")}>
                    {totalOwnership.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(totalCapital)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(totalDistributions)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {fmt(totalDistributions - totalCapital)}
                  </td>
                  <td />
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Capital event ledger */}
      {capitalEvents.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Capital Event Ledger</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {capitalEvents.map((ev) => {
                  const member = members.find((m) => m.id === ev.member_id)
                  const isInflow = ev.event_type === "contribution"
                  return (
                    <tr key={ev.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(ev.effective_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{member?.display_name ?? "Unknown"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            isInflow
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : ev.event_type === "distribution" || ev.event_type === "return_of_capital"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : ""
                          )}
                        >
                          {EVENT_TYPE_LABELS[ev.event_type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        <span className={isInflow ? "text-emerald-600" : "text-blue-600"}>
                          {isInflow ? "+" : "−"}{fmt(ev.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                        {ev.notes ?? "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Ownership Change dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Ownership Change</DialogTitle>
            <DialogDescription>
              Records a point-in-time snapshot of a member&apos;s ownership percentage.
              To record a capital contribution, use &ldquo;Record Capital&rdquo; instead.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Member *</Label>
              <Select
                value={form.member_id}
                onValueChange={(v) => {
                  const m = activeMembers.find((m) => m.id === v)
                  setForm({ ...form, member_id: v, ownership_pct: m ? String(m.ownership_pct) : form.ownership_pct })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select member…" /></SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pct">Ownership % *</Label>
                <Input
                  id="pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="25.00"
                  value={form.ownership_pct}
                  onChange={(e) => setForm({ ...form, ownership_pct: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eff_date">Effective Date *</Label>
                <Input
                  id="eff_date"
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap_notes">Notes</Label>
              <Textarea
                id="cap_notes"
                placeholder="e.g. Initial formation, secondary purchase…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving…" : "Record Entry"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Capital Event dialog */}
      <Dialog open={capitalOpen} onOpenChange={setCapitalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Capital Event</DialogTitle>
            <DialogDescription>
              Record a capital contribution, distribution, or other money flow for a member.
              These events form the immutable capital ledger.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCapitalEvent} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Member *</Label>
              <Select
                value={capitalForm.member_id}
                onValueChange={(v) => setCapitalForm({ ...capitalForm, member_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select member…" /></SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select
                value={capitalForm.event_type}
                onValueChange={(v) => setCapitalForm({ ...capitalForm, event_type: v as CapitalEventType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_TYPE_LABELS) as CapitalEventType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      <div className="flex items-center gap-2">
                        {t === "contribution" && <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />}
                        {(t === "distribution" || t === "return_of_capital") && <ArrowUpFromLine className="h-3.5 w-3.5 text-blue-600" />}
                        {EVENT_TYPE_LABELS[t]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cap_amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="cap_amount"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={capitalForm.amount}
                    onChange={(e) => setCapitalForm({ ...capitalForm, amount: e.target.value })}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap_eff_date">Effective Date *</Label>
                <Input
                  id="cap_eff_date"
                  type="date"
                  value={capitalForm.effective_date}
                  onChange={(e) => setCapitalForm({ ...capitalForm, effective_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap_event_notes">Notes</Label>
              <Textarea
                id="cap_event_notes"
                placeholder="e.g. Q1 capital call, annual distribution…"
                value={capitalForm.notes}
                onChange={(e) => setCapitalForm({ ...capitalForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={capitalLoading} className="flex-1">
                {capitalLoading ? "Saving…" : "Record Event"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCapitalOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Record dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Record Ownership Change</DialogTitle>
            <DialogDescription>
              Record a new ownership snapshot for all members at once. Entries must total 100%.
              Capital amounts are recorded as separate contribution events in the capital ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" size="sm" variant="outline" onClick={distributeEqually}>
                <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Equal ownership
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {(() => {
                  const total = bulkRows.reduce((s, r) => s + (Number(r.ownership_pct) || 0), 0)
                  const ok = Math.abs(total - 100) <= 0.01
                  return (
                    <span className={ok ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                      Total: {total.toFixed(2)}%{ok ? " ✓" : " (must be 100%)"}
                    </span>
                  )
                })()}
              </span>
            </div>

            <div className="overflow-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Member</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-32">Ownership %</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-40">
                      Capital Contribution
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">(optional)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bulkRows.map((row, idx) => {
                    const member = members.find((m) => m.id === row.member_id)
                    return (
                      <tr key={row.member_id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{member?.display_name}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            placeholder="0.00"
                            value={row.ownership_pct}
                            onChange={(e) => updateBulkRow(idx, "ownership_pct", e.target.value)}
                            className="h-7 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              placeholder="0"
                              value={row.capital_contributed}
                              onChange={(e) => updateBulkRow(idx, "capital_contributed", e.target.value)}
                              className="h-7 text-xs text-right pl-5"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk_date">Effective Date *</Label>
                <Input
                  id="bulk_date"
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk_notes">Notes</Label>
                <Input
                  id="bulk_notes"
                  placeholder="e.g. Formation, rebalance…"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1 border-t">
              <Button className="flex-1" onClick={saveBulk} disabled={bulkSaving}>
                {bulkSaving ? "Saving…" : `Record ${bulkRows.filter((r) => r.ownership_pct !== "").length} Entries`}
              </Button>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ownership history dialog */}
      <Dialog open={!!historyMemberId} onOpenChange={() => setHistoryMemberId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>History — {historyMember?.display_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {historyEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Ownership Changes
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {historyEntries.map((e, i) => (
                    <div key={e.id}>
                      {i > 0 && <Separator />}
                      <div className="py-2.5 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold tabular-nums">{e.ownership_pct.toFixed(2)}%</p>
                          {e.notes && <p className="text-xs text-muted-foreground mt-0.5">{e.notes}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(e.effective_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {memberCapitalEvents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Capital Events
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {memberCapitalEvents.map((ev, i) => (
                    <div key={ev.id}>
                      {i > 0 && <Separator />}
                      <div className="py-2.5 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{EVENT_TYPE_LABELS[ev.event_type]}</Badge>
                            <p className="text-sm font-semibold tabular-nums">{fmt(ev.amount)}</p>
                          </div>
                          {ev.notes && <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(ev.effective_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
