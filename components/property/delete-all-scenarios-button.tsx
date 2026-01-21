'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteAllScenariosButtonProps {
  propertyId: number
  scenarioCount: number
}

export default function DeleteAllScenariosButton({ propertyId, scenarioCount }: DeleteAllScenariosButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDeleteAll = async () => {
    if (scenarioCount === 0) {
      return
    }

    const confirmMessage = `Are you sure you want to delete all ${scenarioCount} scenario${scenarioCount > 1 ? 's' : ''}? This will also delete all associated loan information. This action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/apps/property/properties/${propertyId}/scenarios/delete-all`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete all scenarios')
      }

      router.refresh()
      alert(`Successfully deleted all ${scenarioCount} scenario${scenarioCount > 1 ? 's' : ''}.`)
    } catch (error: any) {
      alert(error.message || 'Failed to delete all scenarios')
      setLoading(false)
    }
  }

  if (scenarioCount === 0) {
    return null
  }

  return (
    <button
      onClick={handleDeleteAll}
      disabled={loading}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Deleting...' : 'Delete All Scenarios'}
    </button>
  )
}
