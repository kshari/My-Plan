import Link from 'next/link'
import { Building2, Calendar, Hash, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

interface Property {
  id: number
  address: string | null
  type: string | null
  'Number of Units': number | null
  'Has HOA': boolean | null
  'Asking Price': number | null
  created_at: string
}

interface PropertyListProps {
  properties: Property[]
}

export default function PropertyList({ properties }: PropertyListProps) {
  if (properties.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        message="No properties yet"
        description="Add your first property to get started."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <Link
          key={property.id}
          href={`/apps/property/properties/${property.id}`}
          className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            {property.type && (
              <Badge variant="secondary" className="text-[10px] capitalize">{property.type}</Badge>
            )}
          </div>

          <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
            {property.address || 'No address'}
          </h3>

          {property['Asking Price'] && (
            <p className="mt-1 text-lg font-bold tabular-nums">
              ${property['Asking Price'].toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {property['Number of Units'] && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {property['Number of Units']} unit{property['Number of Units'] !== 1 ? 's' : ''}
              </span>
            )}
            {property['Has HOA'] !== null && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                HOA: {property['Has HOA'] ? 'Yes' : 'No'}
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto">
              <Calendar className="h-3 w-3" />
              {new Date(property.created_at).toLocaleDateString()}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
