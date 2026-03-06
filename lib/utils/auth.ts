import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side auth guard. Verifies the user is authenticated and returns
 * the Supabase client + user. Redirects to /login if unauthenticated.
 */
export async function requireAuth(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

/**
 * Server-side check: if user IS authenticated, redirect away (for login/signup pages).
 */
export async function redirectIfAuthenticated(destination: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(destination)
}

/**
 * Check if a user is an admin and return their role.
 */
export async function checkAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ isAdmin: boolean; role: string | null }> {
  const { data } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  return { isAdmin: !!data, role: data?.role ?? null }
}

/**
 * Server-side admin guard. Requires authentication + admin role.
 * Redirects to / if the user is not an admin.
 */
export async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: User
  role: string
}> {
  const { supabase, user } = await requireAuth()
  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || !role) redirect('/')
  return { supabase, user, role }
}
