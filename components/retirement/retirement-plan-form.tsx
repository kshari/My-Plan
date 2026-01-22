'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface RetirementPlanFormProps {
  planId?: number
  initialData?: {
    plan_name: string
  }
}

export default function RetirementPlanForm({ planId, initialData }: RetirementPlanFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planName, setPlanName] = useState(initialData?.plan_name || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (planId) {
        const { error } = await supabase
          .from('rp_retirement_plans')
          .update({ plan_name: planName })
          .eq('id', planId)
        
        if (error) throw error
        router.push(`/apps/retirement/plans/${planId}`)
      } else {
        const { data, error } = await supabase
          .from('rp_retirement_plans')
          .insert([{ plan_name: planName, user_id: user.id }])
          .select()
          .single()
        
        if (error) throw error
        router.push(`/apps/retirement/plans/${data.id}`)
      }

      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Failed to save plan')
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
        <label htmlFor="planName" className="block text-sm font-medium text-gray-700">
          Plan Name *
        </label>
        <input
          id="planName"
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          required
          placeholder="My Retirement Plan"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : planId ? 'Update Plan' : 'Create Plan'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
