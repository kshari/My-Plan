import { requireAuth } from '@/lib/utils/auth'
import { HomeContent } from '@/components/home-content'

export default async function Home() {
  const { user } = await requireAuth()

  return <HomeContent userEmail={user.email ?? ''} />
}
