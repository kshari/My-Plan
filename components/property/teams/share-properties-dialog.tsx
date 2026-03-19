'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Share2, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PropertySummary {
  id: number
  address: string | null
  city?: string | null
  type?: string | null
  listing_status?: string | null
  'Asking Price'?: number | null
}

interface SharePropertiesDialogProps {
  teamId: string
  properties: PropertySummary[]
  trigger: React.ReactNode
  onShared?: () => void
}

type TabId = 'all' | 'by-attribute' | 'individual'

type GroupKey = 'type' | 'city' | 'listing_status'
const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: 'type', label: 'Property Type' },
  { key: 'city', label: 'City' },
  { key: 'listing_status', label: 'Listing Status' },
]

export default function SharePropertiesDialog({ teamId, properties, trigger, onShared }: SharePropertiesDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [groupBy, setGroupBy] = useState<GroupKey>('type')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setSelectedIds(new Set())
    setTab('all')
    setDone(false)
    setError(null)
    setOpen(true)
  }

  function toggleId(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleGroup(groupIds: number[]) {
    const allSelected = groupIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) groupIds.forEach(id => next.delete(id))
      else groupIds.forEach(id => next.add(id))
      return next
    })
  }

  function toggleCollapse(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })
  }

  const grouped = useMemo(() => {
    const map: Record<string, PropertySummary[]> = {}
    for (const p of properties) {
      const key = (p[groupBy] as string | null | undefined) ?? 'Unspecified'
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [properties, groupBy])

  // Determine which IDs to share based on tab
  function getIdsToShare(): number[] {
    if (tab === 'all') return properties.map(p => p.id)
    return [...selectedIds]
  }

  async function handleShare() {
    const ids = getIdsToShare()
    if (!ids.length) { setError('No properties selected'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyIds: ids }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Share failed'); return }
      setDone(true)
      onShared?.()
      router.refresh()
      setTimeout(() => { setOpen(false); setDone(false) }, 1500)
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const shareCount = tab === 'all' ? properties.length : selectedIds.size

  return (
    <>
      <span onClick={openDialog}>{trigger}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-emerald-600" />
                Share Properties to Team
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0">
              {([['all', 'All Properties'], ['by-attribute', 'By Attribute'], ['individual', 'Individual']] as [TabId, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-medium transition-colors border-b-2',
                    tab === id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {done ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-emerald-600">
                  <Check className="h-8 w-8" />
                  <p className="font-medium">Properties shared successfully!</p>
                </div>
              ) : (
                <>
                  {error && <p className="text-sm text-destructive">{error}</p>}

                  {tab === 'all' && (
                    <div className="rounded-lg bg-muted/50 border px-4 py-3">
                      <p className="text-sm font-medium">Share all {properties.length} properties</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All your properties and their scenarios will be copied to the team shared area.
                      </p>
                    </div>
                  )}

                  {tab === 'by-attribute' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Group by:</label>
                        <select
                          value={groupBy}
                          onChange={e => setGroupBy(e.target.value as GroupKey)}
                          className="rounded-md border bg-background px-2 py-1 text-xs"
                        >
                          {GROUP_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {grouped.map(([group, props]) => {
                        const groupIds = props.map(p => p.id)
                        const allSelected = groupIds.every(id => selectedIds.has(id))
                        const someSelected = groupIds.some(id => selectedIds.has(id))
                        const collapsed = collapsedGroups.has(group)

                        return (
                          <div key={group} className="rounded-lg border overflow-hidden">
                            <div className="flex items-center gap-3 px-3 py-2 bg-muted/30">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                                onChange={() => toggleGroup(groupIds)}
                                className="rounded"
                              />
                              <button
                                className="flex-1 flex items-center justify-between text-sm font-medium text-left"
                                onClick={() => toggleCollapse(group)}
                              >
                                <span>{group}</span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <span className="text-xs">{props.length} propert{props.length !== 1 ? 'ies' : 'y'}</span>
                                  {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                                </div>
                              </button>
                            </div>
                            {!collapsed && (
                              <div className="divide-y">
                                {props.map(p => (
                                  <label key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(p.id)}
                                      onChange={() => toggleId(p.id)}
                                      className="rounded"
                                    />
                                    <span className="text-sm truncate">{p.address ?? 'Unnamed'}</span>
                                    {p['Asking Price'] && (
                                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                        ${p['Asking Price'].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                      </span>
                                    )}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {tab === 'individual' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            if (selectedIds.size === properties.length) setSelectedIds(new Set())
                            else setSelectedIds(new Set(properties.map(p => p.id)))
                          }}
                        >
                          {selectedIds.size === properties.length ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      {properties.map(p => (
                        <label key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleId(p.id)}
                            className="rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{p.address ?? 'Unnamed Property'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[p.city, p.type, p.listing_status].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          {p['Asking Price'] && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              ${p['Asking Price'].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!done && (
              <div className="flex items-center justify-between px-5 py-4 border-t shrink-0">
                <p className="text-sm text-muted-foreground">
                  {shareCount > 0
                    ? `${shareCount} propert${shareCount !== 1 ? 'ies' : 'y'} will be shared`
                    : tab === 'all' ? `${properties.length} properties will be shared` : 'Select properties to share'}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleShare}
                    disabled={loading || (tab !== 'all' && selectedIds.size === 0)}
                  >
                    {loading ? 'Sharing…' : 'Share'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
