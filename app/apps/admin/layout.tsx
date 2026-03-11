import { requireAdmin } from '@/lib/utils/auth'
import { getFeatureFlags } from '@/lib/app-features'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user, role } = await requireAdmin()
  const features = await getFeatureFlags(supabase)

  return (
    <AdminShell userEmail={user.email ?? ''} role={role} features={features}>
      {children}
    </AdminShell>
  )
}
