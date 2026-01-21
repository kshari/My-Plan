'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteLoanButtonProps {
  propertyId: number
  scenarioId: number
}

export default function DeleteLoanButton({ propertyId, scenarioId }: DeleteLoanButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmMessage = 'Are you sure you want to delete the loan information for this scenario? This action cannot be undone.'
    
    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/apps/property/properties/${propertyId}/scenarios/${scenarioId}/loan/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete loan')
      }

      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to delete loan')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? 'Deleting...' : 'Delete Loan'}
    </button>
  )
}
