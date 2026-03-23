"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Users,
  TrendingUp,
  Vote,
  BookOpen,
  FolderOpen,
  Settings,
  Plus,
  ArrowRight,
  Clock,
  Wallet,
  Pencil,
  PiggyBank,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { ENTITY_TYPE_LABELS, WORKFLOW_STAGE_LABELS } from "@/lib/constants/partnerships"
import type {
  CapitalEvent,
  PartnershipDecision,
  PartnershipEntity,
  PartnershipInvestment,
  PartnershipMember,
} from "@/lib/types/partnerships"
import { cn } from "@/lib/utils"

interface EntityDashboardProps {
  entity: PartnershipEntity
  members: PartnershipMember[]
  investments: PartnershipInvestment[]
  openDecisions: PartnershipDecision[]
  capitalEvents: Pick<CapitalEvent, "member_id" | "event_type" | "amount">[]
  isAdmin: boolean
  userId: string
}

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)
}

const STAGE_ORDER = [
  "ideation", "due_diligence", "decision", "capital_collection", "execution", "management", "exit"
]

export function EntityDashboard({
  entity,
  members,
  investments,
  openDecisions,
  capitalEvents,
  isAdmin,
  userId,
}: EntityDashboardProps) {
  const router = useRouter()
  const base = `/apps/partnerships/${entity.id}`

  const activeInvestments = investments.filter((i) => i.status === "active")

  // Investment totals for the dashboard card
  const totalInvested = investments.reduce((s, i) => s + (i.target_amount ?? 0), 0)
  const totalCurrentValue = investments.reduce((s, i) => {
    if (i.num_shares != null && i.num_shares > 0 && i.market_price_per_share != null) {
      return s + i.num_shares * i.market_price_per_share
    }
    return s + (i.target_amount ?? 0)
  }, 0)
  const hasAnyMarketPrice = investments.some(
    (i) => i.num_shares != null && i.num_shares > 0 && i.market_price_per_share != null
  )
  const totalInvPL = totalCurrentValue - totalInvested
  const totalInvReturn = totalInvested > 0 ? (totalInvPL / totalInvested) * 100 : null
  const activeMembers = members.filter((m) => m.status === "active")

  // Derive capital contributed per member from the events ledger
  const capitalByMember = capitalEvents.reduce<Record<string, number>>((acc, ev) => {
    if (ev.event_type === "contribution") {
      acc[ev.member_id] = (acc[ev.member_id] ?? 0) + Number(ev.amount)
    }
    return acc
  }, {})

  // Total from ALL events — not just active members (placeholder members can have contributions)
  const totalCapitalContributed = capitalEvents
    .filter((ev) => ev.event_type === "contribution")
    .reduce((sum, ev) => sum + Number(ev.amount), 0)

  // capitalRows is only used for per-member display in the Capital card
  const capitalRows = activeMembers
    .filter((m) => m.ownership_pct > 0 || (capitalByMember[m.id] ?? 0) > 0)
    .map((m) => ({
      member: m,
      ownership_pct: m.ownership_pct,
      capital_contributed: capitalByMember[m.id] ?? 0,
    }))
    .sort((a, b) => b.capital_contributed - a.capital_contributed || b.ownership_pct - a.ownership_pct)

  // Balance sheet
  const cashBalance = entity.cash_balance ?? 0
  const bsExpenses = totalCapitalContributed - (totalInvested + cashBalance)
  const bsPortfolioValue = totalCurrentValue + cashBalance
  const bsTotalReturns = bsPortfolioValue - totalCapitalContributed
  const bsReturnPct = totalCapitalContributed > 0 ? (bsTotalReturns / totalCapitalContributed) * 100 : null

  const investmentsByStage = STAGE_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = investments.filter((i) => i.current_stage === s).length
    return acc
  }, {})

  const myMember = members.find((m) => m.user_id === userId)

  const [cashOpen, setCashOpen] = useState(false)
  const [cashValue, setCashValue] = useState(entity.cash_balance?.toString() ?? "0")
  const [asOfValue, setAsOfValue] = useState(entity.cash_balance_as_of ?? "")
  const [savingCash, setSavingCash] = useState(false)

  async function saveCash() {
    setSavingCash(true)
    try {
      const res = await fetch(`/api/partnerships/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash_balance: cashValue,
          cash_balance_as_of: asOfValue || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Cash balance updated")
      setCashOpen(false)
      router.refresh()
    } catch {
      toast.error("Failed to update cash balance")
    } finally {
      setSavingCash(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{entity.name}</h1>
              <p className="text-sm text-muted-foreground">
                {ENTITY_TYPE_LABELS[entity.entity_type]}
                {entity.state_of_formation ? ` · ${entity.state_of_formation}` : ""}
                {entity.fiscal_year_end ? ` · FY ends ${entity.fiscal_year_end}` : ""}
              </p>
            </div>
          </div>
          {entity.description && (
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{entity.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/settings`}>
                <Settings className="h-4 w-4 mr-1.5" />
                Settings
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`${base}/investments/new`}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Investment
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards — Members · Cash · Capital */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`${base}/members`}
          className="rounded-xl border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Members</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{activeMembers.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Active members</p>
          {myMember && (
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Your share: {myMember.ownership_pct.toFixed(1)}%
            </p>
          )}
        </Link>

        <div
          className="rounded-xl border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          onClick={() => {
            if (isAdmin) {
              setCashValue(entity.cash_balance?.toString() ?? "0")
              setAsOfValue(entity.cash_balance_as_of ?? "")
              setCashOpen(true)
            }
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cash</span>
            </div>
            {isAdmin && (
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <div className={cn("text-2xl font-bold tabular-nums", (entity.cash_balance ?? 0) < 0 ? "text-destructive" : "")}>
            {fmt(entity.cash_balance ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {entity.cash_balance_as_of
              ? `As of ${new Date(entity.cash_balance_as_of + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Available cash balance"}
          </p>
        </div>

        <Link
          href={`${base}/cap-table`}
          className="rounded-xl border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
        >
          <div className="flex items-center gap-2 mb-3">
            <PiggyBank className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capital</span>
          </div>
          <>
            <div className="text-2xl font-bold tabular-nums">{fmt(totalCapitalContributed)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalCapitalContributed > 0 ? "Total contributed" : "No capital recorded yet"}
            </p>
            {myMember && (() => {
              const myRow = capitalRows.find((r) => r.member.id === myMember.id)
              return myRow ? (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground">Your contribution</span>
                    <span className="text-xs font-medium tabular-nums shrink-0">
                      {myRow.capital_contributed > 0 ? fmt(myRow.capital_contributed) : "—"}
                      <span className="text-muted-foreground ml-1">({myRow.ownership_pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                </div>
              ) : null
            })()}
          </>
        </Link>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Investments */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h2 className="text-base font-semibold">Investments</h2>
            </div>
            <Link
              href={`${base}/investments`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {investments.length === 0 ? (
            <div className="py-8 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No investments yet</p>
              {isAdmin && (
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link href={`${base}/investments/new`}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Investment
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stage breakdown table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-1.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stage</th>
                    <th className="pb-1.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {STAGE_ORDER.filter((s) => investmentsByStage[s] > 0).map((stage) => (
                    <tr key={stage}>
                      <td className="py-1.5 text-sm text-muted-foreground">
                        {WORKFLOW_STAGE_LABELS[stage as keyof typeof WORKFLOW_STAGE_LABELS]}
                      </td>
                      <td className="py-1.5 text-right text-sm font-semibold tabular-nums">
                        {investmentsByStage[stage]}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="pt-1.5 text-xs font-medium text-muted-foreground">Total</td>
                    <td className="pt-1.5 text-right text-sm font-bold tabular-nums">{investments.length}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Financial summary */}
              {totalInvested > 0 && (
                <div className="space-y-1.5 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Invested</span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(totalInvested)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Current Value{!hasAnyMarketPrice ? <span className="text-xs ml-1 opacity-60">(at cost)</span> : ""}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(totalCurrentValue)}</span>
                  </div>
                  {hasAnyMarketPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">P / L</span>
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        totalInvPL >= 0 ? "text-emerald-600" : "text-destructive"
                      )}>
                        {totalInvPL >= 0 ? "+" : ""}{fmt(totalInvPL)}
                        {totalInvReturn != null && (
                          <span className="ml-1.5 text-xs opacity-75">
                            ({totalInvReturn >= 0 ? "+" : ""}{totalInvReturn.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Balance Sheet */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Balance Sheet</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1 border-b">
              <span className="text-sm text-muted-foreground">Capital Contributed</span>
              <span className="text-sm font-bold tabular-nums">{fmt(totalCapitalContributed)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground pl-3">Capital Invested</span>
              <span className="text-sm tabular-nums">{fmt(totalInvested)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground pl-3">Cash Balance</span>
              <span className="text-sm tabular-nums">{fmt(cashBalance)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b">
              <span className="text-sm text-muted-foreground pl-3">Expenses to Date</span>
              <span className={cn(
                "text-sm tabular-nums",
                bsExpenses > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {bsExpenses > 0 ? `(${fmt(bsExpenses)})` : fmt(bsExpenses)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b">
              <span className="text-sm text-muted-foreground">
                Portfolio Value{!hasAnyMarketPrice && <span className="text-xs ml-1 opacity-60">(at cost)</span>}
              </span>
              <span className="text-sm font-bold tabular-nums">{fmt(bsPortfolioValue)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Total Returns</span>
              <div className="text-right">
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  bsTotalReturns >= 0 ? "text-emerald-600" : "text-destructive"
                )}>
                  {bsTotalReturns >= 0 ? "+" : ""}{fmt(bsTotalReturns)}
                </span>
                {bsReturnPct != null && (
                  <span className={cn(
                    "text-xs ml-1.5 tabular-nums",
                    bsReturnPct >= 0 ? "text-emerald-600" : "text-destructive"
                  )}>
                    ({bsReturnPct >= 0 ? "+" : ""}{bsReturnPct.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold mb-4">Quick Access</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { href: `${base}/cap-table`, icon: Users, label: "Cap Table", color: "text-blue-500" },
              { href: `${base}/decisions`, icon: Vote, label: "Decisions", color: "text-violet-500" },
              { href: `${base}/documents`, icon: FolderOpen, label: "Documents", color: "text-orange-500" },
              { href: `${base}/ledger`, icon: BookOpen, label: "Ledger", color: "text-emerald-500" },
              { href: `${base}/members`, icon: Users, label: "Members", color: "text-blue-400" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center hover:bg-muted/50 hover:border-border/80 transition-all"
              >
                <item.icon className={cn("h-6 w-6", item.color)} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Cash balance dialog */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Cash Balance</DialogTitle>
            <DialogDescription>
              Enter the current uninvested cash balance and the date it was recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="cash_balance_dash">Cash Balance ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  id="cash_balance_dash"
                  type="number"
                  step="any"
                  min={0}
                  className="pl-7"
                  placeholder="0.00"
                  value={cashValue}
                  onChange={(e) => setCashValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !savingCash && saveCash()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cash_balance_as_of_dash">As of Date</Label>
              <Input
                id="cash_balance_as_of_dash"
                type="date"
                value={asOfValue}
                onChange={(e) => setAsOfValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The date this balance was recorded or last confirmed.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={saveCash} disabled={savingCash || cashValue === ""} className="flex-1">
                {savingCash ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setCashOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
