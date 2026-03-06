import { requireAdmin } from '@/lib/utils/auth'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role } = await requireAdmin()

  return (
    <AdminShell userEmail={user.email ?? ''} role={role}>
      {children}
    </AdminShell>
  )
}
