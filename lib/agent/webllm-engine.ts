/**
 * WebLLM engine manager — client-only module.
 * Uses dynamic import to avoid bundling @mlc-ai/web-llm on the server.
 */

type MLCEngine = Awaited<ReturnType<typeof import('@mlc-ai/web-llm')>['CreateMLCEngine']> extends Promise<infer T> ? T : never

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

const SYSTEM_PROMPT = `You are a helpful financial assistant for the My Plan app. You help users understand and manage their data across three apps:

1. Financial Pulse – profile (age, income, savings, expenses, debts, subscriptions), pulse checks (net worth snapshots, mood).
2. Retirement Planner – plans (birth_year, life_expectancy, spouse info), accounts (401k, IRA, etc. with balances and contributions), expenses (before/after 65), other income (Social Security, pensions with start/end ages), scenarios.
3. Property Investment – properties (address, type, asking price, income, expenses), financial scenarios.

Rules:
- Answer questions using the exact numbers from the user's data provided below.
- Be concise and specific.
- If you don't know or the data doesn't contain the answer, say so.`

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
