-- ─── Partnerships — Separate Membership Status from Account/Join Status ──────
--
-- pt_members.status       = app account state (placeholder → invited → active)
--                           Set by the system (invitation flow, join flow).
--
-- pt_members.membership_status = partnership participation agreement
--                           Set by the admin (did this person confirm they are
--                           a participating member of the partnership?).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pt_members
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('pending', 'confirmed', 'declined'));

-- Migrate existing data:
--   active   → confirmed  (they joined the app, treat as having confirmed)
--   removed  → declined   (removed from the group)
--   placeholder / invited → pending (default, awaiting admin confirmation)
UPDATE pt_members SET membership_status = 'confirmed' WHERE status = 'active';
UPDATE pt_members SET membership_status = 'declined'  WHERE status = 'removed';

COMMENT ON COLUMN pt_members.status IS
  'App/account join state: placeholder | invited | active | removed. Managed by the system.';

COMMENT ON COLUMN pt_members.membership_status IS
  'Partnership participation agreement: pending | confirmed | declined. Set by admins.';
