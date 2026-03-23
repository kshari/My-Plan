-- ─── Partnerships Module — Financial Ledger ──────────────────────────────────
-- Tables: pt_transactions, pt_capital_calls, pt_distributions
-- Phase 3
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_transactions ───────────────────────────────────────────────────────────
CREATE TABLE pt_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id          uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  investment_id      uuid REFERENCES pt_investments(id) ON DELETE SET NULL,
  type               text NOT NULL
                     CHECK (type IN ('income','expense','capital_call','distribution','transfer')),
  category           text,
  description        text,
  amount             numeric(15,2) NOT NULL,
  transaction_date   date NOT NULL,
  recorded_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_document_id uuid,  -- FK to pt_documents added in Phase 6 migration
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_transactions ENABLE ROW LEVEL SECURITY;

-- 2. pt_capital_calls ─────────────────────────────────────────────────────────
CREATE TABLE pt_capital_calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES pt_investments(id) ON DELETE SET NULL,
  member_id     uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  amount        numeric(15,2) NOT NULL CHECK (amount > 0),
  due_date      date,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','partial','paid','overdue')),
  paid_amount   numeric(15,2) NOT NULL DEFAULT 0,
  paid_date     date,
  notes         text,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_capital_calls ENABLE ROW LEVEL SECURITY;

-- 3. pt_distributions ─────────────────────────────────────────────────────────
CREATE TABLE pt_distributions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  investment_id       uuid REFERENCES pt_investments(id) ON DELETE SET NULL,
  member_id           uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  amount              numeric(15,2) NOT NULL CHECK (amount > 0),
  distribution_date   date NOT NULL,
  type                text NOT NULL DEFAULT 'profit'
                      CHECK (type IN ('return_of_capital','profit','guaranteed_payment')),
  notes               text,
  created_by          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_distributions ENABLE ROW LEVEL SECURITY;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

-- pt_transactions
CREATE POLICY "txn_select" ON pt_transactions
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "txn_insert" ON pt_transactions
  FOR INSERT WITH CHECK (is_entity_member(entity_id));

CREATE POLICY "txn_update" ON pt_transactions
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin');

CREATE POLICY "txn_delete" ON pt_transactions
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

-- pt_capital_calls
CREATE POLICY "cap_calls_select" ON pt_capital_calls
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "cap_calls_insert" ON pt_capital_calls
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_calls_update" ON pt_capital_calls
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_calls_delete" ON pt_capital_calls
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

-- pt_distributions
CREATE POLICY "dist_select" ON pt_distributions
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "dist_insert" ON pt_distributions
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin');

CREATE POLICY "dist_update" ON pt_distributions
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin');

CREATE POLICY "dist_delete" ON pt_distributions
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX pt_transactions_entity_id_idx ON pt_transactions (entity_id);
CREATE INDEX pt_transactions_investment_id_idx ON pt_transactions (investment_id);
CREATE INDEX pt_capital_calls_entity_id_idx ON pt_capital_calls (entity_id);
CREATE INDEX pt_capital_calls_member_id_idx ON pt_capital_calls (member_id);
CREATE INDEX pt_distributions_entity_id_idx ON pt_distributions (entity_id);
CREATE INDEX pt_distributions_member_id_idx ON pt_distributions (member_id);
