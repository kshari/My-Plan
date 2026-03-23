-- Add cash_balance to partnership entities
ALTER TABLE pt_entities
  ADD COLUMN IF NOT EXISTS cash_balance numeric(18, 2) NOT NULL DEFAULT 0;
