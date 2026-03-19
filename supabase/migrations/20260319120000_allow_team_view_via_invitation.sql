-- Allow a user to read a team row when they hold a valid pending invitation for it.
-- This is needed on the /teams/join page: the user is not yet a member so the
-- existing policy (is_team_member OR created_by) would block the lookup and
-- the page would incorrectly show "Invitation not found".
CREATE POLICY "Invitee can view team via pending invitation"
  ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_invitations ti
      WHERE ti.team_id = teams.id
        AND ti.status = 'pending'
        AND ti.expires_at > now()
    )
  );
