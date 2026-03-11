import { requireAdmin } from '@/lib/utils/auth'
import { AdminAgentLogs } from '@/components/admin/admin-agent-logs'

export default async function AdminAgentLogsPage() {
  const { supabase } = await requireAdmin()

  const { data: logs } = await supabase
    .from('agent_request_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const userIds = [...new Set((logs ?? []).map((l) => l.user_id))]
  const emailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: feedbackRows } = await supabase
      .from('feedback')
      .select('user_id, email')
      .in('user_id', userIds)
    for (const row of feedbackRows ?? []) {
      if (row.email && !emailMap[row.user_id]) {
        emailMap[row.user_id] = row.email
      }
    }
    const { data: adminRows } = await supabase
      .from('admins')
      .select('user_id, email')
      .in('user_id', userIds)
    for (const row of adminRows ?? []) {
      if (row.email && !emailMap[row.user_id]) {
        emailMap[row.user_id] = row.email
      }
    }
  }

  return <AdminAgentLogs initialLogs={logs ?? []} emailMap={emailMap} />
}
