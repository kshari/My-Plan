import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SharedPropertyForm from '@/components/property/teams/shared-property-form'

interface SharedPropertyEditProps {
  params: Promise<{ teamId: string; propId: string }>
}

export default async function SharedPropertyEditPage({ params }: SharedPropertyEditProps) {
  const { teamId, propId } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(propId)
  if (isNaN(propertyId)) notFound()

  // Verify membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(id, name)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !membership.teams) notFound()

  const team = membership.teams as unknown as { id: string; name: string }

  const { data: property, error } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('team_id', teamId)
    .single()

  if (error || !property) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/property/teams/${teamId}/properties/${propertyId}`} className={BACK_LINK}>
        ← Back to Property
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit Shared Property</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {team.name} — changes are visible to all team members.
        </p>
      </div>
      <SharedPropertyForm
        teamId={teamId}
        propertyId={propertyId}
        initialData={property}
        currentUserId={user.id}
      />
    </div>
  )
}
