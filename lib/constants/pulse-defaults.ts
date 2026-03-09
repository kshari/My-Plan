export const REFLECTION_QUESTIONS = [
  'What was your biggest financial win this month?',
  'Did you spend money on something you regret?',
  'What\'s one money habit you want to build next month?',
  'Did anything surprise you about your spending this month?',
  'What financial goal are you most excited about right now?',
  'If you could undo one purchase this month, what would it be?',
  'What\'s one thing you learned about money recently?',
  'How confident do you feel about your financial future today?',
  'What\'s the smartest money move you made this month?',
  'Is there a subscription or expense you should cancel?',
  'What would you do with an extra $500 this month?',
  'Are you saving for something specific right now? How\'s it going?',
]

export const MOOD_LABELS: Record<number, string> = {
  1: 'Stressed',
  2: 'Worried',
  3: 'Neutral',
  4: 'Good',
  5: 'Great',
}

export const MOOD_EMOJIS: Record<number, string> = {
  1: '😰',
  2: '😟',
  3: '😐',
  4: '😊',
  5: '🤩',
}

export const SCORE_LABELS = [
  { min: 0, max: 30, label: 'Building your foundation', color: 'text-red-500' },
  { min: 31, max: 55, label: 'Making progress', color: 'text-amber-500' },
  { min: 56, max: 75, label: 'On solid ground', color: 'text-blue-500' },
  { min: 76, max: 100, label: 'Thriving', color: 'text-emerald-500' },
] as const

export const SCENARIO_METADATA = [
  { id: 'latte-factor', name: 'The Latte Factor', description: 'See how small daily spending compounds into a fortune over time.', icon: 'Coffee' as const },
  { id: 'lifestyle-creep', name: 'Lifestyle Creep Calculator', description: 'What happens when your spending rises with your income?', icon: 'TrendingUp' as const },
  { id: 'pay-yourself-first', name: 'Pay Yourself First', description: 'How your savings rate shapes your financial future.', icon: 'PiggyBank' as const },
  { id: 'debt-payoff', name: 'Debt Payoff Showdown', description: 'Avalanche vs. Snowball — which strategy wins for you?', icon: 'Sword' as const },
  { id: 'emergency-fund', name: 'Emergency Fund Runway', description: 'How fast can you build your safety net?', icon: 'ShieldCheck' as const },
  { id: 'subscription-audit', name: 'Subscription Audit', description: 'The hidden cost of your monthly subscriptions.', icon: 'CreditCard' as const },
  { id: 'rule-of-72', name: 'The Rule of 72', description: 'The simplest way to understand compound growth.', icon: 'Calculator' as const },
] as const

export type ScenarioId = typeof SCENARIO_METADATA[number]['id']
