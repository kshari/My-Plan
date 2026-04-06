-- SECURITY FIX: Restrict get_user_id_by_email to admins only.
-- Previously any authenticated user could resolve any email address to a UUID.
-- The rewritten function returns NULL if the caller is not an admin.

CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE WHEN public.is_admin()
    THEN (SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1)
    ELSE NULL
  END;
$$;
