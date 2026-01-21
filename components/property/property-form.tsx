'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Address *
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="123 Main St, City, State ZIP"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Property Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        >
          <option value="">Select property type</option>
          <option value="Single Family">Single Family</option>
          <option value="Multi Family">Multi Family</option>
          <option value="Apartment">Apartment</option>
          <option value="Commercial">Commercial</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="numberOfUnits" className="block text-sm font-medium text-gray-700">
          Number of Units
        </label>
        <input
          id="numberOfUnits"
          type="number"
          min="1"
          value={numberOfUnits}
          onChange={(e) => setNumberOfUnits(e.target.value)}
          placeholder="1"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="hasHOA" className="block text-sm font-medium text-gray-700">
          Has HOA?
        </label>
        <select
          id="hasHOA"
          value={hasHOA === null ? '' : hasHOA ? 'yes' : 'no'}
          onChange={(e) => setHasHOA(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        >
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div>
        <label htmlFor="askingPrice" className="block text-sm font-medium text-gray-700">
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
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="grossIncome" className="block text-sm font-medium text-gray-700">
          Gross Income ($)
        </label>
        <input
          id="grossIncome"
          type="number"
          min="0"
          step="0.01"
          value={grossIncome}
          onChange={(e) => setGrossIncome(e.target.value)}
          placeholder="0.00"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="operatingExpenses" className="block text-sm font-medium text-gray-700">
          Operating Expenses ($)
        </label>
        <input
          id="operatingExpenses"
          type="number"
          min="0"
          step="0.01"
          value={operatingExpenses}
          onChange={(e) => setOperatingExpenses(e.target.value)}
          placeholder="0.00"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : propertyId ? 'Update Property' : 'Create Property'}
        </button>
      </div>
    </form>
  )
}
