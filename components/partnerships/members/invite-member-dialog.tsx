"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check, Mail } from "lucide-react"
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

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  entityId: string
  entityName: string
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  entityId,
  entityName,
}: InviteMemberDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    role: "member" as MemberRole,
  })

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) {
      toast.error("Name is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to create invitation")
      const { invitation } = await res.json()
      const link = `${window.location.origin}/partnerships/join?token=${invitation.invite_token}`
      setInviteLink(link)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invitation")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success("Link copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setInviteLink(null)
    setCopied(false)
    setForm({ display_name: "", email: "", role: "member" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite someone to join {entityName}. They will receive an invitation link.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="display_name">Full Name *</Label>
              <Input
                id="display_name"
                placeholder="Jane Smith"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Used to match the account when they register.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as MemberRole })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full management access</SelectItem>
                  <SelectItem value="member">Member — can view and participate</SelectItem>
                  <SelectItem value="observer">Observer — view-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Invitation"}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                Invitation created!
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Share this link with {form.display_name}. It expires in 30 days.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="text-xs font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {form.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                You can also email this link to {form.email}
              </p>
            )}

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
