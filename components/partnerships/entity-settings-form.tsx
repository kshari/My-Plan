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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { ENTITY_TYPES } from "@/lib/constants/partnerships"
import type { PartnershipEntity, EntityType } from "@/lib/types/partnerships"

interface EntitySettingsFormProps {
  entity: PartnershipEntity
}

export function EntitySettingsForm({ entity }: EntitySettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: entity.name,
    entity_type: entity.entity_type,
    description: entity.description ?? "",
    state_of_formation: entity.state_of_formation ?? "",
    ein: entity.ein ?? "",
    formation_date: entity.formation_date ?? "",
    fiscal_year_end: entity.fiscal_year_end ?? "12/31",
    status: entity.status,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to update entity")
      toast.success("Settings saved")
      router.refresh()
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  async function handleDissolve() {
    try {
      const res = await fetch(`/api/partnerships/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dissolved" }),
      })
      if (!res.ok) throw new Error("Failed to dissolve entity")
      toast.success("Entity marked as dissolved")
      router.refresh()
    } catch {
      toast.error("Failed to dissolve entity")
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Entity Name *</Label>
          <Input
            id="name"
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
              value={form.state_of_formation}
              onChange={(e) => setForm({ ...form, state_of_formation: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiscal_year_end">Fiscal Year End</Label>
            <Input
              id="fiscal_year_end"
              value={form.fiscal_year_end}
              onChange={(e) => setForm({ ...form, fiscal_year_end: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ein">EIN (optional)</Label>
            <Input
              id="ein"
              placeholder="XX-XXXXXXX"
              value={form.ein}
              onChange={(e) => setForm({ ...form, ein: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="formation_date">Formation Date</Label>
            <Input
              id="formation_date"
              type="date"
              value={form.formation_date}
              onChange={(e) => setForm({ ...form, formation_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h3 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Mark this entity as dissolved. This cannot be undone without admin intervention.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Dissolve Entity
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Dissolve this entity?</AlertDialogTitle>
              <AlertDialogDescription>
                This marks {entity.name} as dissolved. All data is preserved but the entity will be
                inactive. This should only be done when the legal entity has been wound down.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDissolve}
              >
                Dissolve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
