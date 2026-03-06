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
  const noi = (property['Gross Income'] || 0) - (property['Operating Expenses'] || 0)
  const capRate = property['Asking Price'] && noi > 0
    ? ((noi / property['Asking Price']) * 100).toFixed(2)
    : null

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 text-base font-semibold">Property Information</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Address</dt>
          <dd className="mt-1 text-sm">{property.address || 'Not specified'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Type</dt>
          <dd className="mt-1 text-sm">{property.type || 'Not specified'}</dd>
        </div>
        {property['Number of Units'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Number of Units</dt>
            <dd className="mt-1 text-sm">{property['Number of Units']}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Has HOA</dt>
          <dd className="mt-1 text-sm">
            {property['Has HOA'] === null ? 'Not specified' : property['Has HOA'] ? 'Yes' : 'No'}
          </dd>
        </div>
        {property['Asking Price'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Asking Price</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              ${property['Asking Price'].toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        )}
        {property['Gross Income'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Gross Income</dt>
            <dd className="mt-1 text-sm tabular-nums">
              ${property['Gross Income'].toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        )}
        {property['Operating Expenses'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Operating Expenses</dt>
            <dd className="mt-1 text-sm tabular-nums">
              ${property['Operating Expenses'].toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        )}
        {property['Gross Income'] && property['Operating Expenses'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">NOI</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              ${noi.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        )}
        {capRate && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Est. Cap Rate</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">{capRate}%</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
