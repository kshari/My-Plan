-- Shareable beta invite links — specific to a feature, not a user.
-- Any authenticated user who visits the link gets beta access immediately.

CREATE TABLE IF NOT EXISTS public.beta_invite_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  feature_id  text        NOT NULL,
  environment text        NOT NULL,
  label       text,                        -- optional name, e.g. "Twitter campaign"
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,                 -- null = never expires
  max_uses    integer,                     -- null = unlimited
  use_count   integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  FOREIGN KEY (feature_id, environment)
    REFERENCES public.app_features(id, environment) ON DELETE CASCADE,
  CONSTRAINT beta_invite_links_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0)
);

ALTER TABLE public.beta_invite_links ENABLE ROW LEVEL SECURITY;

-- Admins can read all links
CREATE POLICY "Admins read beta_invite_links"
  ON public.beta_invite_links FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Super admins can create and manage links
CREATE POLICY "Super admins insert beta_invite_links"
  ON public.beta_invite_links FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins update beta_invite_links"
  ON public.beta_invite_links FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins delete beta_invite_links"
  ON public.beta_invite_links FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
