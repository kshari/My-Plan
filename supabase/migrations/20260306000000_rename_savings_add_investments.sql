-- Rename total_non_retirement_savings to emergency_fund
-- Add stock_investments and real_estate_investments columns

ALTER TABLE fp_profiles
  RENAME COLUMN total_non_retirement_savings TO emergency_fund;

ALTER TABLE fp_profiles
  ADD COLUMN IF NOT EXISTS stock_investments numeric NOT NULL DEFAULT 0;

ALTER TABLE fp_profiles
  ADD COLUMN IF NOT EXISTS real_estate_investments numeric NOT NULL DEFAULT 0;
