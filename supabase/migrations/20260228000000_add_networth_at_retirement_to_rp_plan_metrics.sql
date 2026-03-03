-- Add networth_at_retirement to rp_plan_metrics for Saved Retirement Plans table
ALTER TABLE rp_plan_metrics
ADD COLUMN IF NOT EXISTS networth_at_retirement numeric;

COMMENT ON COLUMN rp_plan_metrics.networth_at_retirement IS 'Projected net worth at retirement age (first year of retirement).';
