import { requireAdmin } from '@/lib/utils/auth'
import { redirect } from 'next/navigation'
import { APP_ENVIRONMENTS } from '@/lib/app-features'
import { AdminFeaturesList } from '@/components/admin/admin-features-list'

export default async function AdminFeaturesPage() {
  const { supabase, role } = await requireAdmin()

  if (role !== 'super_admin') redirect('/apps/admin/feedback')

  const { data: rows } = await supabase
    .from('app_features')
    .select('id, environment, name, enabled, release_stage, updated_at')
    .order('environment')
    .order('id')

  const featuresByEnvironment: Record<string, Array<{ id: string; name: string; enabled: boolean; release_stage: string; updated_at: string | null }>> = {
    local: [],
    staging: [],
    production: [],
  }
  for (const env of APP_ENVIRONMENTS) {
    featuresByEnvironment[env] = (rows ?? [])
      .filter((r) => r.environment === env)
      .map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        release_stage: r.release_stage ?? 'ga',
        updated_at: r.updated_at,
      }))
  }

  return (
    <AdminFeaturesList
      initialFeaturesByEnvironment={featuresByEnvironment}
      environments={APP_ENVIRONMENTS}
    />
  )
}
