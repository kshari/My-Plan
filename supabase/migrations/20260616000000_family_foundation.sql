-- Family Activity Planner — Foundation
-- Tables: fa_families, fa_members, fa_invitations

-- 1. fa_families
CREATE TABLE IF NOT EXISTS fa_families (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  home_location  text,
  home_lat       numeric(10,7),
  home_lng       numeric(10,7),
  created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fa_families ENABLE ROW LEVEL SECURITY;

-- 2. fa_members
CREATE TABLE IF NOT EXISTS fa_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  text NOT NULL,
  email         text,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','observer')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','placeholder','removed')),
  age_band      text NOT NULL DEFAULT 'adult' CHECK (age_band IN ('adult','teen','child')),
  invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fa_members_family_user_unique ON fa_members (family_id, user_id) WHERE user_id IS NOT NULL;

ALTER TABLE fa_members ENABLE ROW LEVEL SECURITY;

-- 3. fa_invitations
CREATE TABLE IF NOT EXISTS fa_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  member_id     uuid REFERENCES fa_members(id) ON DELETE SET NULL,
  invited_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email  text,
  invite_token  text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fa_invitations ENABLE ROW LEVEL SECURITY;

-- RLS helper functions
CREATE OR REPLACE FUNCTION is_family_member(fid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM fa_members
    WHERE family_id = fid AND user_id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION family_member_role(fid uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM fa_members
  WHERE family_id = fid AND user_id = auth.uid() AND status = 'active'
  LIMIT 1
$$;

-- RLS policies: fa_families
CREATE POLICY "family_select" ON fa_families FOR SELECT USING (is_family_member(id) OR created_by = auth.uid());
CREATE POLICY "family_insert" ON fa_families FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "family_update" ON fa_families FOR UPDATE USING (family_member_role(id) = 'admin' OR created_by = auth.uid());
CREATE POLICY "family_delete" ON fa_families FOR DELETE USING (created_by = auth.uid());

-- RLS policies: fa_members
CREATE POLICY "family_members_select" ON fa_members FOR SELECT USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE POLICY "family_members_insert" ON fa_members FOR INSERT WITH CHECK (family_member_role(family_id) = 'admin' OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE POLICY "family_members_update" ON fa_members FOR UPDATE USING (family_member_role(family_id) = 'admin' OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()) OR user_id = auth.uid());
CREATE POLICY "family_members_delete" ON fa_members FOR DELETE USING (family_member_role(family_id) = 'admin' OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));

-- RLS policies: fa_invitations
CREATE POLICY "family_invitations_select" ON fa_invitations FOR SELECT USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()) OR true);
CREATE POLICY "family_invitations_insert" ON fa_invitations FOR INSERT WITH CHECK (family_member_role(family_id) = 'admin' OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE POLICY "family_invitations_update" ON fa_invitations FOR UPDATE USING (family_member_role(family_id) = 'admin' OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));

-- Indexes
CREATE INDEX fa_members_family_id_idx ON fa_members (family_id);
CREATE INDEX fa_members_user_id_idx ON fa_members (user_id);
CREATE INDEX fa_invitations_family_id_idx ON fa_invitations (family_id);
CREATE INDEX fa_invitations_token_idx ON fa_invitations (invite_token);
