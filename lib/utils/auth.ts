import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

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
