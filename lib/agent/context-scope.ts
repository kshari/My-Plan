export type DataDomain = 'pulse' | 'retirement' | 'property'

export interface ContextScope {
  domains: DataDomain[]
  focusedPlanId?: number
  focusedPropertyId?: number
  pageDescription: string
}

const RETIREMENT_KEYWORDS = [
  'retirement', 'retire', '401k', '401(k)', 'pension', 'ira', 'roth',
  'social security', 'life expectancy', 'birth year', 'spouse',
  'scenario', 'projection', 'account balance', 'contribution',
  'rmd', 'required minimum', 'annuity',
]

const PROPERTY_KEYWORDS = [
  'property', 'properties', 'rent', 'rental', 'cap rate', 'cocr',
  'cash on cash', 'investment property', 'asking price', 'gross income',
  'operating expense', 'real estate', 'landlord', 'tenant', 'vacancy',
  'noi', 'net operating',
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
  '/apps/property': 'Property Investment app',
  '/apps/property/dashboard': 'Property Investment Dashboard — property list and summaries',
  '/apps/property/profile': 'Property Investment Profile settings',
}

export function mapRouteToScope(pathname: string): ContextScope {
  if (!pathname) {
    return { domains: ['pulse', 'retirement', 'property'], pageDescription: 'the app' }
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

  const propertyMatch = pathname.match(/^\/apps\/property\/properties\/(\d+)/)
  if (propertyMatch) {
    const propId = Number(propertyMatch[1])
    const subPage = pathname.replace(propertyMatch[0], '').replace(/^\//, '') || 'details'
    return {
      domains: ['property'],
      focusedPropertyId: propId,
      pageDescription: `Property #${propId} — ${subPage}`,
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

  if (pathname.startsWith('/apps/property')) {
    return {
      domains: ['property'],
      pageDescription: PAGE_DESCRIPTIONS[pathname] ?? 'Property Investment app',
    }
  }

  return {
    domains: ['pulse', 'retirement', 'property'],
    pageDescription: PAGE_DESCRIPTIONS[pathname] ?? 'the home page',
  }
}

export function detectPromptIntent(message: string): DataDomain[] {
  const lower = message.toLowerCase()
  const detected: Set<DataDomain> = new Set()

  for (const kw of RETIREMENT_KEYWORDS) {
    if (lower.includes(kw)) { detected.add('retirement'); break }
  }
  for (const kw of PROPERTY_KEYWORDS) {
    if (lower.includes(kw)) { detected.add('property'); break }
  }
  for (const kw of PULSE_KEYWORDS) {
    if (lower.includes(kw)) { detected.add('pulse'); break }
  }

  if (lower.includes('everything') || lower.includes('all my data') || lower.includes('overview') || lower.includes('summary')) {
    detected.add('pulse')
    detected.add('retirement')
    detected.add('property')
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
