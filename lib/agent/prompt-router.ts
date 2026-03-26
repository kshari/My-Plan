/**
 * Client-side prompt router: classifies a user message as 'simple' or 'complex'.
 * 'simple' → handled by WebLLM locally (fact lookup, greetings, definitions).
 * 'complex' → routed to the user's preferred cloud LLM (calculations, projections,
 *              mutations, cross-domain analysis, multi-step reasoning).
 *
 * Primary path: ask the loaded WebLLM engine to classify the prompt (async, ~200–400 ms).
 * Fallback: synchronous rule-based scoring used when the engine is not yet loaded.
 */

import { classifyPromptWithWebLLM } from './webllm-engine'

export type PromptComplexity = 'simple' | 'complex'

// --- Complex signals ---

const CALCULATION_KEYWORDS = [
  'calculate', 'computation', 'compute', 'project', 'projection', 'simulate',
  'simulation', 'monte carlo', 'forecast', 'model', 'estimate',
  'what if', 'what would happen', 'how much will', 'how long until',
  'when can i retire', 'when will i', 'how many years', 'break even',
  'return on investment', 'roi', 'irr', 'npv',
]

const MUTATION_KEYWORDS = [
  'update', 'change', 'set my', 'set the', 'modify', 'edit', 'increase',
  'decrease', 'adjust', 'add a', 'create a', 'delete', 'remove', 'rename',
]

const ANALYSIS_KEYWORDS = [
  'analyze', 'analysis', 'recommend', 'recommendation', 'optimize', 'optimiz',
  'should i', 'is it better', 'better to', 'compare', 'comparison', 'versus',
  ' vs ', 'tradeoff', 'trade-off', 'risk', 'strategy', 'strategies',
  'scenario', 'stress test', 'sensitivity',
]

const CROSS_DOMAIN_TRIGGERS: string[][] = [
  ['retirement', 'retire', '401k', '401(k)', 'ira', 'roth', 'pension', 'social security'],
  ['income', 'expense', 'savings', 'debt', 'net worth', 'budget', 'pulse'],
]

const FINANCIAL_DEPTH_KEYWORDS = [
  'withdrawal', 'contribution', 'rebalance', 'allocation', 'diversif',
  'inflation', 'compound', 'amortize', 'amortization', 'mortgage',
  'interest rate', 'yield', 'dividend', 'capital gain', 'tax bracket',
  'marginal rate', 'deduction', 'rmd', 'required minimum', 'guardrail',
  'safe withdrawal', 'sequence of returns', 'longevity', 'life expectancy',
  'beneficiary', 'estate', 'legacy', 'healthcare cost', 'medicare',
]

// --- Simple signals ---

const GREETING_KEYWORDS = [
  'hello', 'hi ', 'hey ', 'good morning', 'good afternoon', 'good evening',
  'thanks', 'thank you', 'thx', 'bye', 'goodbye', 'see you',
]

const DEFINITION_PATTERNS = [
  /^what (is|are|does) (a |an |the )?/i,
  /^explain (what|how|why)/i,
  /^define /i,
  /^tell me about /i,
]

const SINGLE_FACT_PATTERNS = [
  /^(what('s| is) my )/i,
  /^(how much (is|do i have|in) )/i,
  /^(show me my )/i,
  /^(list my )/i,
]

// Score thresholds
const COMPLEX_SCORE_THRESHOLD = 2

function countGroupsDetected(lower: string, groups: string[][]): number {
  return groups.filter((group) => group.some((kw) => lower.includes(kw))).length
}

/**
 * Classify the user's message as 'simple' or 'complex'.
 *
 * @param message - The raw user message text
 * @param historyLength - Number of prior messages (used by the rule-based fallback)
 * @param useLlm - When true (default), delegates to the WebLLM engine if it is loaded.
 *                 When false, always uses the synchronous rule-based classifier.
 *                 Controlled by the `router_llm_classification` admin feature flag.
 */
export async function classifyPrompt(
  message: string,
  historyLength = 0,
  useLlm = true,
): Promise<PromptComplexity> {
  if (useLlm) {
    const llmResult = await classifyPromptWithWebLLM(message)
    if (llmResult !== null) return llmResult
  }
  return classifyPromptByRules(message, historyLength)
}

/**
 * Synchronous rule-based classifier — used as a fallback when the WebLLM
 * engine is not yet loaded.
 *
 * @param message - The raw user message text
 * @param historyLength - Number of prior messages (longer conversation can tip close calls to complex)
 */
export function classifyPromptByRules(
  message: string,
  historyLength = 0,
): PromptComplexity {
  const lower = message.toLowerCase().trim()
  const len = lower.length

  // --- Hard simple rules (short-circuit immediately) ---

  if (len < 20 && GREETING_KEYWORDS.some((kw) => lower.startsWith(kw) || lower === kw.trim())) {
    return 'simple'
  }

  if (len < 60 && DEFINITION_PATTERNS.some((re) => re.test(lower))) {
    return 'simple'
  }

  // --- Hard complex rules ---

  if (MUTATION_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'complex'
  }

  if (CALCULATION_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'complex'
  }

  // Cross-domain: 2+ financial domains mentioned
  if (countGroupsDetected(lower, CROSS_DOMAIN_TRIGGERS) >= 2) {
    return 'complex'
  }

  // --- Weighted scoring ---

  let score = 0

  // Analysis keywords
  if (ANALYSIS_KEYWORDS.some((kw) => lower.includes(kw))) score += 2

  // Financial depth
  const depthHits = FINANCIAL_DEPTH_KEYWORDS.filter((kw) => lower.includes(kw)).length
  score += depthHits

  // Long message with financial content
  if (len > 150 && depthHits > 0) score += 1

  // Has a question mark but is not a single-fact question → richer query
  const hasQuestion = lower.includes('?')
  const isSingleFact = SINGLE_FACT_PATTERNS.some((re) => re.test(lower))
  if (hasQuestion && !isSingleFact && len > 50) score += 1

  // Ongoing conversation with a longer message → lean complex
  if (historyLength >= 4 && len > 80) score += 1

  if (score >= COMPLEX_SCORE_THRESHOLD) return 'complex'

  // --- Default: simple ---
  return 'simple'
}

/**
 * Returns a short human-readable reason for debugging/logging.
 */
export function explainClassification(message: string): string {
  const lower = message.toLowerCase().trim()

  if (MUTATION_KEYWORDS.some((kw) => lower.includes(kw))) return 'mutation keyword'
  if (CALCULATION_KEYWORDS.some((kw) => lower.includes(kw))) return 'calculation keyword'
  if (countGroupsDetected(lower, CROSS_DOMAIN_TRIGGERS) >= 2) return 'cross-domain'
  if (ANALYSIS_KEYWORDS.some((kw) => lower.includes(kw))) return 'analysis keyword'

  const depthHits = FINANCIAL_DEPTH_KEYWORDS.filter((kw) => lower.includes(kw)).length
  if (depthHits > 0) return `financial depth (${depthHits} terms)`

  return 'default simple'
}
