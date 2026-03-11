-- Property Import Loads and Lead Fields
-- Supports bulk import of properties from CSV/PDF with batch tracking.

-- 1. Import loads (batches) table
CREATE TABLE IF NOT EXISTS public.pi_import_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_name text,
  file_type text CHECK (file_type IN ('csv', 'pdf')),
  property_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('processing', 'complete', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_import_loads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import loads"
  ON pi_import_loads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own import loads"
  ON pi_import_loads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own import loads"
  ON pi_import_loads FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own import loads"
  ON pi_import_loads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_pi_import_loads_user_id ON pi_import_loads(user_id);

-- 2. Add lead-specific columns to pi_properties
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS import_load_id uuid REFERENCES pi_import_loads(id) ON DELETE SET NULL;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS listing_status text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS mls_number text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS listing_url text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS bedrooms integer;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS bathrooms numeric;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS sqft numeric;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS lot_size text;
ALTER TABLE pi_properties ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_pi_properties_import_load_id ON pi_properties(import_load_id);
CREATE INDEX IF NOT EXISTS idx_pi_properties_mls_number ON pi_properties(mls_number);
