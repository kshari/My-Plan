-- ─── Admin roles ───
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers to avoid circular RLS (admins table referencing itself)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE POLICY "Admins can view all admins" ON admins
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Super admins can insert admins" ON admins
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete admins" ON admins
  FOR DELETE USING (public.is_super_admin());

-- Seed the default super admin (lookup user by email)
INSERT INTO admins (user_id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email = 'kshari@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

-- ─── User feedback ───
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  type text NOT NULL DEFAULT 'feedback' CHECK (type IN ('feedback', 'bug', 'feature_request')),
  message text NOT NULL,
  page_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback; admins can view all
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- Admins can update any feedback (status, notes)
CREATE POLICY "Admins can update feedback" ON feedback
  FOR UPDATE USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);

-- ─── RPC to lookup user id by email (for adding admins) ───
-- Only callable by super_admins via RLS on the admins table check
CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;
