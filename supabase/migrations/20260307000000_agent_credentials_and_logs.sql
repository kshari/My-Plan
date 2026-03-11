-- Agent: user credentials (encrypted API keys / OAuth tokens) and request audit logs

-- ─── User agent credentials (encrypted; one row per user per provider) ───
CREATE TABLE IF NOT EXISTS user_agent_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'gemini')),
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_agent_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent credentials" ON user_agent_credentials
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_agent_credentials_user_id ON user_agent_credentials(user_id);

-- ─── Agent request logs (audit; no response body) ───
CREATE TABLE IF NOT EXISTS agent_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('webllm', 'openai', 'gemini')),
  model text,
  user_prompt text,
  conversation_id text,
  tool_calls_used boolean NOT NULL DEFAULT false,
  actions_requested text[] DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error')) DEFAULT 'success',
  error_message text,
  duration_ms integer,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent logs" ON agent_request_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent logs" ON agent_request_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all agent logs" ON agent_request_logs
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_agent_request_logs_user_id ON agent_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_request_logs_created_at ON agent_request_logs(created_at DESC);
