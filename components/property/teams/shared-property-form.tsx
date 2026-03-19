'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PROPERTY_TYPES, PROPERTY_STATUSES } from '@/lib/constants/property-defaults'
import { useRouter } from 'next/navigation'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import type { SharedProperty } from '@/lib/types/teams'

interface SharedPropertyFormProps {
  teamId: string
  propertyId: number
  initialData: Omit<SharedProperty, 'id' | 'team_id' | 'shared_by' | 'shared_at' | 'created_at'>
  currentUserId: string
}

export default function SharedPropertyForm({ teamId, propertyId, initialData, currentUserId }: SharedPropertyFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [address, setAddress] = useState(initialData.address || '')
  const [city, setCity] = useState(initialData.city || '')
  const [county, setCounty] = useState(initialData.county || '')
  const [type, setType] = useState(initialData.type || '')
  const [numberOfUnits, setNumberOfUnits] = useState(initialData['Number of Units']?.toString() || '')
  const [hasHOA, setHasHOA] = useState<boolean | null>(initialData['Has HOA'] ?? null)
  const [swimmingPool, setSwimmingPool] = useState<boolean | null>(initialData.swimming_pool ?? null)
  const [askingPrice, setAskingPrice] = useState(initialData['Asking Price']?.toString() || '')
  const [grossIncome, setGrossIncome] = useState(initialData['Gross Income']?.toString() || '')
  const [operatingExpenses, setOperatingExpenses] = useState(initialData['Operating Expenses']?.toString() || '')
  const [listingStatus, setListingStatus] = useState(initialData.listing_status ?? '')
  const [source, setSource] = useState(initialData.source || '')
  const [mlsNumber, setMlsNumber] = useState(initialData.mls_number || '')
  const [listingUrl, setListingUrl] = useState(initialData.listing_url || '')
  const [bedrooms, setBedrooms] = useState(initialData.bedrooms?.toString() || '')
  const [bathrooms, setBathrooms] = useState(initialData.bathrooms?.toString() || '')
  const [sqft, setSqft] = useState(initialData.sqft?.toString() || '')
  const [lotSize, setLotSize] = useState(initialData.lot_size || '')
  const [community, setCommunity] = useState(initialData.community || '')
  const [planName, setPlanName] = useState(initialData.plan_name || '')
  const [estimatedRent, setEstimatedRent] = useState(initialData.estimated_rent?.toString() || '')
  const [estimatedCashFlow, setEstimatedCashFlow] = useState(initialData.estimated_cash_flow?.toString() || '')
  const [notes, setNotes] = useState(initialData.notes || '')
  const [additionalInfo, setAdditionalInfo] = useState(initialData.additional_info || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!address.trim()) { setError('Address is required'); return }
    setLoading(true)

    const { error: updateErr } = await supabase
      .from('team_shared_properties')
      .update({
        address: address.trim(),
        city: city.trim() || null,
        county: county.trim() || null,
        type: type || null,
        'Number of Units': numberOfUnits ? parseInt(numberOfUnits) : null,
        'Has HOA': hasHOA,
        swimming_pool: swimmingPool,
        'Asking Price': askingPrice ? parseFloat(askingPrice) : null,
        'Gross Income': grossIncome ? parseFloat(grossIncome) : null,
        'Operating Expenses': operatingExpenses ? parseFloat(operatingExpenses) : null,
        listing_status: listingStatus || null,
        source: source.trim() || null,
        mls_number: mlsNumber.trim() || null,
        listing_url: listingUrl.trim() || null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
        sqft: sqft ? parseFloat(sqft) : null,
        lot_size: lotSize.trim() || null,
        community: community.trim() || null,
        plan_name: planName.trim() || null,
        estimated_rent: estimatedRent ? parseFloat(estimatedRent) : null,
        estimated_cash_flow: estimatedCashFlow ? parseFloat(estimatedCashFlow) : null,
        notes: notes.trim() || null,
        additional_info: additionalInfo.trim() || null,
        last_updated_by: currentUserId,
      })
      .eq('id', propertyId)
      .eq('team_id', teamId)

    setLoading(false)
    if (updateErr) { setError(updateErr.message); return }
    router.push(`/apps/property/teams/${teamId}/properties/${propertyId}`)
    router.refresh()
  }

  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
  const labelClass = "text-sm font-medium"

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && <ErrorMessage message={error} />}

      {/* Core fields */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Property Info</h2>
        <div className="space-y-1.5">
          <label className={labelClass}>Address *</label>
          <input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>County</label>
            <input value={county} onChange={e => setCounty(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Property Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className={inputClass}>
              <option value="">Select type</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Listing Status</label>
            <select value={listingStatus} onChange={e => setListingStatus(e.target.value)} className={inputClass}>
              <option value="">Select status</option>
              {PROPERTY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Financials */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Financials</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Asking Price ($)</label>
            <input type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Monthly Gross Income ($)</label>
            <input type="number" value={grossIncome} onChange={e => setGrossIncome(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Monthly Operating Expenses ($)</label>
            <input type="number" value={operatingExpenses} onChange={e => setOperatingExpenses(e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Estimated Rent ($)</label>
            <input type="number" value={estimatedRent} onChange={e => setEstimatedRent(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Additional details in accordion */}
      <Accordion type="single" collapsible>
        <AccordionItem value="details" className="rounded-xl border bg-card px-5">
          <AccordionTrigger className="text-sm font-semibold">Additional Details</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Bedrooms</label>
                  <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Bathrooms</label>
                  <input type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Sqft</label>
                  <input type="number" value={sqft} onChange={e => setSqft(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Community</label>
                  <input value={community} onChange={e => setCommunity(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>MLS Number</label>
                  <input value={mlsNumber} onChange={e => setMlsNumber(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
