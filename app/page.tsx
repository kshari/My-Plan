import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/utils/auth'
import { getFeatureFlags } from '@/lib/app-features'
import { HomeContent } from '@/components/home-content'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let features = { aiAgent: true as boolean }
  if (user) {
    const [adminCheck, flags] = await Promise.all([
      checkAdmin(supabase, user.id),
      getFeatureFlags(supabase),
    ])
    isAdmin = adminCheck.isAdmin
    features = flags
  }

  return (
    <HomeContent userEmail={user?.email ?? null} isAdmin={isAdmin} features={features} />
  )
}
