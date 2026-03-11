'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Laptop, Cloud, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { AppEnvironment } from '@/lib/app-features'

export interface FeatureRow {
  id: string
  name: string
  enabled: boolean
  updated_at: string | null
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
          f.id === featureId ? { ...f, enabled: updated.enabled } : f
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Feature flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable app features per environment. When disabled, the feature is hidden from all end users in that environment.
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
                    const busy = togglingKey === key
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{feature.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {feature.id}
                            {feature.updated_at && (
                              <> · Last updated {new Date(feature.updated_at).toLocaleString()}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {busy ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
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
    </div>
  )
}
