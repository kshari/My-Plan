-- Allow Gemini (API Key) as a separate provider for user_agent_credentials and agent_request_logs

ALTER TABLE user_agent_credentials
  DROP CONSTRAINT IF EXISTS user_agent_credentials_provider_check;

ALTER TABLE user_agent_credentials
  ADD CONSTRAINT user_agent_credentials_provider_check
  CHECK (provider IN ('openai', 'gemini', 'gemini-api-key'));

ALTER TABLE agent_request_logs
  DROP CONSTRAINT IF EXISTS agent_request_logs_provider_check;

ALTER TABLE agent_request_logs
  ADD CONSTRAINT agent_request_logs_provider_check
  CHECK (provider IN ('webllm', 'openai', 'gemini', 'gemini-api-key'));
