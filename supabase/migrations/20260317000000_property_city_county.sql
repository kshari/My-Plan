-- Add city, county, swimming_pool, and additional_info to pi_properties.

ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS swimming_pool boolean;
-- Stores free-form text or JSON (e.g. unmapped import columns) for extra property info.
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS additional_info text;
