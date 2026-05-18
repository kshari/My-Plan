-- Add Current Market Value / Appraised Value to property tables and scenarios.
--
-- This represents the property's current market value (typically from a recent
-- appraisal, BPO, or AVM estimate). It is used as the Year-0 basis for property
-- value projections in the year-by-year IRR calculation, so investors can see
-- forward-looking returns based on what the property is worth today, not what
-- they originally paid. When NULL, callers fall back to Purchase Price.
--
-- Lives at both the property level (the actual real-world appraised value) and
-- the scenario level (lets users model "what if my appraisal came in higher /
-- lower"). New scenarios seed from the property's current_market_value.

ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS current_market_value NUMERIC;

COMMENT ON COLUMN pi_properties.current_market_value IS
  'Current market value / appraised value of the property. Used as Year-0 basis for forward-looking IRR projections. NULL falls back to Asking Price / Purchase Price.';

ALTER TABLE team_shared_properties
  ADD COLUMN IF NOT EXISTS current_market_value NUMERIC;

COMMENT ON COLUMN team_shared_properties.current_market_value IS
  'Mirrors pi_properties.current_market_value.';

ALTER TABLE pi_financial_scenarios
  ADD COLUMN IF NOT EXISTS "Current Market Value" NUMERIC;

COMMENT ON COLUMN pi_financial_scenarios."Current Market Value" IS
  'Optional per-scenario override of the property current market value. Used as Year-0 basis for IRR projections. NULL falls back to Purchase Price.';

ALTER TABLE team_shared_scenarios
  ADD COLUMN IF NOT EXISTS "Current Market Value" NUMERIC;

COMMENT ON COLUMN team_shared_scenarios."Current Market Value" IS
  'Mirrors pi_financial_scenarios."Current Market Value".';
