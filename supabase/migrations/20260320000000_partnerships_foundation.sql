-- ─── Partnerships Module — Foundation ────────────────────────────────────────
-- Tables: pt_entities, pt_members, pt_invitations
-- Phase 1: Entity + Members + Invitations with full RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_entities ──────────────────────────────────────────────────────────────
CREATE TABLE pt_entities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  entity_type       text NOT NULL DEFAULT 'llc'
                    CHECK (entity_type IN ('llc','lp','corporation','trust','informal','other')),
  description       text,
  state_of_formation text,
  ein               text,
  formation_date    date,
  fiscal_year_end   text DEFAULT '12/31',
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('forming','active','dissolved')),
  created_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_entities ENABLE ROW LEVEL SECURITY;

-- 2. pt_members ───────────────────────────────────────────────────────────────
CREATE TABLE pt_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  text NOT NULL,
  email         text,
  role          text NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin','member','observer')),
  ownership_pct numeric(7,4) NOT NULL DEFAULT 0
                CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','invited','placeholder','removed')),
  invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only enforce uniqueness when user_id is non-null
CREATE UNIQUE INDEX pt_members_entity_user_unique
  ON pt_members (entity_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE pt_members ENABLE ROW LEVEL SECURITY;

-- 3. pt_invitations ───────────────────────────────────────────────────────────
CREATE TABLE pt_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  member_id     uuid REFERENCES pt_members(id) ON DELETE SET NULL,
  invited_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email  text,
  invite_token  text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_invitations ENABLE ROW LEVEL SECURITY;

-- ─── Helper functions ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_entity_member(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pt_members
    WHERE entity_id = eid
      AND user_id = auth.uid()
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION entity_member_role(eid uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM pt_members
  WHERE entity_id = eid
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1
$$;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- pt_entities
CREATE POLICY "entity_select" ON pt_entities
  FOR SELECT USING (is_entity_member(id));

CREATE POLICY "entity_insert" ON pt_entities
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "entity_update" ON pt_entities
  FOR UPDATE USING (entity_member_role(id) = 'admin');

CREATE POLICY "entity_delete" ON pt_entities
  FOR DELETE USING (created_by = auth.uid());

-- Allow creator to read their entity immediately after insert
CREATE POLICY "entity_creator_select" ON pt_entities
  FOR SELECT USING (created_by = auth.uid());

-- pt_members
CREATE POLICY "members_select" ON pt_members
  FOR SELECT USING (is_entity_member(entity_id));

-- Creator can see members during bootstrap (before they are formally a member)
CREATE POLICY "members_creator_select" ON pt_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

CREATE POLICY "members_insert" ON pt_members
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin'
    OR EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

CREATE POLICY "members_update" ON pt_members
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin'
    OR EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

CREATE POLICY "members_delete" ON pt_members
  FOR DELETE USING (entity_member_role(entity_id) = 'admin'
    OR EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

-- pt_invitations
CREATE POLICY "invitations_select" ON pt_invitations
  FOR SELECT USING (is_entity_member(entity_id));

-- Allow reading by invite token (for join flow — unauthenticated/unjoined)
CREATE POLICY "invitations_token_select" ON pt_invitations
  FOR SELECT USING (true); -- token is secret; API validates before returning

CREATE POLICY "invitations_insert" ON pt_invitations
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin'
    OR EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

CREATE POLICY "invitations_update" ON pt_invitations
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin'
    OR EXISTS (SELECT 1 FROM pt_entities WHERE id = entity_id AND created_by = auth.uid())
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX pt_members_entity_id_idx ON pt_members (entity_id);
CREATE INDEX pt_members_user_id_idx ON pt_members (user_id);
CREATE INDEX pt_invitations_entity_id_idx ON pt_invitations (entity_id);
CREATE INDEX pt_invitations_token_idx ON pt_invitations (invite_token);
