export type DataDomain = 'pulse' | 'retirement'

export interface ContextScope {
  domains: DataDomain[]
  focusedPlanId?: number
  pageDescription: string
}

const RETIREMENT_KEYWORDS = [
  'retirement', 'retire', '401k', '401(k)', 'pension', 'ira', 'roth',
  'social security', 'life expectancy', 'birth year', 'spouse',
  'scenario', 'projection', 'account balance', 'contribution',
  'rmd', 'required minimum', 'annuity',
]

const PULSE_KEYWORDS = [
  'income', 'expense', 'debt', 'savings', 'net worth', 'pulse',
  'subscription', 'budget', 'monthly', 'resilience', 'mood',
  'financial health', 'profile', 'home value', 'mortgage', '529',
  'filing status', 'household',
]

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/apps/pulse': 'Financial Pulse app',
  '/apps/pulse/dashboard': 'Financial Pulse Dashboard — net worth, resilience score, pulse check history',
  '/apps/pulse/profile': 'Financial Pulse Profile — income, savings, debts, subscriptions',
  '/apps/pulse/pulse-check': 'Financial Pulse Check — monthly mood and net worth snapshot',
  '/apps/pulse/scenarios': 'Financial Pulse Scenarios — what-if calculators',
  '/apps/retirement': 'Retirement Planner app',
  '/apps/retirement/dashboard': 'Retirement Planner Dashboard — plans list, metrics, projections',
  '/apps/retirement/structure': 'Retirement Plan Structure overview',
  '/apps/retirement/profile': 'Retirement Planner Profile settings',
}

export function mapRouteToScope(pathname: string): ContextScope {
  if (!pathname) {
    return { domains: ['pulse', 'retirement'], pageDescription: 'the app' }
  }

  const planMatch = pathname.match(/^\/apps\/retirement\/plans\/(\d+)/)
  if (planMatch) {
    const planId = Number(planMatch[1])
    const subPage = pathname.replace(planMatch[0], '').replace(/^\//, '') || 'overview'
    return {
      domains: ['retirement'],
      focusedPlanId: planId,
      pageDescription: `Retirement Plan #${planId} — ${subPage}`,
    }
  }

  if (pathname.startsWith('/apps/pulse/scenarios/')) {
    const scenarioSlug = pathname.split('/').pop() ?? 'calculator'
    return {
      domains: ['pulse'],
      pageDescription: `Financial Pulse Scenario — ${scenarioSlug.replace(/-/g, ' ')}`,
    }
  }

  if (pathname.startsWith('/apps/pulse')) {
    return {
      domains: ['pulse'],
      pageDescription: PAGE_DESCRIPTIONS[pathname] ?? 'Financial Pulse app',
    }
  }

  if (pathname.startsWith('/apps/retirement')) {
    return {
      domains: ['retirement'],
      pageDescription: PAGE_DESCRIPTIONS[pathname] ?? 'Retirement Planner app',
    }
  }

  return {
    domains: ['pulse', 'retirement'],
    pageDescription: PAGE_DESCRIPTIONS[pathname] ?? 'the home page',
  }
}

export function detectPromptIntent(message: string): DataDomain[] {
  const lower = message.toLowerCase()
  const detected: Set<DataDomain> = new Set()

  for (const kw of RETIREMENT_KEYWORDS) {
    if (lower.includes(kw)) { detected.add('retirement'); break }
  }
  for (const kw of PULSE_KEYWORDS) {
    if (lower.includes(kw)) { detected.add('pulse'); break }
  }

  if (lower.includes('everything') || lower.includes('all my data') || lower.includes('overview') || lower.includes('summary')) {
    detected.add('pulse')
    detected.add('retirement')
  }

  return [...detected]
}

export function resolveContextScope(pathname: string, message: string): ContextScope {
  const pageScope = mapRouteToScope(pathname)
  const intentDomains = detectPromptIntent(message)

  const mergedDomains = new Set<DataDomain>(pageScope.domains)
  for (const d of intentDomains) {
    mergedDomains.add(d)
  }

  return {
    ...pageScope,
    domains: [...mergedDomains],
  }
}
