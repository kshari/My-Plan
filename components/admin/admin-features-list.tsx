'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Laptop, Cloud, Server, Users, Plus, Trash2, FlaskConical, Globe,
  Link2, Copy, Check, BanIcon, CalendarDays, Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { AppEnvironment } from '@/lib/app-features'

export interface FeatureRow {
  id: string
  name: string
  enabled: boolean
  release_stage: string
  updated_at: string | null
}

interface BetaUser {
  id: string
  feature_id: string
  environment: string
  user_id: string
  user_email: string | null
  status: string
  invited_at: string
  accepted_at: string | null
}

interface InviteLink {
  id: string
  token: string
  label: string | null
  created_at: string
  expires_at: string | null
  max_uses: number | null
  use_count: number
  active: boolean
}

const ENV_ICONS: Record<AppEnvironment, typeof Laptop> = {
  local: Laptop,
  staging: Server,
  production: Cloud,
}

const ENV_LABELS: Record<AppEnvironment, string> = {
  local: 'Local',
  staging: 'Staging',
  production: 'Production',
}

interface AdminFeaturesListProps {
  initialFeaturesByEnvironment: Record<string, FeatureRow[]>
  environments: AppEnvironment[]
}

export function AdminFeaturesList({
  initialFeaturesByEnvironment,
  environments,
}: AdminFeaturesListProps) {
  const router = useRouter()
  const [featuresByEnv, setFeaturesByEnv] = useState(initialFeaturesByEnvironment)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  // Beta users panel state
  const [betaPanelOpen, setBetaPanelOpen] = useState(false)
  const [betaPanelFeature, setBetaPanelFeature] = useState<{ id: string; name: string; environment: string } | null>(null)
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([])
  const [betaLoading, setBetaLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  // Invite links panel state
  const [linksPanelOpen, setLinksPanelOpen] = useState(false)
  const [linksPanelFeature, setLinksPanelFeature] = useState<{ id: string; name: string; environment: string } | null>(null)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [linksLoading, setLinksLoading] = useState(false)
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkMaxUses, setNewLinkMaxUses] = useState('')
  const [newLinkExpiresAt, setNewLinkExpiresAt] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  async function handleToggle(featureId: string, environment: string, enabled: boolean) {
    const key = `${featureId}:${environment}`
    setTogglingKey(key)
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId, environment, enabled }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? res.statusText)
      }
      const updated = await res.json()
      setFeaturesByEnv((prev) => ({
        ...prev,
        [environment]: (prev[environment] ?? []).map((f) =>
          f.id === featureId ? { ...f, enabled: updated.enabled, release_stage: updated.release_stage ?? f.release_stage } : f
        ),
      }))
      toast.success(
        `${updated.name} (${ENV_LABELS[updated.environment as AppEnvironment] ?? updated.environment}) is now ${updated.enabled ? 'enabled' : 'disabled'}.`
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update feature')
    } finally {
      setTogglingKey(null)
    }
  }

  async function handleStageChange(featureId: string, environment: string, release_stage: 'beta' | 'ga') {
    const key = `stage:${featureId}:${environment}`
    setTogglingKey(key)
    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId, environment, release_stage }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? res.statusText)
      }
      const updated = await res.json()
      setFeaturesByEnv((prev) => ({
        ...prev,
        [environment]: (prev[environment] ?? []).map((f) =>
          f.id === featureId
            ? { ...f, release_stage: updated.release_stage }
            : f
        ),
      }))
      const label = release_stage === 'ga' ? 'Generally Available' : 'Beta'
      toast.success(`${updated.name} is now ${label}.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update release stage')
    } finally {
      setTogglingKey(null)
    }
  }

  async function openBetaPanel(feature: FeatureRow, environment: string) {
    setBetaPanelFeature({ id: feature.id, name: feature.name, environment })
    setBetaPanelOpen(true)
    setBetaLoading(true)
    try {
      const res = await fetch(
        `/api/admin/beta-access?featureId=${feature.id}&environment=${environment}`
      )
      const data = await res.json()
      setBetaUsers(data.users ?? [])
    } catch {
      toast.error('Failed to load beta users')
    } finally {
      setBetaLoading(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !betaPanelFeature) return
    setInviting(true)
    try {
      const res = await fetch('/api/admin/beta-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId: betaPanelFeature.id,
          environment: betaPanelFeature.environment,
          email: inviteEmail.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBetaUsers((prev) => [data, ...prev.filter((u) => u.user_id !== data.user_id)])
      setInviteEmail('')
      const emailNote = data.emailSent ? ' — email sent' : ' — email not sent (check Resend config)'
      toast.success(`Invited ${data.user_email ?? inviteEmail.trim()} to beta${emailNote}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(accessId: string) {
    try {
      const res = await fetch('/api/admin/beta-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accessId }),
      })
      if (!res.ok) throw new Error('Failed to revoke')
      setBetaUsers((prev) => prev.filter((u) => u.id !== accessId))
      toast.success('Beta access revoked')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke access')
    }
  }

  async function openLinksPanel(feature: FeatureRow, environment: string) {
    setLinksPanelFeature({ id: feature.id, name: feature.name, environment })
    setLinksPanelOpen(true)
    setLinksLoading(true)
    setNewLinkLabel('')
    setNewLinkMaxUses('')
    setNewLinkExpiresAt('')
    try {
      const res = await fetch(`/api/admin/beta-invite-links?featureId=${feature.id}&environment=${environment}`)
      const data = await res.json()
      setInviteLinks(data.links ?? [])
    } catch {
      toast.error('Failed to load invite links')
    } finally {
      setLinksLoading(false)
    }
  }

  async function handleCreateLink() {
    if (!linksPanelFeature) return
    setCreatingLink(true)
    try {
      const res = await fetch('/api/admin/beta-invite-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId: linksPanelFeature.id,
          environment: linksPanelFeature.environment,
          label: newLinkLabel.trim() || undefined,
          maxUses: newLinkMaxUses ? parseInt(newLinkMaxUses, 10) : undefined,
          expiresAt: newLinkExpiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteLinks((prev) => [data, ...prev])
      setNewLinkLabel('')
      setNewLinkMaxUses('')
      setNewLinkExpiresAt('')
      toast.success('Invite link created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link')
    } finally {
      setCreatingLink(false)
    }
  }

  async function handleDeactivateLink(linkId: string) {
    try {
      const res = await fetch(`/api/admin/beta-invite-links/${linkId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to deactivate')
      setInviteLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, active: false } : l))
      toast.success('Invite link deactivated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to deactivate link')
    }
  }

  function copyLinkUrl(token: string, linkId: string) {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${siteUrl}/beta/join/${token}`)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  function linkStatus(link: InviteLink): { label: string; color: string } {
    if (!link.active) return { label: 'Deactivated', color: 'text-muted-foreground' }
    if (link.expires_at && new Date(link.expires_at) < new Date()) return { label: 'Expired', color: 'text-destructive' }
    if (link.max_uses !== null && link.use_count >= link.max_uses) return { label: 'Maxed out', color: 'text-amber-600' }
    return { label: 'Active', color: 'text-emerald-600' }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Feature flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable app features per environment. Beta features are only available to invited users.
        </p>
      </div>

      {environments.map((env) => {
        const features = featuresByEnv[env] ?? []
        const Icon = ENV_ICONS[env]
        const label = ENV_LABELS[env]
        return (
          <div key={env} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon className="h-4 w-4" />
              {label}
            </h2>
            <div className="rounded-lg border bg-card">
              <div className="divide-y">
                {features.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No features defined for this environment.
                  </div>
                ) : (
                  features.map((feature) => {
                    const key = `${feature.id}:${env}`
                    const stageKey = `stage:${feature.id}:${env}`
                    const busy = togglingKey === key || togglingKey === stageKey
                    const isBeta = feature.release_stage === 'beta'

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{feature.name}</p>
                            <Badge
                              variant={isBeta ? 'secondary' : 'outline'}
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                isBeta && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              )}
                            >
                              {isBeta ? (
                                <><FlaskConical className="h-3 w-3 mr-0.5" />Beta</>
                              ) : (
                                <><Globe className="h-3 w-3 mr-0.5" />GA</>
                              )}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ID: {feature.id}
                            {feature.updated_at && (
                              <> &middot; Last updated {new Date(feature.updated_at).toLocaleString()}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {busy ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              {/* Stage toggle */}
                              {feature.enabled && (
                                <>
                                  {isBeta ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7"
                                      onClick={() => handleStageChange(feature.id, env, 'ga')}
                                    >
                                      <Globe className="h-3 w-3 mr-1" />
                                      Make GA
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7"
                                      onClick={() => handleStageChange(feature.id, env, 'beta')}
                                    >
                                      <FlaskConical className="h-3 w-3 mr-1" />
                                      Make Beta
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* Beta users button */}
                              {isBeta && feature.enabled && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => openBetaPanel(feature, env)}
                                >
                                  <Users className="h-3.5 w-3.5 mr-1" />
                                  Users
                                </Button>
                              )}

                              {/* Invite links button */}
                              {isBeta && feature.enabled && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => openLinksPanel(feature, env)}
                                >
                                  <Link2 className="h-3.5 w-3.5 mr-1" />
                                  Links
                                </Button>
                              )}

                              {/* Enabled toggle */}
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  feature.enabled
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {feature.enabled ? 'On' : 'Off'}
                              </span>
                              <Checkbox
                                checked={feature.enabled}
                                onCheckedChange={(checked) =>
                                  handleToggle(feature.id, env, checked === true)
                                }
                                aria-label={`Toggle ${feature.name} for ${label}`}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Beta Users Dialog */}
      <Dialog open={betaPanelOpen} onOpenChange={setBetaPanelOpen}>        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Beta users &mdash; {betaPanelFeature?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Invite form */}
          <div className="flex gap-2">
            <Input
              placeholder="User email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              className="flex-1"
            />
            <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Plus className="h-4 w-4 mr-1" /> Invite</>
              )}
            </Button>
          </div>

          {/* Users list */}
          {betaLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : betaUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No beta users yet. Invite someone above.
            </p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {betaUsers.map((bu) => (
                <div
                  key={bu.id}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {bu.user_email ?? bu.user_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(bu.invited_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={bu.status === 'accepted' ? 'default' : 'secondary'}
                      className={cn(
                        'text-[10px]',
                        bu.status === 'accepted' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
                        bu.status === 'invited' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      )}
                    >
                      {bu.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRevoke(bu.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Links Dialog */}
      <Dialog open={linksPanelOpen} onOpenChange={setLinksPanelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-amber-500" />
              Invite links &mdash; {linksPanelFeature?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Share these links to let any user enable this beta feature — no email needed.
          </p>

          {/* Create new link */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-foreground/70">New link</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Label (optional) e.g. Twitter campaign"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Hash className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Max uses (optional)"
                    value={newLinkMaxUses}
                    onChange={(e) => setNewLinkMaxUses(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
                <div className="flex-1 relative">
                  <CalendarDays className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={newLinkExpiresAt}
                    onChange={(e) => setNewLinkExpiresAt(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleCreateLink} disabled={creatingLink} className="h-7 text-xs w-full">
              {creatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Generate link
            </Button>
          </div>

          {/* Links list */}
          {linksLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteLinks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No invite links yet. Generate one above.
            </p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {inviteLinks.map((link) => {
                const status = linkStatus(link)
                const isUsable = link.active && !(link.expires_at && new Date(link.expires_at) < new Date()) && !(link.max_uses !== null && link.use_count >= link.max_uses)
                return (
                  <div key={link.id} className={cn('rounded-lg border p-3 space-y-1.5', !isUsable && 'opacity-50')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {link.label && (
                            <span className="text-xs font-medium">{link.label}</span>
                          )}
                          <span className={cn('text-[11px] font-medium', status.color)}>{status.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>{link.use_count} use{link.use_count !== 1 ? 's' : ''}{link.max_uses !== null ? ` / ${link.max_uses}` : ''}</span>
                          {link.expires_at && <span>Expires {new Date(link.expires_at).toLocaleDateString()}</span>}
                          <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyLinkUrl(link.token, link.id)}
                          title="Copy link"
                          disabled={!isUsable}
                        >
                          {copiedLinkId === link.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        {link.active && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeactivateLink(link.id)}
                            title="Deactivate link"
                            className="text-destructive hover:text-destructive"
                          >
                            <BanIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isUsable && (
                      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5">
                        <code className="flex-1 text-[10px] text-muted-foreground truncate">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/beta/join/{link.token}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-5 w-5 shrink-0"
                          onClick={() => copyLinkUrl(link.token, link.id)}
                        >
                          {copiedLinkId === link.id
                            ? <Check className="h-3 w-3 text-emerald-500" />
                            : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
