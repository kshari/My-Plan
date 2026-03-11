-- Make feature flags environment-specific: Local, Staging, Production.
-- Each feature has one row per environment.

-- Add environment column (default 'production' for existing row)
ALTER TABLE public.app_features
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

ALTER TABLE public.app_features
  DROP CONSTRAINT IF EXISTS app_features_environment_check;
ALTER TABLE public.app_features
  ADD CONSTRAINT app_features_environment_check
  CHECK (environment IN ('local', 'staging', 'production'));

-- Replace single-column PK with composite (id, environment) so we can have one row per env per feature
ALTER TABLE public.app_features DROP CONSTRAINT IF EXISTS app_features_pkey;
ALTER TABLE public.app_features
  ADD PRIMARY KEY (id, environment);

-- Add rows for local and staging (existing row already has environment = 'production')
INSERT INTO public.app_features (id, environment, name, enabled)
VALUES
  ('ai_agent', 'local', 'AI Assistant', true),
  ('ai_agent', 'staging', 'AI Assistant', true)
ON CONFLICT (id, environment) DO NOTHING;

-- Remove default so new inserts must specify environment
ALTER TABLE public.app_features
  ALTER COLUMN environment DROP DEFAULT;
