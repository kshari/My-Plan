-- Add preferred model selection per credential (e.g. which Gemini model to use)

ALTER TABLE user_agent_credentials
  ADD COLUMN IF NOT EXISTS preferred_model text;
