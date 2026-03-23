import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Server-side admin client that uses the service role key.
 * Bypasses RLS — only use in trusted server-side API routes.
 * Never expose this client or the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    )
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
