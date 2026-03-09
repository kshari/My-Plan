import { requireAdmin } from '@/lib/utils/auth'
import { AdminFeedbackList } from '@/components/admin/admin-feedback-list'

export default async function AdminFeedbackPage() {
  const { supabase } = await requireAdmin()

  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  return <AdminFeedbackList initialFeedback={feedback ?? []} />
}
