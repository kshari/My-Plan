import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import Link from 'next/link'
import PropertyCompare from '@/components/property/property-compare'

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>
}

export default async function PropertyComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams
  const { supabase, user } = await requireAuth()

  const ids = (params.ids ?? '')
    .split(',')
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n))
    .slice(0, 3)

  if (ids.length < 2) {
    return (
      <div className={PAGE_CONTAINER}>
        <Link href="/apps/property/dashboard" className={BACK_LINK}>
          &larr; Back to Properties
        </Link>
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
          <p className="mt-2 text-muted-foreground">
            Select 2–3 properties from the list using the checkboxes to compare them.
          </p>
          <Link
            href="/apps/property/dashboard"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Properties
          </Link>
        </div>
      </div>
    )
  }

  const { data: properties } = await supabase
    .from('pi_properties')
    .select('*')
    .in('id', ids)
    .eq('user_id', user.id)

  if (!properties || properties.length < 2) {
    return (
      <div className={PAGE_CONTAINER}>
        <Link href="/apps/property/dashboard" className={BACK_LINK}>
          &larr; Back to Properties
        </Link>
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
          <p className="mt-2 text-muted-foreground">Could not find the selected properties.</p>
        </div>
      </div>
    )
  }

  // Sort by the requested order
  const sortedProperties = ids
    .map((id) => properties.find((p) => p.id === id))
    .filter(Boolean) as typeof properties

  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/property/dashboard" className={BACK_LINK}>
        &larr; Back to Properties
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Compare Properties</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Side-by-side comparison of {sortedProperties.length} properties
        </p>
      </div>
      <PropertyCompare properties={sortedProperties} />
    </div>
  )
}
