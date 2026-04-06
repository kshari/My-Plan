-- Drop the overly permissive join-preview RLS policies.
--
-- These policies allowed ANY authenticated user to see entities that had
-- pending invitations, leaking all partnership entities to non-members.
--
-- The join page uses createAdminClient() (service role) which bypasses
-- RLS entirely, so these policies were never needed.

DROP POLICY IF EXISTS "entity_join_preview" ON pt_entities;
DROP POLICY IF EXISTS "members_join_preview" ON pt_members;
