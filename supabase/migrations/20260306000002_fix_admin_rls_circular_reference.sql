-- Fix circular RLS on admins table.
-- The SELECT policy referenced the admins table itself, which PostgreSQL
-- evaluates with the same RLS, creating a recursion that returns no rows.
-- Solution: SECURITY DEFINER functions that bypass RLS for the check.

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

-- Drop the broken self-referencing policies
DROP POLICY IF EXISTS "Admins can view all admins" ON admins;
DROP POLICY IF EXISTS "Super admins can insert admins" ON admins;
DROP POLICY IF EXISTS "Super admins can delete admins" ON admins;

-- Recreate using the SECURITY DEFINER functions
CREATE POLICY "Admins can view all admins" ON admins
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Super admins can insert admins" ON admins
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete admins" ON admins
  FOR DELETE USING (public.is_super_admin());

-- Also fix the feedback policies that reference the admins table
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;

CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Admins can update feedback" ON feedback
  FOR UPDATE USING (public.is_admin());
