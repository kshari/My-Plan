import { createClient } from '@/lib/supabase/server'
import { HomeContent } from '@/components/home-content'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <HomeContent userEmail={user?.email ?? null} />
}
