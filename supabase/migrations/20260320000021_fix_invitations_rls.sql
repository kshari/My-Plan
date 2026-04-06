-- SECURITY FIX: Drop the overly permissive invitations_token_select policy.
-- This policy allowed ANY authenticated user to read ALL invitation rows, exposing
-- invite tokens, invite emails, and entity IDs for every pending invitation.
-- The partnership join flow uses createAdminClient() (service role) to look up
-- invitations by token, so this RLS policy is unnecessary.

DROP POLICY IF EXISTS "invitations_token_select" ON pt_invitations;
