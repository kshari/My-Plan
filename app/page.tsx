import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/utils/auth'
import { getFeatureFlags, type FeatureFlags } from '@/lib/app-features'
import { HomeContent } from '@/components/home-content'
import { getHomeDashboard } from '@/lib/dashboard/get-home-dashboard'
import type { AppSummary } from '@/lib/dashboard/types'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let features: FeatureFlags = { aiAgent: true }
  let summaries: AppSummary[] = []

  if (user) {
    const [adminCheck, flags, dashboardSummaries] = await Promise.all([
      checkAdmin(supabase, user.id),
      getFeatureFlags(supabase, user.id),
      getHomeDashboard(supabase, user.id),
    ])
    isAdmin = adminCheck.isAdmin
    features = flags
    summaries = dashboardSummaries
  }

  return (
    <HomeContent
      userEmail={user?.email ?? null}
      isAdmin={isAdmin}
      features={features}
      summaries={summaries}
    />
  )
}
