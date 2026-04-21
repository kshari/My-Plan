-- Add Vacancy Rate and Property Management Rate to scenario tables.
-- These were previously only on pi_properties (as property-level defaults)
-- but scenarios need their own per-scenario values.

ALTER TABLE pi_financial_scenarios
  ADD COLUMN IF NOT EXISTS "Vacancy Rate"             NUMERIC,
  ADD COLUMN IF NOT EXISTS "Property Management Rate" NUMERIC;

COMMENT ON COLUMN pi_financial_scenarios."Vacancy Rate"             IS 'Vacancy rate % for this scenario (e.g. 5 = 5%). Reduces gross rent to effective income.';
COMMENT ON COLUMN pi_financial_scenarios."Property Management Rate" IS 'Property management fee % of effective income for this scenario (e.g. 8 = 8%).';

-- Mirror on team_shared_scenarios so sharing preserves these values.
ALTER TABLE team_shared_scenarios
  ADD COLUMN IF NOT EXISTS "Vacancy Rate"             NUMERIC,
  ADD COLUMN IF NOT EXISTS "Property Management Rate" NUMERIC;

COMMENT ON COLUMN team_shared_scenarios."Vacancy Rate"             IS 'Mirrors pi_financial_scenarios."Vacancy Rate".';
COMMENT ON COLUMN team_shared_scenarios."Property Management Rate" IS 'Mirrors pi_financial_scenarios."Property Management Rate".';
