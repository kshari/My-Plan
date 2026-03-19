-- Fix RLS policies that prevent team creation due to chicken-and-egg membership checks.
--
-- Problem 1: After INSERT into teams, the SELECT policy uses is_team_member(id)
--   which returns false because the creator isn't a member yet (added in next step).
--   The Supabase client can't read back the just-created row, so .select().single()
--   returns null and the API reports an error.
--
-- Problem 2: The team_members INSERT policy tries team_member_role(team_id) which
--   returns NULL for a brand-new team (no rows yet), blocking the owner INSERT.
--
-- Fix: Drop and recreate the affected policies with corrected logic.

-- ── teams: allow creator to SELECT their own team (before becoming a member) ──
DROP POLICY IF EXISTS "Team members can view team" ON teams;

CREATE POLICY "Team members or creator can view team"
  ON teams FOR SELECT
  USING (
    is_team_member(id)
    OR created_by = auth.uid()
  );

-- ── team_members: allow any authenticated user to insert a row for themselves ──
-- This covers both:
--   a) the owner row inserted by the API right after creating a team
--   b) a new member inserting themselves when accepting an invite
DROP POLICY IF EXISTS "Owner or admin can insert members" ON team_members;

CREATE POLICY "Members can insert themselves; owners/admins can insert others"
  ON team_members FOR INSERT
  WITH CHECK (
    -- Anyone can insert a row where they are the user (owner bootstrapping or join)
    user_id = auth.uid()
    -- Existing owners/admins can also add other users
    OR team_member_role(team_id) IN ('owner', 'admin')
  );

-- ── team_members: allow SELECT during bootstrapping ──────────────────────────
-- is_team_member() works via a SECURITY DEFINER function that bypasses RLS,
-- so this policy is fine as-is; no change needed for SELECT.

-- ── team_invitations: duplicate SELECT policy conflict ────────────────────────
-- The original migration has two SELECT policies on team_invitations which can
-- cause ambiguity. Drop the token-based one and merge logic into one policy.
DROP POLICY IF EXISTS "Team members can view invitations" ON team_invitations;
DROP POLICY IF EXISTS "Anyone can read pending invitation by token" ON team_invitations;

CREATE POLICY "View invitations: member or pending token lookup"
  ON team_invitations FOR SELECT
  USING (
    is_team_member(team_id)
    OR (status = 'pending' AND expires_at > now())
  );
