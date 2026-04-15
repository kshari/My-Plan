-- ─── Partnerships Accounting — Phase 1 ───────────────────────────────────────
-- Tables: pt_fiscal_years, pt_accounts
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_fiscal_years ───────────────────────────────────────────────────────────
CREATE TABLE pt_fiscal_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  label       text NOT NULL,                    -- e.g. "FY 2026"
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  tax_year    int  NOT NULL,                    -- e.g. 2026
  is_closed   bool NOT NULL DEFAULT false,
  closed_at   timestamptz,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fy_dates_check CHECK (end_date > start_date),
  CONSTRAINT fy_unique_tax_year UNIQUE (entity_id, tax_year)
);

ALTER TABLE pt_fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY fy_select ON pt_fiscal_years FOR SELECT
  USING (is_entity_member(entity_id, auth.uid()));

CREATE POLICY fy_insert ON pt_fiscal_years FOR INSERT
  WITH CHECK (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY fy_update ON pt_fiscal_years FOR UPDATE
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin'));

-- 2. pt_accounts (Chart of Accounts) ─────────────────────────────────────────
CREATE TABLE pt_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  account_code  text NOT NULL,
  name          text NOT NULL,
  type          text NOT NULL
                CHECK (type IN ('asset','liability','equity','income','expense')),
  subtype       text,   -- 'cash','ar','ap','partner_capital','retained_earnings',
                        -- 'revenue','cogs','operating_expense','other_income',
                        -- 'other_expense','note_payable','fixed_asset','investment'
  parent_id     uuid REFERENCES pt_accounts(id) ON DELETE SET NULL,
  member_id     uuid REFERENCES pt_members(id) ON DELETE SET NULL,  -- per-partner equity
  is_system     bool NOT NULL DEFAULT false,   -- auto-created, cannot be deleted
  description   text,
  is_active     bool NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acct_code_unique UNIQUE (entity_id, account_code)
);

ALTER TABLE pt_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY acct_select ON pt_accounts FOR SELECT
  USING (is_entity_member(entity_id, auth.uid()));

CREATE POLICY acct_insert ON pt_accounts FOR INSERT
  WITH CHECK (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY acct_update ON pt_accounts FOR UPDATE
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY acct_delete ON pt_accounts FOR DELETE
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin') AND is_system = false);

-- Index for fast account lookups within an entity
CREATE INDEX pt_accounts_entity_type_idx ON pt_accounts (entity_id, type);
CREATE INDEX pt_accounts_entity_member_idx ON pt_accounts (entity_id, member_id) WHERE member_id IS NOT NULL;
