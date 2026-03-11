/**
 * Auto-detect and manage column mappings from CSV/PDF headers to property fields.
 */

export type PropertyField =
  | 'address'
  | 'city'
  | 'county'
  | 'type'
  | 'numberOfUnits'
  | 'hasHOA'
  | 'swimmingPool'
  | 'askingPrice'
  | 'grossIncome'
  | 'operatingExpenses'
  | 'listingStatus'
  | 'source'
  | 'mlsNumber'
  | 'listingUrl'
  | 'bedrooms'
  | 'bathrooms'
  | 'sqft'
  | 'lotSize'
  | 'notes'
  | 'community'
  | 'planName'
  | 'estimatedRent'
  | 'estimatedCashFlow'
  | 'ignore'

export interface FieldDef {
  key: PropertyField
  label: string
  dbColumn: string
  type: 'text' | 'number' | 'boolean'
}

/**
 * Fields that cannot be null in the database. Rows missing these will prompt
 * the user to provide a value for all rows or per row before import.
 */
export const REQUIRED_IMPORT_FIELDS: { dbColumn: string; label: string }[] = [
  { dbColumn: 'address', label: 'Address' },
]

export const PROPERTY_FIELDS: FieldDef[] = [
  { key: 'address', label: 'Address', dbColumn: 'address', type: 'text' },
  { key: 'city', label: 'City', dbColumn: 'city', type: 'text' },
  { key: 'county', label: 'County', dbColumn: 'county', type: 'text' },
  { key: 'type', label: 'Property Type', dbColumn: 'type', type: 'text' },
  { key: 'numberOfUnits', label: 'Number of Units', dbColumn: 'Number of Units', type: 'number' },
  { key: 'hasHOA', label: 'Has HOA', dbColumn: 'Has HOA', type: 'boolean' },
  { key: 'swimmingPool', label: 'Swimming Pool', dbColumn: 'swimming_pool', type: 'boolean' },
  { key: 'askingPrice', label: 'Asking Price', dbColumn: 'Asking Price', type: 'number' },
  { key: 'grossIncome', label: 'Gross Income', dbColumn: 'Gross Income', type: 'number' },
  { key: 'operatingExpenses', label: 'Operating Expenses', dbColumn: 'Operating Expenses', type: 'number' },
  { key: 'listingStatus', label: 'Listing Status', dbColumn: 'listing_status', type: 'text' },
  { key: 'source', label: 'Source / Realtor', dbColumn: 'source', type: 'text' },
  { key: 'mlsNumber', label: 'MLS #', dbColumn: 'mls_number', type: 'text' },
  { key: 'listingUrl', label: 'Listing URL', dbColumn: 'listing_url', type: 'text' },
  { key: 'bedrooms', label: 'Bedrooms', dbColumn: 'bedrooms', type: 'number' },
  { key: 'bathrooms', label: 'Bathrooms', dbColumn: 'bathrooms', type: 'number' },
  { key: 'sqft', label: 'Sq Ft', dbColumn: 'sqft', type: 'number' },
  { key: 'lotSize', label: 'Lot Size', dbColumn: 'lot_size', type: 'text' },
  { key: 'community', label: 'Community', dbColumn: 'community', type: 'text' },
  { key: 'planName', label: 'Plan Name', dbColumn: 'plan_name', type: 'text' },
  { key: 'estimatedRent', label: 'Estimated Rent', dbColumn: 'estimated_rent', type: 'number' },
  { key: 'estimatedCashFlow', label: 'Estimated Cash Flow', dbColumn: 'estimated_cash_flow', type: 'number' },
  { key: 'notes', label: 'Notes', dbColumn: 'notes', type: 'text' },
]

