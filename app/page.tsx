import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/utils/auth'
import { HomeContent } from '@/components/home-content'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const adminCheck = await checkAdmin(supabase, user.id)
    isAdmin = adminCheck.isAdmin
  }

  return <HomeContent userEmail={user?.email ?? null} isAdmin={isAdmin} />
}
