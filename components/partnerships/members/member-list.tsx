"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users, Plus, Mail, UserCheck, UserX, Shield, Eye,
  Upload, Pencil, Check, X, ChevronDown, Link2, Copy,
  Loader2, Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { InviteMemberDialog } from "@/components/partnerships/members/invite-member-dialog"
import { AddMemberDialog } from "@/components/partnerships/members/add-member-dialog"
import { ImportMembersDialog } from "@/components/partnerships/members/import-members-dialog"
import type { PartnershipMember, MemberRole, MemberStatus, MembershipStatus } from "@/lib/types/partnerships"
import { cn } from "@/lib/utils"

interface MemberListProps {
  entityId: string
  entityName: string
  members: PartnershipMember[]
  isAdmin: boolean
  currentUserId: string
}

interface DraftRow {
  display_name: string
  email: string
  role: MemberRole
  ownership_pct: string
  status: MemberStatus
  membership_status: MembershipStatus
}

interface InviteLink {
  name: string
  url: string
  email: string | null
}

const ROLE_ICONS = {
  admin: Shield,
  member: UserCheck,
  observer: Eye,
}

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin",
  member: "Member",
  observer: "Observer",
}

const STATUS_LABELS: Record<string, string> = {
  active:      "Joined",
  invited:     "Invited",
  placeholder: "Placeholder",
  removed:     "Removed",
}

const STATUS_STYLES: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  invited:     "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  placeholder: "bg-muted text-muted-foreground",
  removed:     "bg-destructive/10 text-destructive",
}

const MEMBERSHIP_LABELS: Record<MembershipStatus, string> = {
  pending:   "Pending",
  confirmed: "Confirmed",
  declined:  "Declined",
}

const MEMBERSHIP_STYLES: Record<MembershipStatus, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined:  "bg-destructive/10 text-destructive",
}

