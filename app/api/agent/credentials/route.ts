import { withAuth } from '@/lib/utils/route-handler'
import { encryptAgentCredential } from '@/lib/agent/encryption'
import { NextResponse } from 'next/server'

const PROVIDERS = ['openai', 'gemini', 'gemini-api-key', 'claude'] as const

export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data, error } = await supabase
    .from('user_agent_credentials')
    .select('provider, created_at, updated_at, preferred_model')
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    providers: (data ?? []).map((r) => ({
      provider: r.provider,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      preferredModel: r.preferred_model ?? undefined,
    })),
  })
})

export const POST = withAuth(async (request, { user, supabase }) => {
  let body: { provider?: string; apiKey?: string; preferredModel?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const provider = body.provider === 'openai' ? 'openai' : body.provider === 'gemini-api-key' ? 'gemini-api-key' : body.provider === 'gemini' ? 'gemini' : body.provider === 'claude' ? 'claude' : null
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const preferredModel = typeof body.preferredModel === 'string' ? body.preferredModel.trim() || null : null

  if (provider === 'gemini' && apiKey) {
    return NextResponse.json(
      { error: 'Gemini (OAuth) uses Google sign-in. Use "Connect with Google" or add Gemini (API Key) instead.' },
      { status: 400 }
    )
  }

  if (provider === 'gemini') {
    if (preferredModel === null) {
      return NextResponse.json({ error: 'preferredModel required to update Gemini (OAuth) model' }, { status: 400 })
    }
    const { data: row } = await supabase
      .from('user_agent_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'gemini')
      .maybeSingle()
    if (!row) {
      return NextResponse.json({ error: 'Connect with Google first, then you can set the model.' }, { status: 400 })
    }
    const { error } = await supabase
      .from('user_agent_credentials')
      .update({ preferred_model: preferredModel, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'gemini')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, provider: 'gemini' })
  }

  if (provider === 'openai' || provider === 'gemini-api-key' || provider === 'claude') {
    if (!apiKey && preferredModel === null) {
      return NextResponse.json({ error: 'provider and apiKey are required, or preferredModel to update model only' }, { status: 400 })
    }

    if (apiKey) {
      let encrypted: string
      try {
        encrypted = encryptAgentCredential(apiKey)
      } catch {
        return NextResponse.json(
          { error: 'Encryption not configured. Set AGENT_CREDENTIALS_ENCRYPTION_KEY.' },
          { status: 503 }
        )
      }
      const now = new Date().toISOString()
      const { error } = await supabase.from('user_agent_credentials').upsert(
        {
          user_id: user.id,
          provider,
          encrypted_value: encrypted,
          preferred_model: preferredModel ?? undefined,
          updated_at: now,
        },
        { onConflict: 'user_id,provider' }
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, provider })
    }

    if (preferredModel !== null) {
      const { data: row } = await supabase
        .from('user_agent_credentials')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .maybeSingle()
      if (!row) {
        return NextResponse.json({ error: 'Save your API key first, then you can set the model.' }, { status: 400 })
      }
      const { error } = await supabase
        .from('user_agent_credentials')
        .update({ preferred_model: preferredModel, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('provider', provider)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, provider })
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
})

export const DELETE = withAuth(async (request, { user, supabase }) => {
  const url = new URL(request.url)
  const provider = url.searchParams.get('provider')
  if (!provider || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return NextResponse.json({ error: 'Valid provider query required' }, { status: 400 })
  }
  const { error } = await supabase
    .from('user_agent_credentials')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
