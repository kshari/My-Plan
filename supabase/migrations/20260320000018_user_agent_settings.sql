-- Per-user AI assistant preferences (provider, cloud provider, etc.)
CREATE TABLE IF NOT EXISTS public.user_agent_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text,
  auto_cloud_provider text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent settings"
  ON public.user_agent_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
