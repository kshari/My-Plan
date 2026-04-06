-- SECURITY FIX: Drop overly permissive team join-preview SELECT policies.
--
-- "Invitee can view team via pending invitation" on teams lets ANY authenticated
-- user see ANY team that has at least one pending, unexpired invitation — it is
-- not scoped to the token holder at all.
--
-- "View invitations: member or pending token lookup" on team_invitations has a
-- branch `(status = 'pending' AND expires_at > now())` that lets ANY
-- authenticated user read ALL pending invitations (tokens, emails, team IDs).
--
-- Both policies were added for the /teams/join page, but that page now uses
-- createAdminClient() (service role) for those lookups, so these RLS policies
-- are no longer needed.

DROP POLICY IF EXISTS "Invitee can view team via pending invitation" ON teams;

-- Replace the merged policy with a member/creator-only policy (removes the
-- broad pending-invite branch).
DROP POLICY IF EXISTS "View invitations: member or pending token lookup" ON team_invitations;

CREATE POLICY "Team members can view invitations"
  ON team_invitations FOR SELECT
  USING (is_team_member(team_id));
