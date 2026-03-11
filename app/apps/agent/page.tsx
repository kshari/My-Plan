import { requireAuth } from '@/lib/utils/auth'
import { AgentPageOpener } from './agent-page-opener'

export default async function AgentPage() {
  await requireAuth()
  return <AgentPageOpener />
}
