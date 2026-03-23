"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { MemberRole } from "@/lib/types/partnerships"

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  entityId: string
}

export function AddMemberDialog({ open, onOpenChange, entityId }: AddMemberDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    role: "member" as MemberRole,
    ownership_pct: "",
  })

  function handleClose() {
    setForm({ display_name: "", email: "", role: "member", ownership_pct: "" })
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) {
      toast.error("Full name is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          email: form.email.trim() || null,
          role: form.role,
          ownership_pct: form.ownership_pct ? Number(form.ownership_pct) : 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to add member")
      }
      toast.success(`${form.display_name} added as a placeholder member`)
      handleClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Add a member directly without sending an invitation. They will appear as a placeholder
            until they join the platform and accept an invitation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="add_name">Full Name *</Label>
            <Input
              id="add_name"
              placeholder="Jane Smith"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add_email">Email</Label>
            <Input
              id="add_email"
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Used to automatically link their account when they register.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as MemberRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_pct">Ownership %</Label>
              <Input
                id="add_pct"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="0.00"
                value={form.ownership_pct}
                onChange={(e) => setForm({ ...form, ownership_pct: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Placeholder members can be assigned ownership, capital calls, and distributions immediately.
            They become active members once they join with a My Plan account.
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Adding..." : "Add Member"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
