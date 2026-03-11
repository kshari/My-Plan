# Agent feature: Supabase migration

The migration adds tables for the Assistant (AI agent) feature:

- **user_agent_credentials** – encrypted API keys / tokens per user and provider (openai, gemini)
- **agent_request_logs** – audit log of each agent request (prompt, provider, status, duration; no response body)

## Option 1: Supabase CLI (recommended)

1. Link your project (one time):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   Get the project ref from the Supabase dashboard URL or project settings.

2. Push migrations:
   ```bash
   npm run db:push
   ```
   Or:
   ```bash
   npx supabase db push
   ```

## Option 2: Run SQL in Dashboard

If you prefer not to use the CLI:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. New query → paste the contents of `supabase/migrations/20260307000000_agent_credentials_and_logs.sql`.
3. Run the query.

The migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), so it is safe to run once.
