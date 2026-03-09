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

interface DeleteScenarioButtonProps {
  propertyId: number
  scenarioId: number
  scenarioName?: string
}

export default function DeleteScenarioButton({ propertyId, scenarioId, scenarioName }: DeleteScenarioButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
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
      toast.error(error.message || 'Failed to delete scenario')
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={loading}
          className="text-red-600 hover:text-red-900 text-sm disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
          <AlertDialogDescription>
            {scenarioName
              ? <>Are you sure you want to delete <strong>&quot;{scenarioName}&quot;</strong>? This will also delete all associated loan information.</>
              : 'Are you sure you want to delete this scenario? This will also delete all associated loan information.'}
            {' '}This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
