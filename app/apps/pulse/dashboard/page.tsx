import { requireAuth } from '@/lib/utils/auth'
import { PulseDashboard } from '@/components/pulse/pulse-dashboard'

export default async function PulseDashboardPage() {
  const { user } = await requireAuth()
  return <PulseDashboard userId={user.id} />
}
