import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Settings, Share2 } from 'lucide-react'
import SharedPropertyList from '@/components/property/teams/shared-property-list'
import SharePropertiesDialog from '@/components/property/teams/share-properties-dialog'

interface TeamDashboardProps {
  params: Promise<{ teamId: string }>
}

export default async function TeamDashboardPage({ params }: TeamDashboardProps) {
  const { teamId } = await params
  const { supabase, user } = await requireAuth()

  // Verify membership and get team
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(id, name, description)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !membership.teams) notFound()

  const team = membership.teams as unknown as { id: string; name: string; description: string | null }

  // Fetch shared properties
  const { data: sharedProperties } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('team_id', teamId)
    .order('shared_at', { ascending: false })

  // Fetch member user IDs for display
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)

  // Build member email map from auth (best effort — emails from Supabase admin API not available client-side)
  // We show truncated user IDs as fallback; the Settings page shows emails via server admin context
  const memberEmailMap: Record<string, string> = {}

  // Fetch user's own properties for share dialog
  const { data: myProperties } = await supabase
    .from('pi_properties')
    .select('id, address, city, type, listing_status, "Asking Price"')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/property/teams" className={BACK_LINK}>
        ← Back to Teams
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          {team.description && (
            <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {sharedProperties?.length ?? 0} shared propert{(sharedProperties?.length ?? 0) !== 1 ? 'ies' : 'y'}
            &nbsp;·&nbsp; {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
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

      <SharedPropertyList
        teamId={teamId}
        properties={sharedProperties ?? []}
        memberEmailMap={memberEmailMap}
        canShare={(myProperties?.length ?? 0) > 0}
      />
    </div>
  )
}
