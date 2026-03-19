import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PropertyDetails from '@/components/property/property-details'
import FinancialScenariosList from '@/components/property/financial-scenarios-list'
import DeletePropertyButton from '@/components/property/delete-property-button'
import { PropertyPdfDialog } from '@/components/property/property-pdf-dialog'
import ShareBackButton from '@/components/property/teams/share-back-button'
import { TrendingUp, DollarSign, BarChart3, Layers } from 'lucide-react'

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) notFound()

  const { data: property, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (error || !property) notFound()

  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('created_at', { ascending: false })

  // Fetch user's teams for Share to Team button
  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)

  const teams = (memberships ?? [])
    .filter(m => m.teams)
    .map(m => m.teams as unknown as { id: string; name: string })

  const scenarioCount = scenarios?.length || 0
  let bestCapRate = 0
  let bestCoCR = 0
  let totalEquity = 0
  let bestScenarioId: number | undefined

  if (scenarios && scenarios.length > 0) {
    for (const s of scenarios) {
      const pp = parseFloat(s['Purchase Price']?.toString() || '0') || 0
      const gi = parseFloat(s['Gross Income']?.toString() || '0') || 0
      const oe = parseFloat(s['Operating Expenses']?.toString() || '0') || 0
      const noi = gi - oe
      const capRate = pp > 0 ? (noi / pp) * 100 : 0
      if (capRate > bestCapRate) {
        bestCapRate = capRate
        bestScenarioId = s.id
      }

      const hasLoan = s['Has Loan'] || false
      const dp = parseFloat(s['Down Payment Amount']?.toString() || '0') || 0
      const lcc = parseFloat(s['Closing Costs']?.toString() || '0') || 0
      const pcc = parseFloat(s['Purchase Closing Costs']?.toString() || '0') || 0
      const tci = hasLoan ? dp + lcc + pcc : pp + pcc

      const ir = parseFloat(s['Interest Rate']?.toString() || '0') || 0
      const lt = parseInt(s['Loan Term']?.toString() || '0') || 0
      const lp = pp - dp
      let firstYearCF = noi
      if (hasLoan && lp > 0 && ir > 0 && lt > 0) {
        const mr = ir / 100 / 12
        const np = lt * 12
        const mp = lp * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
        let balance = lp
        let fyInterest = 0
        let fyPrincipal = 0
        for (let m = 1; m <= 12; m++) {
          const interestP = balance * mr
          const principalP = mp - interestP
          fyInterest += interestP
          fyPrincipal += principalP > balance ? balance : principalP
          balance = Math.max(0, balance - principalP)
        }
        firstYearCF = noi - fyInterest - fyPrincipal
      }

      const cocr = tci > 0 ? (firstYearCF / tci) * 100 : 0
      if (cocr > bestCoCR) bestCoCR = cocr
      totalEquity += pp
    }
  }

  const summaryCards = scenarioCount > 0 ? [
    { label: 'Best Cap Rate', value: `${bestCapRate.toFixed(2)}%`, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Best CoCR', value: `${bestCoCR.toFixed(2)}%`, icon: BarChart3, color: bestCoCR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive' },
    { label: 'Total Property Value', value: `$${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-foreground' },
    { label: 'Scenarios Modeled', value: scenarioCount.toString(), icon: Layers, color: 'text-primary' },
  ] : null

  return (
    <div className={PAGE_CONTAINER}>
      <Link
        href="/apps/property/dashboard"
        className={BACK_LINK}
      >
        ← Back to Properties
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {property.address || 'Property Details'}
        </h1>
        <div className="flex gap-3">
          <PropertyPdfDialog
            propertyId={propertyId}
            scenarioId={bestScenarioId}
            propertyName={property.address || undefined}
          />
          {teams.length > 0 && (
            <ShareBackButton propertyId={propertyId} teams={teams} />
          )}
          <Link
            href={`/apps/property/properties/${propertyId}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Edit Property
          </Link>
          <DeletePropertyButton
            propertyId={propertyId}
            propertyName={property.address || undefined}
          />
        </div>
      </div>

      {summaryCards && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <PropertyDetails property={property} />
        <FinancialScenariosList propertyId={propertyId} />
      </div>
    </div>
  )
}
