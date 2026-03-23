-- ─── Partnerships Module — Investments + Workflow ────────────────────────────
-- Tables: pt_investments, pt_investment_stages
-- Phase 2
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_investments ────────────────────────────────────────────────────────────
CREATE TABLE pt_investments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  investment_type text NOT NULL DEFAULT 'other'
                  CHECK (investment_type IN ('real_estate','private_equity','stock','business','fund','other')),
  description     text,
  target_amount   numeric(15,2),
  current_stage   text NOT NULL DEFAULT 'ideation'
                  CHECK (current_stage IN ('ideation','due_diligence','decision','capital_collection','execution','management','exit')),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','on_hold','exited','cancelled')),
  acquired_date   date,
  exit_date       date,
  exit_amount     numeric(15,2),
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_investments ENABLE ROW LEVEL SECURITY;

-- 2. pt_investment_stages ─────────────────────────────────────────────────────
CREATE TABLE pt_investment_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES pt_investments(id) ON DELETE CASCADE,
  stage         text NOT NULL
                CHECK (stage IN ('ideation','due_diligence','decision','capital_collection','execution','management','exit')),
  entered_at    timestamptz NOT NULL DEFAULT now(),
  entered_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes         text
);

ALTER TABLE pt_investment_stages ENABLE ROW LEVEL SECURITY;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

-- pt_investments
CREATE POLICY "investments_select" ON pt_investments
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "investments_insert" ON pt_investments
  FOR INSERT WITH CHECK (is_entity_member(entity_id));

CREATE POLICY "investments_update" ON pt_investments
  FOR UPDATE USING (is_entity_member(entity_id));

CREATE POLICY "investments_delete" ON pt_investments
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

-- pt_investment_stages
CREATE POLICY "stages_select" ON pt_investment_stages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pt_investments WHERE id = investment_id AND is_entity_member(entity_id))
  );

CREATE POLICY "stages_insert" ON pt_investment_stages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM pt_investments WHERE id = investment_id AND is_entity_member(entity_id))
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX pt_investments_entity_id_idx ON pt_investments (entity_id);
CREATE INDEX pt_investment_stages_investment_id_idx ON pt_investment_stages (investment_id);
