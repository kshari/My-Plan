import Link from 'next/link'

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
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <p className="text-gray-500">No properties yet. Add your first property to get started!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <Link 
          key={property.id} 
          href={`/apps/property/properties/${property.id}`}
          className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
        >
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {property.address || 'No address'}
          </h3>
          {property.type && (
            <p className="mb-4 text-sm text-gray-600">{property.type}</p>
          )}
          <div className="space-y-1 text-sm text-gray-600">
            {property['Number of Units'] && (
              <p>{property['Number of Units']} unit{property['Number of Units'] !== 1 ? 's' : ''}</p>
            )}
            {property['Asking Price'] && (
              <p className="font-medium text-gray-900">
                ${property['Asking Price'].toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
            {property['Has HOA'] !== null && (
              <p>HOA: {property['Has HOA'] ? 'Yes' : 'No'}</p>
            )}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Created {new Date(property.created_at).toLocaleDateString()}
          </p>
        </Link>
      ))}
    </div>
  )
}
