"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner"
import { TRANSACTION_CATEGORIES } from "@/lib/constants/partnerships"
import type { PartnershipTransaction, PartnershipMember, TransactionType } from "@/lib/types/partnerships"
import { cn } from "@/lib/utils"

interface LedgerViewProps {
  entityId: string
  transactions: PartnershipTransaction[]
  members: PartnershipMember[]
  isAdmin: boolean
  investmentId?: string
}

const TYPE_COLORS: Record<TransactionType, string> = {
  income: "text-emerald-600",
  expense: "text-destructive",
  capital_call: "text-amber-600",
  distribution: "text-blue-600",
  transfer: "text-muted-foreground",
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Math.abs(n))
}

export function LedgerView({ entityId, transactions, members, isAdmin, investmentId }: LedgerViewProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: "expense" as TransactionType,
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
    category: "",
  })

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0)
  const netCashFlow = totalIncome - totalExpense

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.transaction_date) return
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, investment_id: investmentId, amount: Number(form.amount) }),
      })
      if (!res.ok) throw new Error("Failed to add transaction")
      toast.success("Transaction recorded")
      setAddOpen(false)
      setForm({ type: "expense", amount: "", transaction_date: new Date().toISOString().split("T")[0], description: "", category: "" })
      router.refresh()
    } catch {
      toast.error("Failed to record transaction")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Income</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{fmt(totalIncome)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-destructive tabular-nums">{fmt(totalExpense)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Net Cash Flow</p>
          <p className={cn("text-xl font-bold tabular-nums", netCashFlow >= 0 ? "text-emerald-600" : "text-destructive")}>
            {netCashFlow < 0 ? "-" : ""}{fmt(netCashFlow)}
          </p>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{transactions.length} transactions</span>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add
            </Button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                <div className={cn("shrink-0", TYPE_COLORS[t.type])}>
                  {t.type === "income" || t.type === "distribution"
                    ? <ArrowDownCircle className="h-4 w-4" />
                    : <ArrowUpCircle className="h-4 w-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t.description || t.category || t.type.replace("_", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.transaction_date).toLocaleDateString()} · {t.type.replace("_", " ")}
                    {t.category ? ` · ${t.category}` : ""}
                  </p>
                </div>
                <p className={cn("text-sm font-semibold tabular-nums shrink-0", TYPE_COLORS[t.type])}>
                  {t.type === "income" || t.type === "distribution" ? "+" : "-"}{fmt(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add transaction dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as TransactionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="capital_call">Capital Call</SelectItem>
                  <SelectItem value="distribution">Distribution</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {(TRANSACTION_CATEGORIES[form.type as keyof typeof TRANSACTION_CATEGORIES] ?? []).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Optional description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Add Transaction"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
