-- Beta release feature: add release_stage to app_features and create beta_access table.

-- release_stage: 'ga' (generally available — everyone), 'beta' (invite-only)
ALTER TABLE public.app_features
  ADD COLUMN IF NOT EXISTS release_stage text NOT NULL DEFAULT 'ga';

ALTER TABLE public.app_features
  DROP CONSTRAINT IF EXISTS app_features_release_stage_check;
ALTER TABLE public.app_features
  ADD CONSTRAINT app_features_release_stage_check
  CHECK (release_stage IN ('ga', 'beta'));

-- Per-user beta access grants
CREATE TABLE IF NOT EXISTS public.beta_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id text NOT NULL,
  environment text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'revoked')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  FOREIGN KEY (feature_id, environment) REFERENCES app_features(id, environment) ON DELETE CASCADE,
  UNIQUE (feature_id, environment, user_id)
);

ALTER TABLE public.beta_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own beta_access rows
CREATE POLICY "Users read own beta_access"
  ON public.beta_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own rows (to accept invitations)
CREATE POLICY "Users accept own beta_access"
  ON public.beta_access FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all rows
CREATE POLICY "Admins read all beta_access"
  ON public.beta_access FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Super admins can insert (invite) and update (revoke)
CREATE POLICY "Super admins manage beta_access"
  ON public.beta_access FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins update beta_access"
  ON public.beta_access FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins delete beta_access"
  ON public.beta_access FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
