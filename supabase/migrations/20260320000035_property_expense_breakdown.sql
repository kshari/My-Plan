-- Add expense_breakdown to pi_properties so users can itemize monthly operating
-- costs (property taxes, insurance, CDD, HOA, maintenance, other) at the
-- property level, matching the pattern already used on pi_financial_scenarios.
-- The "Operating Expenses" column remains the authoritative total; expense_breakdown
-- is supplemental detail that the UI can auto-sum into the total.

ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS expense_breakdown JSONB;

COMMENT ON COLUMN pi_properties.expense_breakdown IS
  'Optional itemized monthly operating costs: '
  '{ property_taxes, insurance, cdd, hoa, maintenance, other } — '
  'all values in $/month. Sum equals "Operating Expenses" when itemized mode is used.';

-- Mirror the same column on team_shared_properties so shared/team copies retain
-- the breakdown when a property is pushed to a team.
ALTER TABLE team_shared_properties
  ADD COLUMN IF NOT EXISTS expense_breakdown JSONB;

COMMENT ON COLUMN team_shared_properties.expense_breakdown IS
  'Mirrors pi_properties.expense_breakdown — itemized monthly operating costs.';
