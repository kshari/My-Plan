'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface DeleteAllScenariosButtonProps {
  propertyId: number
  scenarioCount: number
}

export default function DeleteAllScenariosButton({ propertyId, scenarioCount }: DeleteAllScenariosButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDeleteAll = async () => {
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
      toast.success(`Successfully deleted all ${scenarioCount} scenario${scenarioCount > 1 ? 's' : ''}.`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete all scenarios')
      setLoading(false)
    }
  }

  if (scenarioCount === 0) {
    return null
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={loading}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Deleting...' : 'Delete All Scenarios'}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all scenarios?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete all {scenarioCount} scenario{scenarioCount > 1 ? 's' : ''}? This will also delete all associated loan information. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
