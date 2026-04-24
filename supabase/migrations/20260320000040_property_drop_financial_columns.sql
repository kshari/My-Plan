-- Phase 3: Drop redundant financial columns from pi_properties and team_shared_properties
-- These columns are now stored in pi_financial_scenarios (is_base=true rows).

ALTER TABLE pi_properties
  DROP COLUMN IF EXISTS "Gross Income",
  DROP COLUMN IF EXISTS "Operating Expenses",
  DROP COLUMN IF EXISTS expense_breakdown,
  DROP COLUMN IF EXISTS vacancy_rate,
  DROP COLUMN IF EXISTS income_increase,
  DROP COLUMN IF EXISTS expenses_increase,
  DROP COLUMN IF EXISTS property_value_increase,
  DROP COLUMN IF EXISTS estimated_rent,
  DROP COLUMN IF EXISTS estimated_cash_flow;

ALTER TABLE team_shared_properties
  DROP COLUMN IF EXISTS "Gross Income",
  DROP COLUMN IF EXISTS "Operating Expenses",
  DROP COLUMN IF EXISTS expense_breakdown,
  DROP COLUMN IF EXISTS vacancy_rate,
  DROP COLUMN IF EXISTS income_increase,
  DROP COLUMN IF EXISTS expenses_increase,
  DROP COLUMN IF EXISTS property_value_increase,
  DROP COLUMN IF EXISTS estimated_rent,
  DROP COLUMN IF EXISTS estimated_cash_flow;
