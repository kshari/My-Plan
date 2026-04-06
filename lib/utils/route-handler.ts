import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

/**
 * Safely parses the JSON request body. Returns null on malformed JSON so
 * callers can return a 400 without leaking a 500 SyntaxError to clients.
 */
export async function safeJson<T = Record<string, unknown>>(
  request: Request
): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

type AuthenticatedHandler = (
  request: Request,
  context: {
    user: User
    supabase: Awaited<ReturnType<typeof createClient>>
    params: Record<string, string>
  }
) => Promise<NextResponse>

/**
 * Wraps an API route handler with auth check, param parsing, and error handling.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request, { params }: { params: Promise<Record<string, string>> }) => {
    try {
      const resolvedParams = await params
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return await handler(request, { user, supabase, params: resolvedParams })
    } catch (error: any) {
      console.error(`Route error:`, error?.message)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Verify that a record belongs to the current user.
 * Returns the record if found, or a 404 NextResponse.
 */
export async function verifyOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  id: number,
  userId: string
): Promise<{ data: any } | NextResponse> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
  }
  return { data }
}
