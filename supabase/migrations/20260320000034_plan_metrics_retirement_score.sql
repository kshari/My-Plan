-- Add retirement_score to rp_plan_metrics so the dashboard can show the
-- multi-factor retirement score (longevity, cashflow, tax efficiency, inflation,
-- medical) instead of the simpler confidence / viability percentage.
ALTER TABLE rp_plan_metrics
  ADD COLUMN IF NOT EXISTS retirement_score INTEGER;

COMMENT ON COLUMN rp_plan_metrics.retirement_score IS
  'Multi-factor retirement score (0-100) computed by calculateRetirementScore: '
  'longevity 50%, cashflow 12.5%, tax 12.5%, inflation 12.5%, medical 12.5%. '
  'Saved whenever the Quick Projections (snapshot) tab is calculated.';
