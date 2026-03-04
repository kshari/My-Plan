import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'
  if (isLocal) {
    return new URL(request.url).origin
  }
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${forwardedHost}`
  }
  return new URL(request.url).origin
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const origin = getOrigin(request)

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const cookieNames = allCookies.map(c => c.name)
  const hasCodeVerifier = cookieNames.some(name => name.includes('code-verifier'))

  console.log('[auth/callback] all cookie names:', cookieNames)
  console.log('[auth/callback] code_verifier cookie present:', hasCodeVerifier)
  console.log('[auth/callback] auth code present:', !!code)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[auth/callback] exchangeCodeForSession error:', error?.message ?? 'none')
    console.log('[auth/callback] session obtained:', !!data?.session)

    if (!error) {
      const postExchangeCookies = cookieStore.getAll().map(c => c.name)
      console.log('[auth/callback] cookies after exchange:', postExchangeCookies)
      console.log('[auth/callback] redirecting to:', `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  console.log('[auth/callback] redirecting to auth-code-error')
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
