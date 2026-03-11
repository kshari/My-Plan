-- Feature flags for the app. Super admins can enable/disable features;
-- when disabled, the feature is hidden from end users everywhere.

CREATE TABLE IF NOT EXISTS public.app_features (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read feature flags (app needs to know what to show/hide)
CREATE POLICY "Authenticated users can read app_features"
  ON public.app_features FOR SELECT
  TO authenticated
  USING (true);

-- Only super admins can update (toggle) features
CREATE POLICY "Super admins can update app_features"
  ON public.app_features FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Only super admins can insert new feature rows (e.g. when adding new features via migration)
CREATE POLICY "Super admins can insert app_features"
  ON public.app_features FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

-- Seed: AI Agent feature
INSERT INTO public.app_features (id, name, enabled)
VALUES ('ai_agent', 'AI Assistant', true)
ON CONFLICT (id) DO NOTHING;
