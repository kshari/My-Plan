'use client'

import { useMemo } from 'react'
import type { DemographicProfile, PulseCheck } from '@/lib/demographics'
import type { ResilienceBreakdown } from '@/lib/utils/pulse-calculations'
import { parseLocalDate } from '@/lib/utils/formatting'

export interface EducationalTrigger {
  id: string
  severity: 'info' | 'warning' | 'success'
  title: string
  description: string
  scenarioLink?: string
  profileLink?: boolean
  pulseCheckLink?: boolean
}

export function useEducationalTriggers(
  profile: DemographicProfile | null,
  score: ResilienceBreakdown | null,
  lastPulseCheck: PulseCheck | null,
): EducationalTrigger[] {
  return useMemo(() => {
    if (!profile || !score) return []
    const triggers: EducationalTrigger[] = []

    const monthlyGross = profile.annual_gross_income / 12
    const emergencyMonths = profile.monthly_expenses > 0
      ? profile.emergency_fund / profile.monthly_expenses
      : 0
    const savingsRatePct = monthlyGross > 0
      ? (profile.monthly_savings / monthlyGross) * 100
      : 0

    const profileCompleteness = computeCompleteness(profile)
    if (profileCompleteness < 50) {
      triggers.push({
        id: 'profile-incomplete',
        severity: 'info',
        title: 'Complete your profile for sharper insights',
        description: `Your profile is ${profileCompleteness}% complete. The more you share, the more personalized your benchmarks become.`,
        profileLink: true,
      })
    }

    if (emergencyMonths < 3 && profile.monthly_expenses > 0) {
      triggers.push({
        id: 'low-emergency-fund',
        severity: 'warning',
        title: 'Build your safety net',
        description: `You have ${emergencyMonths.toFixed(1)} months of expenses saved. Most experts recommend 3-6 months. See how fast you can get there.`,
        scenarioLink: 'emergency-fund',
      })
    }

    if (savingsRatePct < 10 && monthlyGross > 0) {
      triggers.push({
        id: 'low-savings-rate',
        severity: 'warning',
        title: 'Small savings rate bumps have outsized effects',
        description: `You\'re saving ${savingsRatePct.toFixed(0)}% of income. Even a 5% increase can dramatically change your trajectory.`,
        scenarioLink: 'pay-yourself-first',
      })
    }

    if (profile.debts.length === 0 && profile.emergency_fund > 0) {
      triggers.push({
        id: 'debt-free',
        severity: 'success',
        title: 'Debt-free! Curious what your daily coffee money could become?',
        description: 'You have no debts listed. See how small daily amounts compound over decades.',
        scenarioLink: 'latte-factor',
      })
    }

    if (savingsRatePct > 20 && monthlyGross > 0) {
      triggers.push({
        id: 'high-savings',
        severity: 'success',
        title: 'You\'re saving more than 80% of Americans',
        description: `At ${savingsRatePct.toFixed(0)}% savings rate, you're well ahead. Keep it up!`,
      })
    }

    if (lastPulseCheck) {
      const daysSince = Math.floor(
        (Date.now() - parseLocalDate(lastPulseCheck.check_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSince >= 30) {
        triggers.push({
          id: 'pulse-check-due',
          severity: 'info',
          title: 'Time for your monthly Pulse Check',
          description: `It's been ${daysSince} days since your last check-in. Take 2 minutes to reflect.`,
          pulseCheckLink: true,
        })
      }
    } else {
      triggers.push({
        id: 'first-pulse-check',
        severity: 'info',
        title: 'Take your first Pulse Check',
        description: 'A 2-minute monthly reflection to track your financial progress and mindset.',
        pulseCheckLink: true,
      })
    }

    return triggers.slice(0, 3)
  }, [profile, score, lastPulseCheck])
}

function computeCompleteness(p: DemographicProfile): number {
  let filled = 0
  let total = 8
  if (p.age > 0) filled++
  if (p.state) filled++
  if (p.annual_gross_income > 0) filled++
  if (p.monthly_expenses > 0) filled++
  if (p.monthly_savings > 0) filled++
  if (p.total_retirement_savings > 0 || p.emergency_fund > 0 || p.stock_investments > 0 || p.real_estate_investments > 0) filled++
  if (p.home_value !== null || p.debts.length > 0) filled++
  if (p.household_type !== 'single' || p.household_size > 1) filled++
  return Math.round((filled / total) * 100)
}
