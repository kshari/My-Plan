'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Shield, User, Trash2, UserPlus, Link2, Check, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import InviteDialog from './invite-dialog'
import type { TeamMember, TeamInvitation } from '@/lib/types/teams'

interface TeamSettingsProps {
  teamId: string
  teamName: string
  teamDescription: string | null
  members: (TeamMember & { email?: string })[]
  invitations: TeamInvitation[]
  currentUserId: string
  currentUserRole: TeamMember['role']
}

const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  admin: { label: 'Admin', icon: Shield, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  member: { label: 'Member', icon: User, className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export default function TeamSettings({
  teamId, teamName, teamDescription, members, invitations,
  currentUserId, currentUserRole,
}: TeamSettingsProps) {
  const router = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [localInvitations, setLocalInvitations] = useState(invitations)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [name, setName] = useState(teamName)
  const [description, setDescription] = useState(teamDescription ?? '')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    const isSelf = memberUserId === currentUserId
    const label = isSelf ? 'leave this team' : 'remove this member'
    if (!confirm(`Are you sure you want to ${label}?`)) return
    setActionLoading(memberId)
    try {
      await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' })
      if (isSelf) { router.push('/apps/property/teams'); router.refresh() }
      else router.refresh()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setActionLoading(memberId)
    try {
      await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      router.refresh()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRevokeInvitation(invId: string) {
    await fetch(`/api/teams/${teamId}/invitations/${invId}`, { method: 'DELETE' })
    setLocalInvitations(prev => prev.map(i => i.id === invId ? { ...i, status: 'revoked' as const } : i))
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    setSaving(false)
    router.refresh()
  }

  async function handleDeleteTeam() {
    await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    router.push('/apps/property/teams')
    router.refresh()
  }

  const activeInvitations = localInvitations.filter(i => i.status === 'pending' && new Date(i.expires_at) > new Date())

  return (
    <>
      {showInvite && <InviteDialog teamId={teamId} onClose={() => setShowInvite(false)} />}

      <div className="space-y-8 max-w-2xl">
        {/* Team info */}
        {canManage && (
          <section className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Team Settings</h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Team Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            </form>
          </section>
        )}

        {/* Members */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Members ({members.length})</h2>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {members.map(member => {
              const cfg = ROLE_CONFIG[member.role]
              const Icon = cfg.icon
              const isSelf = member.user_id === currentUserId
              return (
                <div key={member.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                      {(member.email ?? member.user_id).slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.email ?? `User …${member.user_id.slice(-6)}`}
                        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && !isSelf ? (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value)}
                        disabled={actionLoading === member.id}
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <Badge className={`text-xs ${cfg.className}`}>
                        <Icon className="h-3 w-3 mr-1" />{cfg.label}
                      </Badge>
                    )}
                    <button
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                      disabled={actionLoading === member.id}
                      title={isSelf ? 'Leave team' : 'Remove member'}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Active invitations */}
        {canManage && activeInvitations.length > 0 && (
          <section className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Pending Invitations ({activeInvitations.length})</h2>
            <div className="space-y-2">
              {activeInvitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm">{inv.invite_email ?? 'Link invitation'}</p>
                    <p className="text-xs text-muted-foreground">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const siteUrl = window.location.origin
                        await navigator.clipboard.writeText(`${siteUrl}/teams/join?token=${inv.invite_token}`)
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Copy link"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Danger zone */}
        {currentUserRole === 'owner' && (
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <h2 className="font-semibold">Danger Zone</h2>
            </div>
            <p className="text-sm text-muted-foreground">Deleting the team will permanently remove all shared properties and data.</p>
            {!showDeleteConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                Delete Team
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-destructive">Are you sure?</p>
                <Button variant="destructive" size="sm" onClick={handleDeleteTeam}>Yes, delete</Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}
