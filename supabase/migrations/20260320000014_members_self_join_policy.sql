-- ─── Self-Join RLS Policies ───────────────────────────────────────────────────
-- The original members_update and members_insert policies only allow admins /
-- entity creators to mutate pt_members rows.  That blocks the join flow where
-- an invited (non-admin, non-creator) user needs to:
--   1. Claim their own placeholder member row (UPDATE)
--   2. Create a fresh member row when the invitation has no member_id (INSERT)
--   3. Mark the invitation as accepted (UPDATE on pt_invitations)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow a user to claim the placeholder member row linked to their invite ──
CREATE POLICY "members_join_update" ON pt_members
  FOR UPDATE
  USING (
    -- The row must be referenced by a currently-valid invitation
    EXISTS (
      SELECT 1 FROM pt_invitations
      WHERE member_id  = pt_members.id
        AND status     = 'pending'
        AND expires_at > now()
    )
  )
  WITH CHECK (
    -- After the update the row must be owned by the acting user
    user_id = auth.uid()
  );

-- 2. Allow a user to insert their own member row via a valid entity invite ────
--    (handles invitations that were not pre-linked to a placeholder member)
CREATE POLICY "members_join_insert" ON pt_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pt_invitations
      WHERE entity_id  = pt_members.entity_id
        AND member_id  IS NULL
        AND status     = 'pending'
        AND expires_at > now()
    )
  );

-- 3. Allow the invite recipient to mark the invitation as accepted ─────────────
CREATE POLICY "invitations_self_accept" ON pt_invitations
  FOR UPDATE
  USING (
    -- Only the pending invitation the user is actively redeeming
    status = 'pending'
    AND expires_at > now()
    AND (
      -- Linked to a member row they own (after self-join update)
      EXISTS (
        SELECT 1 FROM pt_members
        WHERE id      = pt_invitations.member_id
          AND user_id = auth.uid()
      )
      -- Or a general entity invite with no pre-assigned member
      OR member_id IS NULL
    )
  )
  WITH CHECK (
    status = 'accepted'
  );
