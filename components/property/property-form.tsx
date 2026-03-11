'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PROPERTY_TYPES, PROPERTY_STATUSES } from '@/lib/constants/property-defaults'
import { useRouter } from 'next/navigation'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface PropertyFormProps {
  propertyId?: number
  initialData?: {
    address: string | null
    city: string | null
    county: string | null
    type: string | null
    'Number of Units': number | null
    'Has HOA': boolean | null
    swimming_pool?: boolean | null
    'Asking Price': number | null
    'Gross Income': number | null
    'Operating Expenses': number | null
    listing_status: string | null
    source: string | null
    mls_number: string | null
    listing_url: string | null
    bedrooms: number | null
    bathrooms: number | null
    sqft: number | null
    lot_size: string | null
    community: string | null
    plan_name: string | null
    estimated_rent: number | null
    estimated_cash_flow: number | null
    notes: string | null
    additional_info: string | null
  }
}

export default function PropertyForm({ propertyId, initialData }: PropertyFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [address, setAddress] = useState(initialData?.address || '')
  const [city, setCity] = useState(initialData?.city || '')
  const [county, setCounty] = useState(initialData?.county || '')
  const [type, setType] = useState(initialData?.type || '')
  const [numberOfUnits, setNumberOfUnits] = useState(() => {
    const v = initialData?.['Number of Units']
    if (v != null && v !== '') return String(v)
    if (initialData?.type === 'Single Family') return '1'
    return ''
  })
  const [hasHOA, setHasHOA] = useState<boolean | null>(initialData?.['Has HOA'] ?? null)
  const [swimmingPool, setSwimmingPool] = useState<boolean | null>(initialData?.swimming_pool ?? null)
  const [askingPrice, setAskingPrice] = useState(initialData?.['Asking Price']?.toString() || '')
  const [grossIncome, setGrossIncome] = useState(initialData?.['Gross Income']?.toString() || '')
  const [operatingExpenses, setOperatingExpenses] = useState(initialData?.['Operating Expenses']?.toString() || '')
  const [listingStatus, setListingStatus] = useState(initialData?.listing_status ?? '')
  const [source, setSource] = useState(initialData?.source || '')
  const [mlsNumber, setMlsNumber] = useState(initialData?.mls_number || '')
  const [listingUrl, setListingUrl] = useState(initialData?.listing_url || '')
  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms?.toString() || '')
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms?.toString() || '')
  const [sqft, setSqft] = useState(initialData?.sqft?.toString() || '')
  const [lotSize, setLotSize] = useState(initialData?.lot_size || '')
  const [community, setCommunity] = useState(initialData?.community || '')
  const [planName, setPlanName] = useState(initialData?.plan_name || '')
  const [estimatedRent, setEstimatedRent] = useState(initialData?.estimated_rent?.toString() || '')
  const [estimatedCashFlow, setEstimatedCashFlow] = useState(initialData?.estimated_cash_flow?.toString() || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [additionalInfo, setAdditionalInfo] = useState(initialData?.additional_info || '')

  const gross = parseFloat(grossIncome) || 0
  const expenses = parseFloat(operatingExpenses) || 0
  const noi = gross - expenses
  const price = parseFloat(askingPrice) || 0
  const annualNoi = noi * 12
  const capRate = price > 0 && annualNoi > 0 ? (annualNoi / price) * 100 : 0

  const hasListingDetails = !!(listingStatus || source || mlsNumber || listingUrl)
  const hasPropertyDetails = !!(bedrooms || bathrooms || sqft || lotSize || community || planName)
  const hasEstimates = !!(estimatedRent || estimatedCashFlow)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!listingStatus || !listingStatus.trim()) {
      setError('Please select a property status (Available, Sold, or Leased).')
      return
    }
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const propertyData = {
        address: address || null,
        city: city || null,
        county: county || null,
        type: type || null,
        'Number of Units': numberOfUnits ? parseInt(numberOfUnits) : null,
        'Has HOA': hasHOA,
        swimming_pool: swimmingPool,
        'Asking Price': askingPrice ? parseFloat(askingPrice) : null,
        'Gross Income': grossIncome ? parseFloat(grossIncome) : null,
        'Operating Expenses': operatingExpenses ? parseFloat(operatingExpenses) : null,
        listing_status: listingStatus.trim() || null,
        source: source || null,
        mls_number: mlsNumber || null,
        listing_url: listingUrl || null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        sqft: sqft ? parseFloat(sqft) : null,
        lot_size: lotSize || null,
        community: community || null,
        plan_name: planName || null,
        estimated_rent: estimatedRent ? parseFloat(estimatedRent) : null,
        estimated_cash_flow: estimatedCashFlow ? parseFloat(estimatedCashFlow) : null,
        notes: notes || null,
        additional_info: additionalInfo.trim() || null,
        user_id: user.id,
      }

      if (propertyId) {
        const { error } = await supabase
          .from('pi_properties')
          .update(propertyData)
          .eq('id', propertyId)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pi_properties')
          .insert([propertyData])
        
        if (error) throw error
      }

      router.push('/apps/property/dashboard')
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Failed to save property')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="listingStatus" className="block text-sm font-medium text-foreground">
            Status *
          </label>
          <select id="listingStatus" value={listingStatus} onChange={(e) => setListingStatus(e.target.value)} className={inputClass} required aria-required="true">
            <option value="">Select status</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Available, Sold, or Leased (for reference/analytics)</p>
        </div>

        <div className="md:col-span-2 md:col-start-1">
          <label htmlFor="address" className="block text-sm font-medium text-foreground">
            Address *
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="123 Main St, City, State ZIP"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-foreground">
            City
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="county" className="block text-sm font-medium text-foreground">
            County
          </label>
          <input
            id="county"
            type="text"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder="County"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-foreground">
            Property Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => {
              const v = e.target.value
              setType(v)
              if (v === 'Single Family' && !numberOfUnits.trim()) setNumberOfUnits('1')
            }}
            className={inputClass}
          >
            <option value="">Select property type</option>
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="numberOfUnits" className="block text-sm font-medium text-foreground">
            Number of Units
          </label>
          <input
            id="numberOfUnits"
            type="number"
            min="1"
            value={numberOfUnits}
            onChange={(e) => setNumberOfUnits(e.target.value)}
            placeholder="1"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="hasHOA" className="block text-sm font-medium text-foreground">
            Has HOA?
          </label>
          <select
            id="hasHOA"
            value={hasHOA === null ? '' : hasHOA ? 'yes' : 'no'}
            onChange={(e) => setHasHOA(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
            className={inputClass}
          >
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label htmlFor="swimmingPool" className="block text-sm font-medium text-foreground">
            Swimming Pool?
          </label>
          <select
            id="swimmingPool"
            value={swimmingPool === null ? '' : swimmingPool ? 'yes' : 'no'}
            onChange={(e) => setSwimmingPool(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
            className={inputClass}
          >
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label htmlFor="askingPrice" className="block text-sm font-medium text-foreground">
            Asking Price ($)
          </label>
          <input
            id="askingPrice"
            type="number"
            min="0"
            step="0.01"
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={[
        ...(hasListingDetails ? ['listing'] : []),
        ...(hasPropertyDetails ? ['details'] : []),
        ...(gross > 0 || expenses > 0 || hasEstimates ? ['financials'] : []),
        ...(notes ? ['notes'] : []),
        ...(additionalInfo ? ['additional'] : []),
      ]} className="mt-2">
        <AccordionItem value="listing">
          <AccordionTrigger className="text-base font-semibold">
            Listing Details
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-foreground">
                  Source / Realtor
                </label>
                <input id="source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Agent name or brokerage" className={inputClass} />
              </div>
              <div>
                <label htmlFor="mlsNumber" className="block text-sm font-medium text-foreground">
                  MLS #
                </label>
                <input id="mlsNumber" type="text" value={mlsNumber} onChange={(e) => setMlsNumber(e.target.value)} placeholder="MLS listing number" className={inputClass} />
              </div>
              <div>
                <label htmlFor="listingUrl" className="block text-sm font-medium text-foreground">
                  Listing URL
                </label>
                <input id="listingUrl" type="url" value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="details">
          <AccordionTrigger className="text-base font-semibold">
            Property Details
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor="bedrooms" className="block text-sm font-medium text-foreground">Bedrooms</label>
                <input id="bedrooms" type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div>
                <label htmlFor="bathrooms" className="block text-sm font-medium text-foreground">Bathrooms</label>
                <input id="bathrooms" type="number" min="0" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div>
                <label htmlFor="sqft" className="block text-sm font-medium text-foreground">Sq Ft</label>
                <input id="sqft" type="number" min="0" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div>
                <label htmlFor="lotSize" className="block text-sm font-medium text-foreground">Lot Size</label>
                <input id="lotSize" type="text" value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="e.g. 0.25 acres" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label htmlFor="community" className="block text-sm font-medium text-foreground">Community</label>
                <input id="community" type="text" value={community} onChange={(e) => setCommunity(e.target.value)} placeholder="Subdivision or neighborhood" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label htmlFor="planName" className="block text-sm font-medium text-foreground">Plan Name</label>
                <input id="planName" type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Floor plan or model name" className={inputClass} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="financials">
          <AccordionTrigger className="text-base font-semibold">
            Financial Information
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="grossIncome" className="block text-sm font-medium text-foreground">
                  Gross Income ($/mo)
                </label>
                <input
                  id="grossIncome"
                  type="number"
                  min="0"
                  step="0.01"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="operatingExpenses" className="block text-sm font-medium text-foreground">
                  Operating Expenses ($/mo)
                </label>
                <input
                  id="operatingExpenses"
                  type="number"
                  min="0"
                  step="0.01"
                  value={operatingExpenses}
                  onChange={(e) => setOperatingExpenses(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="estimatedRent" className="block text-sm font-medium text-foreground">
                  Estimated Rent ($/mo)
                </label>
                <input
                  id="estimatedRent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedRent}
                  onChange={(e) => setEstimatedRent(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="estimatedCashFlow" className="block text-sm font-medium text-foreground">
                  Estimated Cash Flow ($/mo)
                </label>
                <input
                  id="estimatedCashFlow"
                  type="number"
                  step="0.01"
                  value={estimatedCashFlow}
                  onChange={(e) => setEstimatedCashFlow(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              {(gross > 0 || expenses > 0) && (
                <div className="md:col-span-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">NOI /mo</p>
                      <p className={`mt-1 text-sm font-semibold tabular-nums ${noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">NOI /yr</p>
                      <p className={`mt-1 text-sm font-semibold tabular-nums ${noi * 12 >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        ${(noi * 12).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    {capRate > 0 && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Cap Rate</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
                          {capRate.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notes">
          <AccordionTrigger className="text-base font-semibold">
            Notes
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this property..."
                rows={4}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additional">
          <AccordionTrigger className="text-base font-semibold">
            Additional information
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-2">
                Free-form text or JSON. On import, unmapped columns are stored here automatically.
              </p>
              <textarea
                id="additionalInfo"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Extra details, or paste JSON from import..."
                rows={4}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono text-sm"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Saving...' : propertyId ? 'Update Property' : 'Create Property'}
        </button>
      </div>
    </form>
  )
}
