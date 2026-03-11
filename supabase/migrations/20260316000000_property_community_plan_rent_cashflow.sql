-- Add Community, Plan Name, Estimated Rent, Estimated Cash Flow columns to pi_properties.

ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS community text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS plan_name text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS estimated_rent numeric;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS estimated_cash_flow numeric;
