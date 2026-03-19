import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JoinTeamClient from '@/components/property/teams/join-team-client'

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function JoinTeamPage({ searchParams }: JoinPageProps) {
  const { token } = await searchParams

  // Require auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/teams/join${token ? `?token=${token}` : ''}`)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Invalid invitation link</p>
          <p className="text-sm text-muted-foreground">This link is missing a token. Please request a new invitation.</p>
        </div>
      </div>
    )
  }

  // Look up invitation
  const { data: invitation } = await supabase
    .from('team_invitations')
    .select('team_id, status, expires_at, teams(id, name)')
    .eq('invite_token', token)
    .single()

  if (!invitation || !invitation.teams) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Invitation not found</p>
          <p className="text-sm text-muted-foreground">This invitation link is invalid or has been revoked.</p>
        </div>
      </div>
    )
  }

  if (invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Invitation expired or already used</p>
          <p className="text-sm text-muted-foreground">Please ask your team admin to send a new invitation.</p>
        </div>
      </div>
    )
  }

  const team = invitation.teams as unknown as { id: string; name: string }

  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.id)
    .single()

  // Member count
  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)

  return (
    <JoinTeamClient
      token={token}
      teamName={team.name}
      memberCount={count ?? 0}
      alreadyMember={!!existing}
    />
  )
}
