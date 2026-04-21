-- Add vacancy_rate to pi_properties as a property-level default
-- (inherited by new scenarios). The property_management column is
-- stored in the expense_breakdown JSONB (already exists) so no new
-- column is needed for that.

ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS vacancy_rate NUMERIC;

COMMENT ON COLUMN pi_properties.vacancy_rate IS
  'Default vacancy rate % (e.g. 5 = 5%). Reduces gross rent to effective income. Inherited by new scenarios.';

-- Mirror on team_shared_properties
ALTER TABLE team_shared_properties
  ADD COLUMN IF NOT EXISTS vacancy_rate NUMERIC;

COMMENT ON COLUMN team_shared_properties.vacancy_rate IS
  'Mirrors pi_properties.vacancy_rate — default vacancy rate %.';
