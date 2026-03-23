-- ─── Partnerships Module — Cap Table ─────────────────────────────────────────
-- Tables: pt_cap_table
-- Phase 4
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pt_cap_table (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id              uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  member_id              uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  ownership_pct          numeric(7,4) NOT NULL
                         CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  capital_contributed    numeric(15,2) NOT NULL DEFAULT 0,
  distributions_received numeric(15,2) NOT NULL DEFAULT 0,
  effective_date         date NOT NULL,
  notes                  text,
  recorded_by            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_cap_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cap_table_select" ON pt_cap_table
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "cap_table_insert" ON pt_cap_table
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_table_update" ON pt_cap_table
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_table_delete" ON pt_cap_table
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

CREATE INDEX pt_cap_table_entity_id_idx ON pt_cap_table (entity_id);
CREATE INDEX pt_cap_table_member_id_idx ON pt_cap_table (member_id);
CREATE INDEX pt_cap_table_effective_date_idx ON pt_cap_table (entity_id, effective_date DESC);

-- ─── Trigger: sync pt_members.ownership_pct from latest cap table entry ──────
CREATE OR REPLACE FUNCTION sync_member_ownership_pct()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE pt_members
  SET ownership_pct = NEW.ownership_pct,
      updated_at = now()
  WHERE id = NEW.member_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_member_ownership
  AFTER INSERT OR UPDATE ON pt_cap_table
  FOR EACH ROW EXECUTE FUNCTION sync_member_ownership_pct();
