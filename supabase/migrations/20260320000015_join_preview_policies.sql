-- ─── Join Preview RLS Policies ───────────────────────────────────────────────
-- Allow unauthenticated visitors (invite recipients who haven't logged in yet)
-- to read the minimal entity/member info needed to render the join page.
-- Access is gated on a currently-valid pending invitation, so random enumeration
-- is not possible (entity/member UUIDs must already be known).
-- ─────────────────────────────────────────────────────────────────────────────

-- Let anyone see entity name/type when a pending invite exists for that entity
CREATE POLICY "entity_join_preview" ON pt_entities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pt_invitations
      WHERE entity_id  = pt_entities.id
        AND status     = 'pending'
        AND expires_at > now()
    )
  );

-- Let anyone see a placeholder member's display_name when a pending invite
-- references that specific member row (used to pre-fill the join form)
CREATE POLICY "members_join_preview" ON pt_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pt_invitations
      WHERE member_id  = pt_members.id
        AND status     = 'pending'
        AND expires_at > now()
    )
  );
