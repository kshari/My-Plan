-- Add Sale Cost Rate to scenario tables.
-- Models the cost of selling the property (realtor commissions, closing fees,
-- transfer taxes) as a % of the sale price. Used when computing IRR / equity
-- on an assumed year-end sale. Typical industry default is ~7%.

ALTER TABLE pi_financial_scenarios
  ADD COLUMN IF NOT EXISTS "Sale Cost Rate" NUMERIC DEFAULT 7;

COMMENT ON COLUMN pi_financial_scenarios."Sale Cost Rate" IS
  'Cost of selling the property (realtor commission + closing) as % of sale price. Applied to sale proceeds in IRR calculation.';

-- Mirror on team_shared_scenarios so sharing preserves the value.
ALTER TABLE team_shared_scenarios
  ADD COLUMN IF NOT EXISTS "Sale Cost Rate" NUMERIC DEFAULT 7;

COMMENT ON COLUMN team_shared_scenarios."Sale Cost Rate" IS
  'Mirrors pi_financial_scenarios."Sale Cost Rate".';

-- Backfill: existing scenarios get 7% (DEFAULT above only applies to future rows in some PG versions)
UPDATE pi_financial_scenarios   SET "Sale Cost Rate" = 7 WHERE "Sale Cost Rate" IS NULL;
UPDATE team_shared_scenarios    SET "Sale Cost Rate" = 7 WHERE "Sale Cost Rate" IS NULL;
