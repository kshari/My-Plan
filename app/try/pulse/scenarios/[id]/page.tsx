'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { LatteFactorScenario } from '@/components/pulse/scenarios/latte-factor'
import { LifestyleCreepScenario } from '@/components/pulse/scenarios/lifestyle-creep'
import { PayYourselfFirstScenario } from '@/components/pulse/scenarios/pay-yourself-first'
import { DebtPayoffScenario } from '@/components/pulse/scenarios/debt-payoff'
import { EmergencyFundScenario } from '@/components/pulse/scenarios/emergency-fund'
import { SubscriptionAuditScenario } from '@/components/pulse/scenarios/subscription-audit'
import { RuleOf72Scenario } from '@/components/pulse/scenarios/rule-of-72'

const SCENARIOS: Record<string, React.ComponentType<{ backHref?: string }>> = {
  'latte-factor': LatteFactorScenario,
  'lifestyle-creep': LifestyleCreepScenario,
  'pay-yourself-first': PayYourselfFirstScenario,
  'debt-payoff': DebtPayoffScenario,
  'emergency-fund': EmergencyFundScenario,
  'subscription-audit': SubscriptionAuditScenario,
  'rule-of-72': RuleOf72Scenario,
}

export default function TryScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const Scenario = SCENARIOS[id]
  if (!Scenario) notFound()
  return <Scenario backHref="/try/pulse" />
}
