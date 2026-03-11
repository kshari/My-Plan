-- Agent logs: extra audit fields (context preview, result summary, decisions) and admin delete

ALTER TABLE agent_request_logs
  ADD COLUMN IF NOT EXISTS context_preview text,
  ADD COLUMN IF NOT EXISTS result_summary text,
  ADD COLUMN IF NOT EXISTS decisions text;

COMMENT ON COLUMN agent_request_logs.context_preview IS 'Truncated context sent to the model (for audit)';
COMMENT ON COLUMN agent_request_logs.result_summary IS 'High-level API result (reply length, pending actions, or error)';
COMMENT ON COLUMN agent_request_logs.decisions IS 'App decisions before/after API call (provider, model, auth, outcome)';

-- Allow admins to delete log entries (single or bulk via API)
CREATE POLICY "Admins can delete agent logs" ON agent_request_logs
  FOR DELETE USING (public.is_admin());
