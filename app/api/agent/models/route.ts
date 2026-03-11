import { withAuth } from '@/lib/utils/route-handler'
import { getDecryptedCredential, getGeminiAccessToken } from '@/lib/agent/credentials'
import { NextResponse } from 'next/server'

/**
 * GET /api/agent/models?provider=gemini|gemini-api-key
 * Returns list of models for the given Gemini provider using the user's stored credential.
 */
export const GET = withAuth(async (request, { user, supabase }) => {
  const url = new URL(request.url)
  const provider = url.searchParams.get('provider')
  if (provider !== 'gemini' && provider !== 'gemini-api-key') {
    return NextResponse.json({ error: 'provider must be gemini or gemini-api-key' }, { status: 400 })
  }

  let authHeader: string
  let modelsUrl: string

  if (provider === 'gemini-api-key') {
    const apiKey = await getDecryptedCredential(supabase, user.id, 'gemini-api-key')
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No Gemini API key saved. Save your API key first to load models.' },
        { status: 400 }
      )
    }
    modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    authHeader = ''
  } else {
    const token = await getGeminiAccessToken(supabase, user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Google account not connected. Connect with Google first to load models.' },
        { status: 400 }
      )
    }
    modelsUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
    authHeader = `Bearer ${token}`
  }

  const headers: Record<string, string> = {}
  if (authHeader) headers.Authorization = authHeader
  if (provider === 'gemini') {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
    const projectNumber = clientId.includes('-') ? clientId.split('-')[0] : ''
    if (projectNumber) headers['x-goog-user-project'] = projectNumber
  }

  const res = await fetch(modelsUrl, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return NextResponse.json(
      { error: err.error?.message ?? `Failed to list models (${res.status})` },
      { status: res.status >= 400 ? res.status : 500 }
    )
  }

  const data = (await res.json()) as {
    models?: { name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }[]
  }
  const models = data.models ?? []
  const generateContent = models.filter(
    (m) => m.supportedGenerationMethods?.includes('generateContent')
  )
  const list = generateContent.map((m) => {
    const name = m.name ?? ''
    const id = name.startsWith('models/') ? name.slice(7) : name
    return {
      id,
      displayName: m.displayName ?? id,
      description: m.description ?? undefined,
    }
  })

  return NextResponse.json({ models: list })
})
