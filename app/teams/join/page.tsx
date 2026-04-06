import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import JoinTeamClient from '@/components/property/teams/join-team-client'

interface JoinPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function JoinTeamPage({ searchParams }: JoinPageProps) {
  const { token } = await searchParams

  // Require auth — preserve the full invite URL as the post-login destination
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const next = token ? `/teams/join?token=${encodeURIComponent(token)}` : '/teams/join'
    redirect(`/login?next=${encodeURIComponent(next)}&invite=1`)
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

  // Use the admin client to look up the invitation and team — the user is not
  // yet a member so session-level RLS would block these reads. We removed the
  // broad "pending invite" SELECT policies in favour of this server-side admin approach.
  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('team_invitations')
    .select('team_id, status, expires_at')
    .eq('invite_token', token)
    .single()

  if (!invitation) {
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

  // Fetch the team via the admin client — the user is not yet a member so RLS
  // would block a session-level read.
  const { data: team } = await admin
    .from('teams')
    .select('id, name')
    .eq('id', invitation.team_id)
    .single()

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Team not found</p>
          <p className="text-sm text-muted-foreground">The team associated with this invitation no longer exists.</p>
        </div>
      </div>
    )
  }

  // Check if already a member — use session client so RLS correctly scopes to
  // the current user's own membership row.
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.id)
    .single()

  // Member count via admin client — session RLS would return 0 for non-members.
  const { count } = await admin
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
