'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PROPERTY_TYPES } from '@/lib/constants/property-defaults'
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
    type: string | null
    'Number of Units': number | null
    'Has HOA': boolean | null
    'Asking Price': number | null
    'Gross Income': number | null
    'Operating Expenses': number | null
  }
}

export default function PropertyForm({ propertyId, initialData }: PropertyFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [address, setAddress] = useState(initialData?.address || '')
  const [type, setType] = useState(initialData?.type || '')
  const [numberOfUnits, setNumberOfUnits] = useState(initialData?.['Number of Units']?.toString() || '')
  const [hasHOA, setHasHOA] = useState<boolean | null>(initialData?.['Has HOA'] ?? null)
  const [askingPrice, setAskingPrice] = useState(initialData?.['Asking Price']?.toString() || '')
  const [grossIncome, setGrossIncome] = useState(initialData?.['Gross Income']?.toString() || '')
  const [operatingExpenses, setOperatingExpenses] = useState(initialData?.['Operating Expenses']?.toString() || '')

  const gross = parseFloat(grossIncome) || 0
  const expenses = parseFloat(operatingExpenses) || 0
  const noi = gross - expenses
  const price = parseFloat(askingPrice) || 0
  const capRate = price > 0 && noi > 0 ? (noi / price) * 100 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const propertyData = {
        address: address || null,
        type: type || null,
        'Number of Units': numberOfUnits ? parseInt(numberOfUnits) : null,
        'Has HOA': hasHOA,
        'Asking Price': askingPrice ? parseFloat(askingPrice) : null,
        'Gross Income': grossIncome ? parseFloat(grossIncome) : null,
        'Operating Expenses': operatingExpenses ? parseFloat(operatingExpenses) : null,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
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
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-foreground">
            Property Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={gross > 0 || expenses > 0 ? ['financials'] : []} className="mt-2">
        <AccordionItem value="financials">
          <AccordionTrigger className="text-base font-semibold">
            Financial Information
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="grossIncome" className="block text-sm font-medium text-foreground">
                  Gross Income ($/yr)
                </label>
                <input
                  id="grossIncome"
                  type="number"
                  min="0"
                  step="0.01"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="operatingExpenses" className="block text-sm font-medium text-foreground">
                  Operating Expenses ($/yr)
                </label>
                <input
                  id="operatingExpenses"
                  type="number"
                  min="0"
                  step="0.01"
                  value={operatingExpenses}
                  onChange={(e) => setOperatingExpenses(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {(gross > 0 || expenses > 0) && (
                <div className="md:col-span-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Estimated NOI</p>
                      <p className={`mt-1 text-sm font-semibold tabular-nums ${noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    {capRate > 0 && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Estimated Cap Rate</p>
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
