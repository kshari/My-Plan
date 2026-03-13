-- Add router classification mode feature flag.
-- enabled = true  → LLM-based classification (default, smarter)
-- enabled = false → Rule-based classification (deterministic, zero latency)

INSERT INTO public.app_features (id, environment, name, enabled)
VALUES
  ('router_llm_classification', 'local',      'AI Router: LLM Classification', true),
  ('router_llm_classification', 'staging',    'AI Router: LLM Classification', true),
  ('router_llm_classification', 'production', 'AI Router: LLM Classification', true)
ON CONFLICT (id, environment) DO NOTHING;
