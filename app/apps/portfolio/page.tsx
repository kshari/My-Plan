import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortfolioDashboard from '@/components/PortfolioDashboard'

export default async function PortfolioPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <PortfolioDashboard user={user} />
}
