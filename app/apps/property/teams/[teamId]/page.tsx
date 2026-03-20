import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Settings, Share2, Users } from 'lucide-react'
import PropertyList from '@/components/property/property-list'
import PropertyPortfolioSummary from '@/components/property/portfolio-summary'
import SharePropertiesDialog from '@/components/property/teams/share-properties-dialog'

interface TeamDashboardProps {
  params: Promise<{ teamId: string }>
}

export default async function TeamDashboardPage({ params }: TeamDashboardProps) {
  const { teamId } = await params
  const { supabase, user } = await requireAuth()

  // Verify membership and get team info
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(id, name, description)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !membership.teams) notFound()

  const team = membership.teams as unknown as { id: string; name: string; description: string | null }

  // Fetch shared properties and team members in parallel
  const [{ data: sharedProperties }, { data: members }, { data: myProperties }] = await Promise.all([
    supabase
      .from('team_shared_properties')
      .select('*')
      .eq('team_id', teamId)
      .order('shared_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId),
    supabase
      .from('pi_properties')
      .select('id, address, city, type, listing_status, "Asking Price"')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const properties = (sharedProperties ?? []).map(p => ({
    ...p,
    // Ensure created_at is always present (fall back to shared_at)
    created_at: p.created_at ?? p.shared_at,
  }))

  const linkPrefix = `/apps/property/teams/${teamId}/properties`
  const compareBase = `/apps/property/teams/${teamId}/compare`

  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/property/teams" className={BACK_LINK}>
        ← Back to Teams
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          {team.description && (
            <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{properties.length} shared propert{properties.length !== 1 ? 'ies' : 'y'}</span>
            <span>·</span>
            <span className="capitalize">{membership.role}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(myProperties?.length ?? 0) > 0 && (
            <SharePropertiesDialog
              teamId={teamId}
              properties={myProperties ?? []}
              trigger={
                <button className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                  <Share2 className="h-4 w-4" />
                  Share Properties
                </button>
              }
            />
          )}
          <Link
            href={`/apps/property/teams/${teamId}/settings`}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {properties.length > 0 && (
        <PropertyPortfolioSummary properties={properties} linkPrefix={linkPrefix} />
      )}

      <PropertyList
        properties={properties}
        linkPrefix={linkPrefix}
        compareBase={compareBase}
      />
    </div>
  )
}
