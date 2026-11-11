-- Home dashboard metrics cache
-- One row per (user, app) — refreshed by per-app compute functions
-- App values: 'pulse' | 'retirement' | 'property' | 'partnerships'

CREATE TABLE IF NOT EXISTS home_dashboard_metrics (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app        text NOT NULL CHECK (app IN ('pulse', 'retirement', 'property', 'partnerships')),
  setup_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app)
);

ALTER TABLE home_dashboard_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own home dashboard metrics" ON home_dashboard_metrics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_home_dashboard_metrics_user_id ON home_dashboard_metrics(user_id);
