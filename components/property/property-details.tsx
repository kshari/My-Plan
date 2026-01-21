interface Property {
  id: number
  address: string | null
  type: string | null
  'Number of Units': number | null
  'Has HOA': boolean | null
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  created_at: string
}

interface PropertyDetailsProps {
  property: Property
}

export default function PropertyDetails({ property }: PropertyDetailsProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Property Information</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Address</dt>
            <dd className="mt-1 text-sm text-gray-900">{property.address || 'Not specified'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{property.type || 'Not specified'}</dd>
          </div>
          {property['Number of Units'] && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Number of Units</dt>
              <dd className="mt-1 text-sm text-gray-900">{property['Number of Units']}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Has HOA</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {property['Has HOA'] === null ? 'Not specified' : property['Has HOA'] ? 'Yes' : 'No'}
            </dd>
          </div>
          {property['Asking Price'] && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Asking Price</dt>
              <dd className="mt-1 text-sm text-gray-900">
                ${property['Asking Price'].toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
          {property['Gross Income'] && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Gross Income</dt>
              <dd className="mt-1 text-sm text-gray-900">
                ${property['Gross Income'].toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
          {property['Operating Expenses'] && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Operating Expenses</dt>
              <dd className="mt-1 text-sm text-gray-900">
                ${property['Operating Expenses'].toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
        </dl>
    </div>
  )
}
