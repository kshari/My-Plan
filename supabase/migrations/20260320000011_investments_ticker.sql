-- Add ticker/symbol to investments for market price lookups
ALTER TABLE pt_investments
  ADD COLUMN IF NOT EXISTS ticker text NULL;
