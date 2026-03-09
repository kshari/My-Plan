'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronUp, Plus, X, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DemographicProfile, Debt, Subscription, HouseholdType, FilingStatus } from '@/lib/demographics'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const SUB_CATEGORIES = ['entertainment', 'productivity', 'health', 'news', 'cloud', 'other'] as const

interface ProfileFormProps {
  profile: DemographicProfile
  onChange: (profile: DemographicProfile) => void
}

export function ProfileForm({ profile, onChange }: ProfileFormProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['basics', 'income']))

  const toggle = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  const update = useCallback(
    <K extends keyof DemographicProfile>(key: K, value: DemographicProfile[K]) => {
      onChange({ ...profile, [key]: value })
    },
    [profile, onChange],
  )

  const completeness = computeCompleteness(profile)

  return (
    <div className="space-y-4">
      {/* Progress ring */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="relative h-12 w-12 shrink-0">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeDasharray={`${completeness} ${100 - completeness}`}
              strokeLinecap="round"
              className="text-orange-500 transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{completeness}%</span>
        </div>
        <div>
          <p className="text-sm font-semibold">Profile {completeness}% complete</p>
          <p className="text-xs text-muted-foreground">The more you share, the sharper your insights.</p>
        </div>
      </div>

      {/* Basics */}
      <Section title="Basics" id="basics" open={openSections.has('basics')} onToggle={toggle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Age">
            <Input type="number" min={16} max={100} value={profile.age || ''} onChange={(e) => update('age', Number(e.target.value))} />
          </Field>
          <Field label="State">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={profile.state}
              onChange={(e) => update('state', e.target.value)}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Household type">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={profile.household_type}
              onChange={(e) => update('household_type', e.target.value as HouseholdType)}
            >
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="married_with_children">Married with Children</option>
            </select>
          </Field>
          <Field label="Household size">
            <Input type="number" min={1} max={12} value={profile.household_size || ''} onChange={(e) => update('household_size', Number(e.target.value))} />
          </Field>
        </div>
      </Section>

      {/* Income */}
      <Section title="Income" id="income" open={openSections.has('income')} onToggle={toggle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Annual gross income">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input className="pl-7" type="number" min={0} value={profile.annual_gross_income || ''} onChange={(e) => update('annual_gross_income', Number(e.target.value))} />
            </div>
          </Field>
          <Field label="Filing status">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={profile.filing_status}
              onChange={(e) => update('filing_status', e.target.value as FilingStatus)}
            >
              <option value="single">Single</option>
              <option value="married_filing_jointly">Married Filing Jointly</option>
              <option value="married_filing_separately">Married Filing Separately</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Savings & Investments */}
      <Section title="Savings & Investments" id="savings" open={openSections.has('savings')} onToggle={toggle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total retirement savings (401k, IRA, etc.)">
            <CurrencyInput value={profile.total_retirement_savings} onChange={(v) => update('total_retirement_savings', v)} />
          </Field>
          <Field label="Emergency fund (cash savings)">
            <CurrencyInput value={profile.emergency_fund} onChange={(v) => update('emergency_fund', v)} />
          </Field>
          <Field label="Stock / brokerage investments">
            <CurrencyInput value={profile.stock_investments} onChange={(v) => update('stock_investments', v)} />
          </Field>
          <Field label="Real estate investments (non-primary)">
            <CurrencyInput value={profile.real_estate_investments} onChange={(v) => update('real_estate_investments', v)} />
          </Field>
          <Field label="Monthly expenses">
            <CurrencyInput value={profile.monthly_expenses} onChange={(v) => update('monthly_expenses', v)} />
          </Field>
          <Field label="Monthly savings">
            <CurrencyInput value={profile.monthly_savings} onChange={(v) => update('monthly_savings', v)} />
          </Field>
        </div>
      </Section>

      {/* Home */}
      <Section title="Home (optional)" id="home" open={openSections.has('home')} onToggle={toggle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home value">
            <CurrencyInput value={profile.home_value ?? 0} onChange={(v) => update('home_value', v || null)} />
          </Field>
          <Field label="Mortgage balance">
            <CurrencyInput value={profile.mortgage_balance ?? 0} onChange={(v) => update('mortgage_balance', v || null)} />
          </Field>
        </div>
      </Section>

      {/* Debts */}
      <Section title="Debts (optional)" id="debts" open={openSections.has('debts')} onToggle={toggle}>
        {profile.debts.map((debt, i) => (
          <div key={i} className="flex items-end gap-2 mb-3">
            <Field label={i === 0 ? 'Name' : undefined} className="flex-1">
              <Input value={debt.name} onChange={(e) => updateDebt(i, 'name', e.target.value)} placeholder="Credit card" />
            </Field>
            <Field label={i === 0 ? 'Balance' : undefined} className="w-28">
              <CurrencyInput value={debt.balance} onChange={(v) => updateDebt(i, 'balance', v)} />
            </Field>
            <Field label={i === 0 ? 'APR %' : undefined} className="w-20">
              <Input type="number" step={0.1} value={debt.rate || ''} onChange={(e) => updateDebt(i, 'rate', Number(e.target.value))} />
            </Field>
            <Field label={i === 0 ? 'Min pmt' : undefined} className="w-24">
              <CurrencyInput value={debt.min_payment} onChange={(v) => updateDebt(i, 'min_payment', v)} />
            </Field>
            <Button variant="ghost" size="icon" className="shrink-0 mb-0.5" onClick={() => removeDebt(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addDebt}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add debt
        </Button>
      </Section>

      {/* Family */}
      <Section title="Family (optional)" id="family" open={openSections.has('family')} onToggle={toggle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="529 college savings balance">
            <CurrencyInput value={profile.college_529_balance ?? 0} onChange={(v) => update('college_529_balance', v || null)} />
          </Field>
          <Field label="Children's ages (comma-separated)">
            <Input
              value={profile.child_ages.join(', ')}
              onChange={(e) => update('child_ages', e.target.value.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)))}
              placeholder="e.g. 5, 10, 15"
            />
          </Field>
        </div>
      </Section>

      {/* Subscriptions */}
      <Section title="Subscriptions (optional)" id="subscriptions" open={openSections.has('subscriptions')} onToggle={toggle}>
        {profile.subscriptions.map((sub, i) => (
          <div key={i} className="flex items-end gap-2 mb-3">
            <Field label={i === 0 ? 'Name' : undefined} className="flex-1">
              <Input value={sub.name} onChange={(e) => updateSub(i, 'name', e.target.value)} placeholder="Netflix" />
            </Field>
            <Field label={i === 0 ? '$/month' : undefined} className="w-24">
              <CurrencyInput value={sub.monthly_cost} onChange={(v) => updateSub(i, 'monthly_cost', v)} />
            </Field>
            <Field label={i === 0 ? 'Category' : undefined} className="w-32">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sub.category}
                onChange={(e) => updateSub(i, 'category', e.target.value)}
              >
                {SUB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Button variant="ghost" size="icon" className="shrink-0 mb-0.5" onClick={() => removeSub(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSub}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add subscription
        </Button>
      </Section>
    </div>
  )

  function addDebt() {
    update('debts', [...profile.debts, { name: '', balance: 0, rate: 0, min_payment: 0 }])
  }
  function removeDebt(i: number) {
    update('debts', profile.debts.filter((_, idx) => idx !== i))
  }
  function updateDebt(i: number, key: keyof Debt, value: any) {
    const next = [...profile.debts]
    next[i] = { ...next[i], [key]: value }
    update('debts', next)
  }
  function addSub() {
    update('subscriptions', [...profile.subscriptions, { name: '', monthly_cost: 0, category: 'other' }])
  }
  function removeSub(i: number) {
    update('subscriptions', profile.subscriptions.filter((_, idx) => idx !== i))
  }
  function updateSub(i: number, key: keyof Subscription, value: any) {
    const next = [...profile.subscriptions]
    next[i] = { ...next[i], [key]: value }
    update('subscriptions', next)
  }
}

// ── Helpers ──

function Section({ title, id, open, onToggle, children }: { title: string; id: string; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-accent/50 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Field({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label className="text-xs">{label}</Label>}
      {children}
    </div>
  )
}

function CurrencyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input className="pl-7" type="number" min={0} value={value || ''} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function computeCompleteness(p: DemographicProfile): number {
  let filled = 0
  const total = 8
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
