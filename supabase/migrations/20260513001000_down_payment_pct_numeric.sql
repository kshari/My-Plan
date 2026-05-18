-- Widen "Down Payment Percentage" from smallint to numeric so fractional
-- percentages are accepted. Smallint only allowed whole integers, which broke
-- the bidirectional Down Payment $ ⇆ Down Payment % sync once the computed
-- percentage had any decimal precision (e.g. $100,000 / $432,000 ≈ 23.15%).
--
-- The mirror tables (team_shared_scenarios, team_shared_loans) already use
-- numeric, so this brings the personal tables in line with the shared schema.

ALTER TABLE pi_financial_scenarios
  ALTER COLUMN "Down Payment Percentage" TYPE NUMERIC USING "Down Payment Percentage"::NUMERIC;

ALTER TABLE pi_loans
  ALTER COLUMN "Down Payment Percentage" TYPE NUMERIC USING "Down Payment Percentage"::NUMERIC;

COMMENT ON COLUMN pi_financial_scenarios."Down Payment Percentage" IS
  'Down payment as a percentage of purchase price. Supports decimal precision so a $-derived percentage like 23.15% can round-trip without truncation.';

COMMENT ON COLUMN pi_loans."Down Payment Percentage" IS
  'Down payment as a percentage of purchase price (numeric).';
