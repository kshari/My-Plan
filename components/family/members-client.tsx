"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, FamilyInvitation } from "@/lib/types/family"
import { AGE_BAND_LABELS, FAMILY_ROLES } from "@/lib/constants/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Mail, UserPlus, Trash2, UserCheck, Clock, Baby } from "lucide-react"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  invitations: FamilyInvitation[]
  userId: string
  userEmail: string
}

export function MembersClient({ family, myMember, members, invitations, userId, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showInvite, setShowInvite] = useState(false)
  const [showPlaceholder, setShowPlaceholder] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [placeholderName, setPlaceholderName] = useState("")
  const [placeholderAgeBand, setPlaceholderAgeBand] = useState<"adult"|"teen"|"child">("child")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const isAdmin = myMember?.role === "admin" || family.created_by === userId

  async function sendInvite() {
    if (!inviteEmail.trim()) { setError("Email is required"); return }
    setSaving(true); setError("")
    try {
      const { data: member } = await supabase.from("fa_members").insert({
        family_id: family.id,
        display_name: inviteEmail.split("@")[0],
        email: inviteEmail.trim(),
        role: "member",
        status: "invited",
        age_band: "adult",
        invited_by: userId,
      }).select().single()

      if (!member) { setError("Failed to create member"); return }

      const { data: inv, error: ie } = await supabase.from("fa_invitations").insert({
        family_id: family.id,
        member_id: member.id,
        invited_by: userId,
        invite_email: inviteEmail.trim(),
      }).select().single()

      if (ie || !inv) { setError(ie?.message ?? "Failed to create invitation"); return }

      const inviteUrl = `${window.location.origin}/apps/family/join?token=${inv.invite_token}`
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedToken(inv.invite_token)
      setInviteEmail("")
      setShowInvite(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function addPlaceholder() {
    if (!placeholderName.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const { error: me } = await supabase.from("fa_members").insert({
        family_id: family.id,
        display_name: placeholderName.trim(),
        role: "member",
        status: "placeholder",
        age_band: placeholderAgeBand,
        invited_by: userId,
      })
      if (me) { setError(me.message); return }
      setPlaceholderName(""); setShowPlaceholder(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member?")) return
    await supabase.from("fa_members").update({ status: "removed" }).eq("id", memberId)
    router.refresh()
  }

  const pendingInvites = invitations.filter((i) => i.status === "pending")

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
            <span>/</span><span>Members</span>
          </div>
          <h1 className="text-2xl font-bold">Family Members</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowPlaceholder(!showPlaceholder); setShowInvite(false) }}>
              <Baby className="w-4 h-4 mr-1" /> Add Kid
            </Button>
            <Button size="sm" onClick={() => { setShowInvite(!showInvite); setShowPlaceholder(false) }}>
              <UserPlus className="w-4 h-4 mr-1" /> Invite
            </Button>
          </div>
        )}
      </div>

      {copiedToken && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Invite link copied to clipboard! Share it with your family member.
        </div>
      )}

      {showInvite && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Email address</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@example.com" type="email" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={sendInvite} disabled={saving}>
                {saving ? "Sending..." : "Send Invite"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showPlaceholder && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Name</Label>
            <Input value={placeholderName} onChange={(e) => setPlaceholderName(e.target.value)} placeholder="e.g. Alex" />
            <Label>Age group</Label>
            <div className="flex gap-2">
              {(["adult","teen","child"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setPlaceholderAgeBand(b)}
                  className={`px-3 py-1.5 rounded text-sm border ${placeholderAgeBand === b ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                >
                  {AGE_BAND_LABELS[b]}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={addPlaceholder} disabled={saving}>Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowPlaceholder(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Members ({members.filter(m=>m.status==="active"||m.status==="placeholder").length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {members.filter((m) => m.status === "active" || m.status === "placeholder").map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center text-sm font-semibold">
                  {m.display_name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.status === "placeholder" ? `Placeholder · ${AGE_BAND_LABELS[m.age_band]}` : m.email ?? m.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{m.role}</span>
                {isAdmin && m.user_id !== userId && (
                  <button onClick={() => removeMember(m.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Invites</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm">{inv.invite_email ?? "—"}</p>
                </div>
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/apps/family/join?token=${inv.invite_token}`
                    await navigator.clipboard.writeText(url)
                    setCopiedToken(inv.invite_token)
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Copy link
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
