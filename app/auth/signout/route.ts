import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  const hdrs = new Headers(request.headers)
  const forwardedHost = hdrs.get('x-forwarded-host')
  const host = forwardedHost || hdrs.get('host') || ''
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', getOrigin(request)))
}
