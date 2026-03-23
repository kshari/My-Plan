-- ─── Partnerships — Capital Events (Industry-Standard Capital Ledger) ─────────
-- Replaces the overloaded capital_contributed / distributions_received columns
-- on pt_cap_table with a proper append-only event ledger.
--
-- pt_cap_table is now OWNERSHIP HISTORY only.
-- pt_capital_events is the single source of truth for all money flows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create pt_capital_events ─────────────────────────────────────────────────
CREATE TABLE pt_capital_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        uuid        NOT NULL REFERENCES pt_entities(id)    ON DELETE CASCADE,
  member_id        uuid        NOT NULL REFERENCES pt_members(id)     ON DELETE CASCADE,
  event_type       text        NOT NULL
                               CHECK (event_type IN (
                                 'contribution',       -- member pays capital in
                                 'distribution',       -- cash returned to member (profit)
                                 'return_of_capital',  -- return of invested capital
                                 'fee',                -- management / admin fee charged
                                 'correction'          -- explicit reversal / adjustment
                               )),
  amount           numeric(15,2) NOT NULL,   -- always the absolute value; direction from event_type
  effective_date   date        NOT NULL,
  investment_id    uuid        REFERENCES pt_investments(id)    ON DELETE SET NULL,
  capital_call_id  uuid        REFERENCES pt_capital_calls(id)  ON DELETE SET NULL,
  notes            text,
  recorded_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_capital_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cap_events_select" ON pt_capital_events
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "cap_events_insert" ON pt_capital_events
  FOR INSERT WITH CHECK (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_events_update" ON pt_capital_events
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin');

CREATE POLICY "cap_events_delete" ON pt_capital_events
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

CREATE INDEX pt_capital_events_entity_idx ON pt_capital_events (entity_id);
CREATE INDEX pt_capital_events_member_idx ON pt_capital_events (member_id);
CREATE INDEX pt_capital_events_date_idx   ON pt_capital_events (entity_id, effective_date DESC);

-- 2. Migrate existing capital data from pt_cap_table ──────────────────────────
-- Take only the latest entry per (entity, member) as the opening balance.

INSERT INTO pt_capital_events (
  entity_id, member_id, event_type, amount, effective_date, notes, recorded_by
)
SELECT DISTINCT ON (entity_id, member_id)
  entity_id,
  member_id,
  'contribution',
  capital_contributed,
  effective_date,
  'Opening balance — migrated from cap table',
  recorded_by
FROM pt_cap_table
WHERE capital_contributed > 0
ORDER BY entity_id, member_id, effective_date DESC, created_at DESC;

INSERT INTO pt_capital_events (
  entity_id, member_id, event_type, amount, effective_date, notes, recorded_by
)
SELECT DISTINCT ON (entity_id, member_id)
  entity_id,
  member_id,
  'distribution',
  distributions_received,
  effective_date,
  'Opening balance — migrated from cap table',
  recorded_by
FROM pt_cap_table
WHERE distributions_received > 0
ORDER BY entity_id, member_id, effective_date DESC, created_at DESC;

-- 3. Fix ownership trigger ─────────────────────────────────────────────────────
-- Previously fired on ANY insert, including historical backfills, which could
-- overwrite a member's current ownership_pct with a stale value.
-- Now only syncs when the new entry is the most recent one for that member.

CREATE OR REPLACE FUNCTION sync_member_ownership_pct()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_max_date date;
BEGIN
  SELECT MAX(effective_date)
    INTO current_max_date
    FROM pt_cap_table
   WHERE member_id = NEW.member_id
     AND id        != NEW.id;

  IF current_max_date IS NULL OR NEW.effective_date >= current_max_date THEN
    UPDATE pt_members
       SET ownership_pct = NEW.ownership_pct,
           updated_at    = now()
     WHERE id = NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Note: pt_cap_table.capital_contributed and distributions_received are now
-- deprecated. They are intentionally NOT dropped to preserve existing data,
-- but the application no longer writes to or reads from them.
-- They may be dropped in a future cleanup migration once safe to do so.
COMMENT ON COLUMN pt_cap_table.capital_contributed    IS 'DEPRECATED — use pt_capital_events instead';
COMMENT ON COLUMN pt_cap_table.distributions_received IS 'DEPRECATED — use pt_capital_events instead';
