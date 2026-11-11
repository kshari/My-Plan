ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS pm_contact_id   uuid REFERENCES pi_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_fee_type     text CHECK (pm_fee_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS pm_fee_amount   numeric(10,2);
