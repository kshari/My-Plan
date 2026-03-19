import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import Link from 'next/link'
import CreateTeamForm from '@/components/property/teams/create-team-form'

export default async function NewTeamPage() {
  await requireAuth()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/property/teams" className={BACK_LINK}>
        ← Back to Teams
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create a Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a team to share and collaborate on property analysis with others.
        </p>
      </div>
      <CreateTeamForm />
    </div>
  )
}
