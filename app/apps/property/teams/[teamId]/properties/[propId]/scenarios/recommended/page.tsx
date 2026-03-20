import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RecommendedScenariosList from '@/components/property/recommended-scenarios-list'

interface TeamRecommendedScenariosPageProps {
  params: Promise<{ teamId: string; propId: string }>
}

export default async function TeamRecommendedScenariosPage({ params }: TeamRecommendedScenariosPageProps) {
  const { teamId, propId } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(propId)
  if (isNaN(propertyId)) notFound()

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) notFound()

  const { data: property, error } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('team_id', teamId)
    .single()

  if (error || !property) notFound()

  const backHref = `/apps/property/teams/${teamId}/properties/${propertyId}`

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700">
              ← My Plan / Property Investment
            </Link>
            <div className="flex items-center gap-4">
              <Link href={backHref} className="text-sm text-blue-600 hover:text-blue-800">
                Back to Property
              </Link>
              <Link href={`/apps/property/teams/${teamId}`} className="text-sm text-blue-600 hover:text-blue-800">
                Team
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={backHref} className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800">
          ← Back to Property
        </Link>

        <RecommendedScenariosList property={property} variant="team" />
      </main>
    </div>
  )
}
