import { requireAuth } from '@/lib/utils/auth'
import PortfolioDashboard from '@/components/PortfolioDashboard'

export default async function PortfolioPage() {
  const { user } = await requireAuth()

  return <PortfolioDashboard user={user} />
}
