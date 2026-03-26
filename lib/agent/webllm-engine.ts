/**
 * WebLLM engine manager — client-only module.
 * Uses dynamic import to avoid bundling @mlc-ai/web-llm on the server.
 */

type MLCEngine = Awaited<ReturnType<typeof import('@mlc-ai/web-llm')['CreateMLCEngine']>>

// Use f32 variant for broader GPU/driver compatibility (f16 shaders fail on some systems)
const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f32_1-MLC'

let engineInstance: MLCEngine | null = null
let loadingPromise: Promise<MLCEngine> | null = null

export type WebLLMStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number; text: string }
  | { state: 'ready' }
  | { state: 'error'; error: string }

export function isWebGPUAvailable(): boolean {
  if (typeof navigator === 'undefined') return false
  return 'gpu' in navigator
}

export function getModelId() {
  return MODEL_ID
}

export async function getOrCreateEngine(
  onProgress?: (report: WebLLMStatus) => void
): Promise<MLCEngine> {
  if (engineInstance) return engineInstance

  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    onProgress?.({ state: 'loading', progress: 0, text: 'Initializing WebGPU…' })

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          onProgress?.({
            state: 'loading',
            progress: report.progress,
            text: report.text,
          })
        },
      })
      engineInstance = engine as MLCEngine
      onProgress?.({ state: 'ready' })
      return engine as MLCEngine
    } catch (e) {
      loadingPromise = null
      const msg = e instanceof Error ? e.message : 'Failed to load model'
      onProgress?.({ state: 'error', error: msg })
      throw e
    }
  })()

  return loadingPromise
}

export function isEngineReady(): boolean {
  return engineInstance !== null
}

export function resetEngine() {
  if (engineInstance) {
    (engineInstance as any).unload?.()
    engineInstance = null
    loadingPromise = null
  }
}

const ROUTER_SYSTEM_PROMPT = `You are a routing classifier for a financial planning assistant. Your only job is to classify user messages.

Respond with exactly one word — either "simple" or "complex" — with no punctuation, explanation, or extra text.

simple = greeting, chitchat, single fact lookup ("what is my income?"), definition ("what is a Roth IRA?"), or clarification of the previous reply.
complex = anything requiring calculation, projection, simulation, Monte Carlo, data update/mutation, multi-step analysis, comparison across domains, tax estimate, debt payoff, or retirement readiness.

When in doubt, respond "complex".`

/**
 * Use the loaded WebLLM engine to classify a prompt as 'simple' | 'complex'.
 * Sends a short non-streaming completion — typically resolves in <300 ms once
 * the engine is warm.
 *
 * Returns null if the engine is not ready (caller should fall back to rules).
 */
export async function classifyPromptWithWebLLM(
  message: string,
): Promise<'simple' | 'complex' | null> {
  if (!engineInstance) return null

  try {
    const response = await (engineInstance as any).chat.completions.create({
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      stream: false,
      max_tokens: 3,
      temperature: 0,
    })
    const text = (response.choices?.[0]?.message?.content ?? '').trim().toLowerCase()
    if (text.startsWith('simple')) return 'simple'
    if (text.startsWith('complex')) return 'complex'
    // Unexpected output — fall back
    return null
  } catch {
    return null
  }
} 

const SYSTEM_PROMPT = `You are a helpful financial assistant for the My Plan app. You help users understand and manage their data across two apps:

1. Financial Pulse – profile (age, income, savings, expenses, debts, subscriptions), pulse checks (net worth snapshots, mood).
2. Retirement Planner – plans (birth_year, life_expectancy, spouse info), accounts (401k, IRA, etc. with balances and contributions), expenses (before/after 65), other income (Social Security, pensions with start/end ages), scenarios.

Rules:
- Answer questions using the exact numbers from the user's data provided below.
- Be concise and specific.
- If you don't know or the data doesn't contain the answer, say so.
- You run locally in the browser and cannot perform complex calculations, run simulations, or modify data. For projections, Monte Carlo simulations, tax calculations, or data updates, the app will automatically route your question to a cloud provider.`

export interface WebLLMChatOptions {
  message: string
  context: string
  history: { role: 'user' | 'assistant'; content: string }[]
  onToken?: (token: string) => void
}

export interface WebLLMChatResult {
  reply: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
}

export async function chatWithWebLLM(
  engine: MLCEngine,
  opts: WebLLMChatOptions
): Promise<WebLLMChatResult> {
  const start = Date.now()
  const systemContent = `${SYSTEM_PROMPT}\n\n## User data (use exact numbers in answers)\n\n${opts.context}`

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemContent },
    ...opts.history.slice(-10).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: opts.message },
  ]

  let reply = ''
  const chunks = await (engine as any).chat.completions.create({
    messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 1024,
    temperature: 0.7,
  })

  let inputTokens: number | null = null
  let outputTokens: number | null = null

  for await (const chunk of chunks) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) {
      reply += delta
      opts.onToken?.(delta)
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? null
      outputTokens = chunk.usage.completion_tokens ?? null
    }
  }

  return {
    reply,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - start,
  }
}
