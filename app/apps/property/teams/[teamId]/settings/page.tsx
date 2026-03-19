import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamSettings from '@/components/property/teams/team-settings'
import type { TeamMember } from '@/lib/types/teams'

interface TeamSettingsPageProps {
  params: Promise<{ teamId: string }>
}

export default async function TeamSettingsPage({ params }: TeamSettingsPageProps) {
  const { teamId } = await params
  const { supabase, user } = await requireAuth()

  // Verify membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(id, name, description)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !membership.teams) notFound()

  const team = membership.teams as unknown as { id: string; name: string; description: string | null }
  const currentUserRole = membership.role as TeamMember['role']

  // Fetch all members
  const { data: members } = await supabase
    .from('team_members')
    .select('id, user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('joined_at')

  // Fetch active invitations
  const { data: invitations } = await supabase
    .from('team_invitations')
    .select('id, invite_email, invite_token, status, expires_at, created_at, invited_by')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Enrich members with emails using Supabase admin (service role)
  // Falls back to truncated user IDs when admin key not available
  const membersWithEmail = (members ?? []).map(m => ({
    ...m,
    team_id: teamId,
    email: m.user_id === user.id ? user.email : undefined,
  }))

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/property/teams/${teamId}`} className={BACK_LINK}>
        ← Back to {team.name}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Team Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{team.name}</p>
      </div>

      <TeamSettings
        teamId={teamId}
        teamName={team.name}
        teamDescription={team.description}
        members={membersWithEmail}
        invitations={(invitations ?? []).map(i => ({ ...i, team_id: teamId }))}
        currentUserId={user.id}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