export function MemberList({
  entityId,
  entityName,
  members,
  isAdmin,
  currentUserId,
}: MemberListProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [showRemoved, setShowRemoved] = useState(false)

  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Per-row invite state
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [bulkInviting, setBulkInviting] = useState(false)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [inviteLinksOpen, setInviteLinksOpen] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  // Confirmation dialog before sending
  const [pendingInviteMembers, setPendingInviteMembers] = useState<PartnershipMember[]>([])
  const [confirmInviteOpen, setConfirmInviteOpen] = useState(false)

  const visibleMembers = showRemoved
    ? members
    : members.filter((m) => m.status !== "removed")

  const removedCount = members.filter((m) => m.status === "removed").length
  const activeCount  = members.filter((m) => m.status !== "removed").length

  // Members eligible for a new invite (not removed)
  const uninvitedEligible = members.filter(
    (m) => m.status !== "removed"
  )

  function buildJoinUrl(token: string) {
    return `${window.location.origin}/partnerships/join?token=${token}`
  }

  async function sendInvite(m: PartnershipMember, skipEmail = false): Promise<InviteLink | null> {
    const res = await fetch(`/api/partnerships/${entityId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: m.id, skip_email: skipEmail }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to create invitation")
    return {
      name: m.display_name,
      email: skipEmail ? null : (m.email ?? null),
      url: data.joinLink ?? buildJoinUrl(data.invitation.invite_token),
    }
  }

  // Show confirmation dialog before sending
  function handleInviteOne(m: PartnershipMember) {
    setPendingInviteMembers([m])
    setConfirmInviteOpen(true)
  }

  function handleInviteAll() {
    if (uninvitedEligible.length === 0) {
      toast.info("No members to invite")
      return
    }
    setPendingInviteMembers(uninvitedEligible)
    setConfirmInviteOpen(true)
  }

  // Called after user confirms in the dialog
  async function executeInvites(skipEmail = false) {
    setConfirmInviteOpen(false)
    const isBulk = pendingInviteMembers.length > 1

    if (!isBulk) {
      const m = pendingInviteMembers[0]
      setInvitingId(m.id)
      try {
        const link = await sendInvite(m, skipEmail)
        if (link) {
          setInviteLinks([link])
          setInviteLinksOpen(true)
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send invitation")
      } finally {
        setInvitingId(null)
      }
    } else {
      setBulkInviting(true)
      try {
        const results = await Promise.allSettled(pendingInviteMembers.map((m) => sendInvite(m, skipEmail)))
        const links: InviteLink[] = []
        let failed = 0
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) links.push(r.value)
          else failed++
        }
        if (links.length > 0) {
          setInviteLinks(links)
          setInviteLinksOpen(true)
          router.refresh()
        }
        if (failed > 0) toast.error(`${failed} invitation(s) failed`)
      } catch {
        toast.error("Bulk invite failed")
      } finally {
        setBulkInviting(false)
        setPendingInviteMembers([])
      }
    }
  }

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    toast.success("Link copied!")
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  function startEdit(m: PartnershipMember) {
    setEditingId(m.id)
    setDraft({
      display_name: m.display_name,
      email: m.email ?? "",
      role: m.role,
      ownership_pct: String(m.ownership_pct),
      status: m.status,
      membership_status: m.membership_status,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit(memberId: string) {
    if (!draft) return
    if (!draft.display_name.trim()) {
      toast.error("Full name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.display_name.trim(),
          email: draft.email.trim() || null,
          role: draft.role,
          ownership_pct: Number(draft.ownership_pct) || 0,
          status: draft.status,
          membership_status: draft.membership_status,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to save")
      }
      toast.success("Member updated")
      setEditingId(null)
      setDraft(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(memberId: string) {
    try {
      const res = await fetch(`/api/partnerships/${entityId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "removed" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Member removed")
      router.refresh()
    } catch {
      toast.error("Failed to remove member")
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{activeCount} members</span>
            {removedCount > 0 && (
              <button
                onClick={() => setShowRemoved((p) => !p)}
                className="flex items-center gap-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showRemoved && "rotate-180")} />
                {showRemoved ? "Hide" : `+${removedCount} removed`}
              </button>
            )}
            <span className="text-xs text-muted-foreground/70 hidden sm:inline">
              · Name and email visible to all members
            </span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {uninvitedEligible.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInviteAll}
                  disabled={bulkInviting}
                >
                  {bulkInviting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Invite all ({uninvitedEligible.length})
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Member
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowAddDialog(true)}>
                    <UserCheck className="h-4 w-4 mr-2 text-blue-500" />
                    Add directly
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInviteDialog(true)}>
                    <Mail className="h-4 w-4 mr-2 text-emerald-500" />
                    Invite with link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
                    <Upload className="h-4 w-4 mr-2 text-violet-500" />
                    Import from CSV
                  </DropdownMenuItem>
                  {uninvitedEligible.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleInviteAll} disabled={bulkInviting}>
                        <Send className="h-4 w-4 mr-2 text-amber-500" />
                        Invite all uninvited ({uninvitedEligible.length})
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ownership %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Join Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Membership
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-28">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {visibleMembers.map((m) => {
                  const isEditing = editingId === m.id
                  const isSelf = m.user_id === currentUserId
                  const isRemoved = m.status === "removed"
                  const canInvite = !isRemoved
                  const isInviting = invitingId === m.id
                  const RoleIcon = ROLE_ICONS[m.role]

                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "transition-colors",
                        isEditing ? "bg-blue-50/40 dark:bg-blue-950/20" : "hover:bg-muted/30",
                        isRemoved && !isEditing && "opacity-50"
                      )}
                    >
                      {/* Name */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Input
                            value={draft!.display_name}
                            onChange={(e) => setDraft({ ...draft!, display_name: e.target.value })}
                            className="h-8 text-sm w-36"
                            placeholder="Full name"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs font-semibold shrink-0">
                              {m.display_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium flex items-center gap-1.5 flex-wrap">
                                {m.display_name}
                                {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                              </p>
                              {m.email && (
                                <p className="text-xs text-muted-foreground md:hidden">{m.email}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {isEditing ? (
                          <Input
                            type="email"
                            value={draft!.email}
                            onChange={(e) => setDraft({ ...draft!, email: e.target.value })}
                            className="h-8 text-sm w-44"
                            placeholder="email@example.com"
                          />
                        ) : m.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-sm text-muted-foreground">{m.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40 italic">—</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Select
                            value={draft!.role}
                            onValueChange={(v) => setDraft({ ...draft!, role: v as MemberRole })}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="observer">Observer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                          </div>
                        )}
                      </td>

                      {/* Ownership % */}
                      <td className="px-4 py-2.5 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={draft!.ownership_pct}
                            onChange={(e) => setDraft({ ...draft!, ownership_pct: e.target.value })}
                            className="h-8 text-sm text-right w-20 ml-auto"
                          />
                        ) : (
                          <span className="tabular-nums font-medium">
                            {m.ownership_pct.toFixed(2)}%
                          </span>
                        )}
                      </td>

                      {/* Join Status */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Select
                            value={draft!.status}
                            onValueChange={(v) => setDraft({ ...draft!, status: v as MemberStatus })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Joined</SelectItem>
                              <SelectItem value="invited">Invited</SelectItem>
                              <SelectItem value="placeholder">Placeholder</SelectItem>
                              <SelectItem value="removed">Removed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              STATUS_STYLES[m.status]
                            )}
                          >
                            {STATUS_LABELS[m.status] ?? m.status}
                          </span>
                        )}
                      </td>

                      {/* Membership Status */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Select
                            value={draft!.membership_status}
                            onValueChange={(v) => setDraft({ ...draft!, membership_status: v as MembershipStatus })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              MEMBERSHIP_STYLES[m.membership_status]
                            )}
                          >
                            {MEMBERSHIP_LABELS[m.membership_status]}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => saveEdit(m.id)}
                                disabled={saving}
                                title="Save changes"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={cancelEdit}
                                disabled={saving}
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {/* Invite button — only for non-active, non-removed members */}
                              {canInvite && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                      onClick={() => handleInviteOne(m)}
                                      disabled={isInviting}
                                      title="Send invitation link"
                                    >
                                      {isInviting
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Link2 className="h-3.5 w-3.5" />
                                      }
                                    </Button>
                                  </TooltipTrigger>
                  <TooltipContent>
                                      {m.status === "active"
                                        ? "Re-invite (generate a new join link)"
                                        : m.status === "invited"
                                        ? "Re-send invitation link"
                                        : "Generate invitation link"}
                                    </TooltipContent>
                                </Tooltip>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(m)}
                                title="Edit member"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>

                              {!isSelf && !isRemoved && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                                      title="Remove member"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove {m.display_name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will mark them as removed. Their historical contributions, votes, and allocations are preserved. You can restore them by editing their status.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleRemove(m.id)}
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite confirmation dialog */}
        <Dialog open={confirmInviteOpen} onOpenChange={(open) => {
          if (!open) setPendingInviteMembers([])
          setConfirmInviteOpen(open)
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingInviteMembers.length === 1
                  ? `Invite ${pendingInviteMembers[0]?.display_name}?`
                  : `Invite ${pendingInviteMembers.length} members?`}
              </DialogTitle>
              <DialogDescription>
                A unique join link will be generated for each member.
                {pendingInviteMembers.some((m) => m.email) && (
                  <span className="block mt-1">
                    Members with an email address will receive an invitation email unless you choose to generate the link only.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-1 space-y-1.5 max-h-60 overflow-y-auto">
              {pendingInviteMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="text-sm font-medium truncate">{m.display_name}</span>
                  {m.email ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Mail className="h-3 w-3" />
                      {m.email}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic shrink-0">no email on file</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {/* Primary action — send email if any member has one */}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => executeInvites(false)}>
                  <Send className="h-4 w-4 mr-1.5" />
                  {pendingInviteMembers.some((m) => m.email) ? "Send Invites" : "Generate Links"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmInviteOpen(false)
                    setPendingInviteMembers([])
                  }}
                >
                  Cancel
                </Button>
              </div>
              {/* Secondary action — generate link without emailing */}
              {pendingInviteMembers.some((m) => m.email) && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground text-sm"
                  onClick={() => executeInvites(true)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Generate link only — don&apos;t send email
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite links dialog */}
        <Dialog open={inviteLinksOpen} onOpenChange={setInviteLinksOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {inviteLinks.length === 1 ? "Invitation Link" : `${inviteLinks.length} Invitation Links`}
              </DialogTitle>
              <DialogDescription>
                Share each link with the respective member. They can sign up or log in and will be automatically matched by email. Links expire in 7 days.
                {inviteLinks.some((l) => l.email) && (
                  <span className="block mt-1 text-emerald-600 dark:text-emerald-400">
                    ✓ Email sent to members with a recorded email address.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2 max-h-80 overflow-y-auto">
              {inviteLinks.map((link) => (
                <div key={link.url} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{link.name}</p>
                    {link.email ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <Mail className="h-3 w-3" />
                        {link.email}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">no email — share link manually</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={link.url}
                      readOnly
                      className="text-xs h-8 font-mono"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      size="icon"
                      variant={copiedUrl === link.url ? "default" : "outline"}
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyToClipboard(link.url)}
                      title="Copy link"
                    >
                      {copiedUrl === link.url
                        ? <Check className="h-3.5 w-3.5" />
                        : <Copy className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={() => setInviteLinksOpen(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>

        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          entityId={entityId}
          entityName={entityName}
        />
        <AddMemberDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          entityId={entityId}
        />
        <ImportMembersDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          entityId={entityId}
        />
      </div>
    </TooltipProvider>
  )
}
