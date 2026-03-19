import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TeamList from '@/components/property/teams/team-list'

export default async function TeamsPage() {
  const { supabase, user } = await requireAuth()

  const { data: memberships } = await supabase
    .from('team_members')
    .select(`
      role,
      joined_at,
      teams (
        id, name, description, created_by, created_at, updated_at,
        team_members ( count )
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const teams = (memberships ?? []).filter(m => m.teams)

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborate and share properties with your team members.
          </p>
        </div>
        <Link
          href="/apps/property/teams/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Team
        </Link>
      </div>

      {/* @ts-expect-error Supabase nested select type */}
      <TeamList teams={teams} currentUserId={user.id} />
    </div>
  )
}