const FIELD_ALIASES: Record<PropertyField, string[]> = {
  address: ['address', 'street address', 'property address', 'location', 'street', 'full address', 'addr'],
  city: ['city', 'town', 'municipality', 'city name'],
  county: ['county', 'county name', 'parish'],
  type: ['property type', 'type', 'prop type', 'building type', 'class'],
  numberOfUnits: ['units', 'number of units', '# units', 'unit count', 'num units'],
  hasHOA: ['hoa', 'has hoa', 'hoa?', 'hoa fee'],
  swimmingPool: ['swimming pool', 'pool', 'has pool', 'swimming pool?'],
  askingPrice: ['asking price', 'price', 'list price', 'listing price', 'asking', 'sale price', 'original price'],
  grossIncome: ['gross income', 'income', 'annual income', 'gross rent', 'rental income', 'total income', 'annual rent', 'monthly income', 'monthly gross'],
  operatingExpenses: ['operating expenses', 'expenses', 'annual expenses', 'opex', 'total expenses', 'monthly expenses', 'monthly opex'],
  listingStatus: ['status', 'listing status', 'mls status', 'property status', 'available', 'sold', 'leased'],
  source: ['source', 'realtor', 'agent', 'brokerage', 'broker', 'listed by', 'listing agent', 'agent name'],
  mlsNumber: ['mls', 'mls #', 'mls number', 'mls#', 'mls id', 'listing id', 'listing number', 'listing #'],
  listingUrl: ['url', 'listing url', 'link', 'listing link', 'web link', 'property url', 'detail url'],
  bedrooms: ['bedrooms', 'beds', 'br', 'bed', '# beds', 'num bedrooms', 'bedroom'],
  bathrooms: ['bathrooms', 'baths', 'ba', 'bath', '# baths', 'num bathrooms', 'bathroom'],
  sqft: ['sqft', 'sq ft', 'square feet', 'square footage', 'living area', 'area', 'size', 'building sqft'],
  lotSize: ['lot size', 'lot', 'lot area', 'land area', 'lot acres', 'acreage', 'lot sqft'],
  community: ['community', 'subdivision', 'neighborhood', 'neighbourhood', 'hoa community', 'community name', 'sub division'],
  planName: ['plan name', 'plan', 'floor plan', 'floorplan', 'model', 'model name', 'builder plan'],
  estimatedRent: ['estimated rent', 'est rent', 'rent', 'monthly rent', 'rent estimate', 'rental estimate', 'est. rent'],
  estimatedCashFlow: ['estimated cash flow', 'est cash flow', 'cash flow', 'monthly cash flow', 'cashflow', 'est. cash flow', 'net cash flow'],
  notes: ['notes', 'comments', 'remarks', 'description', 'property description'],
  ignore: [],
}

export interface ColumnMapping {
  csvColumn: string
  field: PropertyField
}

/**
 * Auto-detect column mappings from CSV/PDF headers to property fields.
 */
export function autoDetectMappings(columns: string[]): ColumnMapping[] {
  const usedFields = new Set<PropertyField>()
  const mappings: ColumnMapping[] = []

  for (const col of columns) {
    const normalized = col.toLowerCase().trim()
    let bestMatch: PropertyField = 'ignore'

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (field === 'ignore') continue
      for (const alias of aliases) {
        if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
          if (!usedFields.has(field as PropertyField)) {
            bestMatch = field as PropertyField
            break
          }
        }
      }
      if (bestMatch !== 'ignore') break
    }

    if (bestMatch !== 'ignore') {
      usedFields.add(bestMatch)
    }
    mappings.push({ csvColumn: col, field: bestMatch })
  }

  return mappings
}

/**
 * Convert a raw parsed row into a property data record using column mappings.
 */
export function mapRowToProperty(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const mapping of mappings) {
    if (mapping.field === 'ignore') continue
    const fieldDef = PROPERTY_FIELDS.find((f) => f.key === mapping.field)
    if (!fieldDef) continue

    const raw = (row[mapping.csvColumn] ?? '').trim()
    if (!raw) continue

    switch (fieldDef.type) {
      case 'number': {
        const cleaned = raw.replace(/[$,%\s]/g, '').replace(/,/g, '')
        const num = parseFloat(cleaned)
        if (!isNaN(num)) result[fieldDef.dbColumn] = num
        break
      }
      case 'boolean': {
        const lower = raw.toLowerCase()
        if (lower === 'yes' || lower === 'true' || lower === '1' || lower === 'y') {
          result[fieldDef.dbColumn] = true
        } else if (lower === 'no' || lower === 'false' || lower === '0' || lower === 'n') {
          result[fieldDef.dbColumn] = false
        }
        break
      }
      default:
        result[fieldDef.dbColumn] = raw
    }
  }

  return result
}
