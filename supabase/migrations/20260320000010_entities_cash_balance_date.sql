-- Track the "as of" date for the cash balance recorded on the entity
ALTER TABLE pt_entities
  ADD COLUMN IF NOT EXISTS cash_balance_as_of date NULL;
