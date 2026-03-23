-- ─── Partnerships — Member Identity Improvements ──────────────────────────────
-- * name_confirmed flag: set to true when a member explicitly confirms their
--   display name on the join page (vs. a name entered by an admin on their behalf)
-- * Unique email per entity: prevents duplicate member records for the same
--   email address within an entity (only enforced when email is not null and
--   the member is not removed)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add name_confirmed column ─────────────────────────────────────────────────
ALTER TABLE pt_members
  ADD COLUMN IF NOT EXISTS name_confirmed boolean NOT NULL DEFAULT false;

-- Mark existing active members who have a linked user_id as already confirmed
UPDATE pt_members
   SET name_confirmed = true
 WHERE user_id IS NOT NULL
   AND status = 'active';

-- 2. Data normalisation before creating the unique index ───────────────────────

-- Convert empty / whitespace-only email values to proper NULL so the index
-- predicate (email IS NOT NULL) reliably excludes them.
UPDATE pt_members
   SET email = NULL
 WHERE email IS NOT NULL
   AND trim(email) = '';

-- Where the same email appears more than once for the same entity (and is not
-- removed), keep the most important record and NULL-out the rest so the unique
-- index can be created without conflicts.  Priority: active > invited >
-- placeholder, then most recently created wins.
UPDATE pt_members AS m
   SET email = NULL
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY entity_id, lower(email)
             ORDER BY
               CASE status
                 WHEN 'active'      THEN 1
                 WHEN 'invited'     THEN 2
                 WHEN 'placeholder' THEN 3
                 ELSE 4
               END,
               created_at DESC
           ) AS rn
      FROM pt_members
     WHERE email IS NOT NULL
       AND status != 'removed'
  ) ranked
 WHERE m.id = ranked.id
   AND ranked.rn > 1;

-- 3. Unique email index (case-insensitive, non-null, non-removed) ──────────────
CREATE UNIQUE INDEX IF NOT EXISTS pt_members_entity_email_unique
  ON pt_members (entity_id, lower(email))
  WHERE email IS NOT NULL
    AND status != 'removed';

-- 4. Update members_select policy ─────────────────────────────────────────────
-- Allow a member whose user_id matches (any status) to read the member list,
-- so invited/placeholder members can see who else is in the entity before they
-- formally confirm via the join page.

DROP POLICY IF EXISTS "members_select" ON pt_members;

CREATE POLICY "members_select" ON pt_members
  FOR SELECT USING (
    is_entity_member(entity_id)
    OR user_id = auth.uid()
  );
