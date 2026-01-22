'use client'

import Link from 'next/link'
import { useState } from 'react'

interface RetirementPlan {
  id: number
  plan_name: string
  created_at: string
  updated_at: string
}

interface RetirementPlanListProps {
  plans: RetirementPlan[]
}

export default function RetirementPlanList({ plans }: RetirementPlanListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (planId: number, planName: string) => {
    if (!confirm(`Are you sure you want to delete "${planName}"? This will delete all associated data.`)) {
      return
    }

    setDeletingId(planId)
    try {
      const response = await fetch(`/apps/retirement/plans/${planId}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete plan')
      }

      window.location.reload()
    } catch (error) {
      alert('Failed to delete plan')
      setDeletingId(null)
    }
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-gray-600">No retirement plans yet. Create your first plan to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Link
                href={`/apps/retirement/plans/${plan.id}`}
                className="text-xl font-semibold text-gray-900 hover:text-blue-600"
              >
                {plan.plan_name}
              </Link>
              <p className="mt-1 text-sm text-gray-500">
                Created: {new Date(plan.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/apps/retirement/plans/${plan.id}`}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View Plan
              </Link>
              <button
                onClick={() => handleDelete(plan.id, plan.plan_name)}
                disabled={deletingId === plan.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === plan.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
