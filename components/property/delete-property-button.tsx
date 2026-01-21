'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeletePropertyButtonProps {
  propertyId: number
  propertyName?: string
}

export default function DeletePropertyButton({ propertyId, propertyName }: DeletePropertyButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmMessage = propertyName
      ? `Are you sure you want to delete "${propertyName}"? This will permanently delete this property and all associated financial scenarios and loans. This action cannot be undone.`
      : 'Are you sure you want to delete this property? This will permanently delete this property and all associated financial scenarios and loans. This action cannot be undone.'
    
    if (!confirm(confirmMessage)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/apps/property/properties/${propertyId}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete property')
      }

      router.push('/apps/property/dashboard')
      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to delete property')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? 'Deleting...' : 'Delete Property'}
    </button>
  )
}
