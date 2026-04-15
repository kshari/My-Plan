-- ─── Partnerships Accounting — Phase 3 ───────────────────────────────────────
-- Table: pt_k1_allocations (Schedule K-1 Form 1065 per partner per fiscal year)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pt_k1_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  fiscal_year_id  uuid NOT NULL REFERENCES pt_fiscal_years(id) ON DELETE CASCADE,

  -- Part II: Partner information
  ownership_pct         numeric(7,4) NOT NULL DEFAULT 0,
  capital_method        text NOT NULL DEFAULT 'tax'
                        CHECK (capital_method IN ('tax','GAAP','section704','other')),

  -- Part II: Partner capital account analysis
  beginning_capital     numeric(18,2) NOT NULL DEFAULT 0,
  contributions         numeric(18,2) NOT NULL DEFAULT 0,   -- Box 19A equiv for opening
  net_income_allocated  numeric(18,2) NOT NULL DEFAULT 0,
  withdrawals           numeric(18,2) NOT NULL DEFAULT 0,
  ending_capital        numeric(18,2) NOT NULL DEFAULT 0,

  -- Part III: Partner's share of income, deductions, credits, etc.
  -- Box 1: Ordinary business income (loss)
  box_1_ordinary_income         numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 2: Net rental real estate income (loss)
  box_2_net_rental_re_income    numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 3: Other net rental income (loss)
  box_3_other_net_rental_income numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 4: Guaranteed payments for services
  box_4_guaranteed_payments_svc numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 5: Guaranteed payments for capital
  box_5_guaranteed_payments_cap numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 6a: Net section 1231 gain (loss)
  box_6_net_1231_gain           numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 7: Other income (loss)
  box_7_other_income            numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 9a: Net long-term capital gain (loss)
  box_9a_lt_capital_gain        numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 9b: Collectibles (28%) gain (loss)
  box_9b_collectibles_gain      numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 9c: Unrecaptured section 1250 gain
  box_9c_unrec_1250_gain        numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 10: Net section 1231 gain (loss) — 28% rate gain
  box_10_net_1231_gain_28       numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 11: Other income (loss) — JSON array [{code, description, amount}]
  box_11_other_income_loss      jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Box 12: Section 179 deduction
  box_12_section_179            numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 13: Other deductions — JSON array [{code, description, amount}]
  box_13_other_deductions       jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Box 15: Credits — JSON array [{code, description, amount}]
  box_15_credits                jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Box 17: Alternative minimum tax items — JSON array [{code, amount}]
  box_17_amt_items              jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Box 18: Tax-exempt income and nondeductible expenses — JSON array
  box_18_tax_exempt             jsonb         NOT NULL DEFAULT '[]'::jsonb,
  -- Box 19: Distributions
  box_19a_distributions_cash    numeric(18,2) NOT NULL DEFAULT 0,
  box_19c_distributions_prop    numeric(18,2) NOT NULL DEFAULT 0,
  -- Box 20: Other information — JSON array [{code, description, amount}]
  box_20_other_info             jsonb         NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  is_final        bool NOT NULL DEFAULT false,
  finalized_at    timestamptz,
  notes           text,
  generated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT k1_unique_member_fy UNIQUE (entity_id, member_id, fiscal_year_id)
);

ALTER TABLE pt_k1_allocations ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all K-1s; members can only read their own
CREATE POLICY k1_select_admin ON pt_k1_allocations FOR SELECT
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY k1_select_own ON pt_k1_allocations FOR SELECT
  USING (
    is_entity_member(entity_id, auth.uid()) AND
    member_id IN (
      SELECT id FROM pt_members WHERE entity_id = pt_k1_allocations.entity_id AND user_id = auth.uid()
    )
  );

CREATE POLICY k1_insert ON pt_k1_allocations FOR INSERT
  WITH CHECK (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY k1_update ON pt_k1_allocations FOR UPDATE
  USING (
    entity_member_role(entity_id, auth.uid()) IN ('admin')
    AND is_final = false
  );

CREATE POLICY k1_delete ON pt_k1_allocations FOR DELETE
  USING (
    entity_member_role(entity_id, auth.uid()) IN ('admin')
    AND is_final = false
  );

CREATE INDEX pt_k1_entity_fy_idx ON pt_k1_allocations (entity_id, fiscal_year_id);
CREATE INDEX pt_k1_member_idx    ON pt_k1_allocations (member_id);
