-- Financial Pulse tables
-- Prefix: fp_

-- ─── User financial profile (one per user, shared demographics) ───
CREATE TABLE IF NOT EXISTS fp_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age integer NOT NULL DEFAULT 35,
  state text,
  household_type text NOT NULL DEFAULT 'single',
  household_size integer NOT NULL DEFAULT 1,
  annual_gross_income numeric NOT NULL DEFAULT 0,
  filing_status text NOT NULL DEFAULT 'single',
  total_retirement_savings numeric NOT NULL DEFAULT 0,
  total_non_retirement_savings numeric NOT NULL DEFAULT 0,
  monthly_expenses numeric NOT NULL DEFAULT 0,
  monthly_savings numeric NOT NULL DEFAULT 0,
  home_value numeric,
  mortgage_balance numeric,
  debts jsonb DEFAULT '[]'::jsonb,
  college_529_balance numeric,
  child_ages integer[] DEFAULT '{}',
  subscriptions jsonb DEFAULT '[]'::jsonb,
  explored_scenarios text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE fp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile" ON fp_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Monthly pulse check reflections ───
CREATE TABLE IF NOT EXISTS fp_pulse_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  net_worth_snapshot numeric NOT NULL DEFAULT 0,
  reflection_question text NOT NULL,
  reflection_answer text,
  mood integer NOT NULL DEFAULT 3 CHECK (mood BETWEEN 1 AND 5),
  resilience_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fp_pulse_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pulse checks" ON fp_pulse_checks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Static benchmark reference data (read-only for users) ───
CREATE TABLE IF NOT EXISTS fp_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  age_min integer NOT NULL,
  age_max integer NOT NULL,
  household_type text NOT NULL DEFAULT 'all',
  region text,
  percentile_25 numeric NOT NULL,
  percentile_50 numeric NOT NULL,
  percentile_75 numeric NOT NULL,
  percentile_90 numeric NOT NULL,
  source text NOT NULL,
  year integer NOT NULL
);

ALTER TABLE fp_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmarks" ON fp_benchmarks
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Optional: saved What-If scenario snapshots ───
CREATE TABLE IF NOT EXISTS fp_saved_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_type text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fp_saved_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved scenarios" ON fp_saved_scenarios
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_fp_profiles_user_id ON fp_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_pulse_checks_user_id ON fp_pulse_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_pulse_checks_date ON fp_pulse_checks(user_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_fp_benchmarks_metric ON fp_benchmarks(metric, age_min, age_max);
CREATE INDEX IF NOT EXISTS idx_fp_saved_scenarios_user_id ON fp_saved_scenarios(user_id);
