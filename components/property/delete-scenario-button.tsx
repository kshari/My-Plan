'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteScenarioButtonProps {
  propertyId: number
  scenarioId: number
  scenarioName?: string
}

export default function DeleteScenarioButton({ propertyId, scenarioId, scenarioName }: DeleteScenarioButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmMessage = scenarioName 
      ? `Are you sure you want to delete "${scenarioName}"? This will also delete all associated loan information. This action cannot be undone.`
      : 'Are you sure you want to delete this scenario? This will also delete all associated loan information. This action cannot be undone.'
    
    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/apps/property/properties/${propertyId}/scenarios/${scenarioId}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete scenario')
      }

      router.push(`/apps/property/properties/${propertyId}`)
      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to delete scenario')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-600 hover:text-red-900 text-sm disabled:opacity-50"
    >
      {loading ? 'Deleting...' : 'Delete'}
    </button>
  )
}
