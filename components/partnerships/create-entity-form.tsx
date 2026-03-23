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
import { ENTITY_TYPES } from "@/lib/constants/partnerships"
import type { EntityType } from "@/lib/types/partnerships"

export function CreateEntityForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    entity_type: "llc" as EntityType,
    description: "",
    state_of_formation: "",
    fiscal_year_end: "12/31",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Entity name is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/partnerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to create entity")
      }
      const { entity } = await res.json()
      toast.success("Entity created")
      router.push(`/apps/partnerships/${entity.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entity")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Entity Name *</Label>
        <Input
          id="name"
          placeholder="e.g. Oak Street Partners LLC"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="entity_type">Entity Type *</Label>
        <Select
          value={form.entity_type}
          onValueChange={(v) => setForm({ ...form, entity_type: v as EntityType })}
        >
          <SelectTrigger id="entity_type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">State of Formation</Label>
          <Input
            id="state"
            placeholder="e.g. Delaware"
            value={form.state_of_formation}
            onChange={(e) => setForm({ ...form, state_of_formation: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fiscal_year_end">Fiscal Year End</Label>
          <Input
            id="fiscal_year_end"
            placeholder="12/31"
            value={form.fiscal_year_end}
            onChange={(e) => setForm({ ...form, fiscal_year_end: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of this entity's purpose..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Entity"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
