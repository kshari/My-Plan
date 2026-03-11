-- Agent logs: store prompt sent to model (for audit)

ALTER TABLE agent_request_logs
  ADD COLUMN IF NOT EXISTS prompt_sent text;

COMMENT ON COLUMN agent_request_logs.prompt_sent IS 'Truncated prompt (system + conversation + user message) sent to the model';
