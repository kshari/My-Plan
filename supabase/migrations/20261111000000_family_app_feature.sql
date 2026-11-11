-- Register the Family Activities app as an invite-only beta feature in every environment.
INSERT INTO public.app_features (id, environment, name, enabled, release_stage)
VALUES
  ('family_app', 'local', 'Family Activities', true, 'beta'),
  ('family_app', 'staging', 'Family Activities', true, 'beta'),
  ('family_app', 'production', 'Family Activities', true, 'beta')
ON CONFLICT (id, environment) DO NOTHING;
