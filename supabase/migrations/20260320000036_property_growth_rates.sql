-- Add default growth rate columns to pi_properties so they serve as
-- property-level defaults inherited by new scenarios.
ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS income_increase NUMERIC,
  ADD COLUMN IF NOT EXISTS expenses_increase NUMERIC,
  ADD COLUMN IF NOT EXISTS property_value_increase NUMERIC;

COMMENT ON COLUMN pi_properties.income_increase         IS 'Default annual rent growth % (e.g. 3 = 3%). Inherited by new scenarios.';
COMMENT ON COLUMN pi_properties.expenses_increase       IS 'Default annual operating-expense growth %. Inherited by new scenarios.';
COMMENT ON COLUMN pi_properties.property_value_increase IS 'Default annual property appreciation %. Inherited by new scenarios.';
