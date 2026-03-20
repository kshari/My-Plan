import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { User, Calendar } from 'lucide-react'
import PropertyDetails from '@/components/property/property-details'
import CopyToPersonalButton from '@/components/property/teams/copy-to-personal-button'

interface SharedPropertyDetailProps {
  params: Promise<{ teamId: string; propId: string }>
}

export default async function SharedPropertyDetailPage({ params }: SharedPropertyDetailProps) {
  const { teamId, propId } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(propId)
  if (isNaN(propertyId)) notFound()

  // Verify team membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, teams(id, name)')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !membership.teams) notFound()

  const team = membership.teams as unknown as { id: string; name: string }

  // Fetch shared property (RLS enforces membership)
  const { data: property, error } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('team_id', teamId)
    .single()

  if (error || !property) notFound()

  const sharedByLabel = property.shared_by === user.id
    ? 'you'
    : `…${property.shared_by.slice(-6)}`

  const updatedByLabel = property.last_updated_by
    ? property.last_updated_by === user.id
      ? 'you'
      : `…${property.last_updated_by.slice(-6)}`
    : null

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/property/teams/${teamId}`} className={BACK_LINK}>
        ← Back to {team.name}
      </Link>

      <div className="mt-4 mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {property.address || 'Shared Property'}
          </h1>
          {/* Provenance badge */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              Shared by {sharedByLabel} on {new Date(property.shared_at).toLocaleDateString()}
            </span>
            {updatedByLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Last updated by {updatedByLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Link
            href={`/apps/property/teams/${teamId}/properties/${propertyId}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Edit
          </Link>
          <CopyToPersonalButton teamId={teamId} sharedPropertyId={propertyId} />
        </div>
      </div>

      <PropertyDetails
        property={property}
        propertyBasePath={`/apps/property/teams/${teamId}/properties/${propertyId}`}
      />
    </div>
  )
}
