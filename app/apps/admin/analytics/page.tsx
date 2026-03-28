import { requireAdmin } from '@/lib/utils/auth'
import { AdminAnalytics } from '@/components/admin/admin-analytics'

export default async function AdminAnalyticsPage() {
  await requireAdmin()
  return <AdminAnalytics />
}
