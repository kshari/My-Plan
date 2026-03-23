"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { DECISION_TYPE_LABELS, VOTING_METHOD_LABELS } from "@/lib/constants/partnerships"
import type { DecisionType, VotingMethod } from "@/lib/types/partnerships"

interface DecisionFormProps {
  entityId: string
  investmentId?: string
}

export function DecisionForm({ entityId, investmentId }: DecisionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    decision_type: "vote" as DecisionType,
    voting_method: "simple_majority" as VotingMethod,
    deadline: "",
  })

  const backHref = investmentId
    ? `/apps/partnerships/${entityId}/investments/${investmentId}/decisions`
    : `/apps/partnerships/${entityId}/decisions`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          investment_id: investmentId || null,
          deadline: form.deadline || null,
        }),
      })
      if (!res.ok) throw new Error()
      const { decision } = await res.json()
      toast.success("Decision created")
      const detailPath = investmentId
        ? `/apps/partnerships/${entityId}/investments/${investmentId}/decisions/${decision.id}`
        : `/apps/partnerships/${entityId}/decisions/${decision.id}`
      router.push(detailPath)
    } catch {
      toast.error("Failed to create decision")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="e.g. Approve acquisition of 123 Main St"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={form.decision_type}
            onValueChange={(v) => setForm({ ...form, decision_type: v as DecisionType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DECISION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.decision_type === "vote" && (
          <div className="space-y-2">
            <Label>Voting Method</Label>
            <Select
              value={form.voting_method}
              onValueChange={(v) => setForm({ ...form, voting_method: v as VotingMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VOTING_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">Deadline (optional)</Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Provide context or background for this decision..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Decision"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
