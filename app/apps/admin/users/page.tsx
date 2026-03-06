import { requireAdmin } from '@/lib/utils/auth'
import { redirect } from 'next/navigation'
import { AdminUsersList } from '@/components/admin/admin-users-list'

export default async function AdminUsersPage() {
  const { supabase, user, role } = await requireAdmin()

  if (role !== 'super_admin') redirect('/apps/admin/feedback')

  const { data: admins } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true })

  return <AdminUsersList initialAdmins={admins ?? []} currentUserId={user.id} />
}
