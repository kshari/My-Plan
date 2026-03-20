import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PropertyCompare from '@/components/property/property-compare'

interface TeamComparePageProps {
  params: Promise<{ teamId: string }>
  searchParams: Promise<{ ids?: string }>
}

export default async function TeamComparePage({ params, searchParams }: TeamComparePageProps) {
  const { teamId } = await params
  const { ids: idsParam } = await searchParams
  const { supabase, user } = await requireAuth()

  // Verify team membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) notFound()

  const backHref = `/apps/property/teams/${teamId}`

  const ids = (idsParam ?? '')
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n))
    .slice(0, 3)

  if (ids.length < 2) {
    return (
      <div className={PAGE_CONTAINER}>
        <Link href={backHref} className={BACK_LINK}>
          ← Back to Team Properties
        </Link>
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
          <p className="mt-2 text-muted-foreground">
            Select 2–3 properties from the list using the checkboxes to compare them.
          </p>
          <Link
            href={backHref}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Team Properties
          </Link>
        </div>
      </div>
    )
  }

  // Fetch from team_shared_properties (RLS ensures user is a member)
  const { data: properties } = await supabase
    .from('team_shared_properties')
    .select('*')
    .in('id', ids)
    .eq('team_id', teamId)

  if (!properties || properties.length < 2) {
    return (
      <div className={PAGE_CONTAINER}>
        <Link href={backHref} className={BACK_LINK}>
          ← Back to Team Properties
        </Link>
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
          <p className="mt-2 text-muted-foreground">Could not find the selected properties.</p>
        </div>
      </div>
    )
  }

  const sortedProperties = ids
    .map((id) => properties.find((p) => p.id === id))
    .filter(Boolean) as typeof properties

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={backHref} className={BACK_LINK}>
        ← Back to Team Properties
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Side-by-side comparison of {sortedProperties.length} shared properties
        </p>
      </div>
      <PropertyCompare properties={sortedProperties} />
    </div>
  )
}
