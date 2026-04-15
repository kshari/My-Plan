-- ─── Partnerships Accounting — Phase 2 ───────────────────────────────────────
-- Tables: pt_journal_entries, pt_journal_lines
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_journal_entries ───────────────────────────────────────────────────────
CREATE TABLE pt_journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  fiscal_year_id  uuid REFERENCES pt_fiscal_years(id) ON DELETE SET NULL,
  entry_date      date NOT NULL,
  description     text NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','posted','voided')),
  entry_type      text NOT NULL DEFAULT 'manual'
                  CHECK (entry_type IN ('manual','closing')),
  reference_type  text,   -- 'capital_call'|'distribution'|'capital_event'|'transaction'
  reference_id    uuid,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY je_select ON pt_journal_entries FOR SELECT
  USING (is_entity_member(entity_id, auth.uid()));

CREATE POLICY je_insert ON pt_journal_entries FOR INSERT
  WITH CHECK (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY je_update ON pt_journal_entries FOR UPDATE
  USING (
    entity_member_role(entity_id, auth.uid()) IN ('admin')
    AND status != 'posted'   -- posted entries are immutable; void instead
  );

CREATE POLICY je_delete ON pt_journal_entries FOR DELETE
  USING (
    entity_member_role(entity_id, auth.uid()) IN ('admin')
    AND status = 'draft'
  );

CREATE INDEX pt_je_entity_date_idx ON pt_journal_entries (entity_id, entry_date DESC);
CREATE INDEX pt_je_entity_fy_idx   ON pt_journal_entries (entity_id, fiscal_year_id);

-- 2. pt_journal_lines ─────────────────────────────────────────────────────────
CREATE TABLE pt_journal_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  uuid NOT NULL REFERENCES pt_journal_entries(id) ON DELETE CASCADE,
  entity_id         uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  account_id        uuid NOT NULL REFERENCES pt_accounts(id) ON DELETE RESTRICT,
  debit             numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit            numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo              text,
  line_order        int NOT NULL DEFAULT 0,
  CONSTRAINT jl_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

ALTER TABLE pt_journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY jl_select ON pt_journal_lines FOR SELECT
  USING (is_entity_member(entity_id, auth.uid()));

CREATE POLICY jl_insert ON pt_journal_lines FOR INSERT
  WITH CHECK (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY jl_update ON pt_journal_lines FOR UPDATE
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE POLICY jl_delete ON pt_journal_lines FOR DELETE
  USING (entity_member_role(entity_id, auth.uid()) IN ('admin'));

CREATE INDEX pt_jl_entry_idx   ON pt_journal_lines (journal_entry_id);
CREATE INDEX pt_jl_account_idx ON pt_journal_lines (account_id);
CREATE INDEX pt_jl_entity_idx  ON pt_journal_lines (entity_id);

-- DB-level balanced-entry check (fires on INSERT/UPDATE to pt_journal_lines for posted entries)
CREATE OR REPLACE FUNCTION check_journal_entry_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
  v_debit  numeric;
  v_credit numeric;
BEGIN
  SELECT status INTO v_status FROM pt_journal_entries WHERE id = NEW.journal_entry_id;
  IF v_status = 'posted' THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO v_debit, v_credit
      FROM pt_journal_lines
     WHERE journal_entry_id = NEW.journal_entry_id;
    IF round(v_debit, 2) != round(v_credit, 2) THEN
      RAISE EXCEPTION 'Journal entry % is unbalanced: debits=% credits=%',
        NEW.journal_entry_id, v_debit, v_credit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE ON pt_journal_lines
  FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balance();
