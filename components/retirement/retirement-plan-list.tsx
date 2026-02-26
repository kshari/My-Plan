'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Calendar, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    setDeletingId(planId)
    try {
      const response = await fetch(`/apps/retirement/plans/${planId}/delete`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete plan')
      toast.success(`"${planName}" deleted`)
      window.location.reload()
    } catch (error) {
      toast.error('Failed to delete plan')
      setDeletingId(null)
    }
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 py-16 text-center">
        <Target className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">No retirement plans yet.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Create your first plan to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="group relative rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <Badge variant="secondary" className="text-[10px]">Retirement Plan</Badge>
          </div>

          <Link
            href={`/apps/retirement/plans/${plan.id}`}
            className="block font-semibold text-base group-hover:text-primary transition-colors"
          >
            {plan.plan_name}
          </Link>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            Created {new Date(plan.created_at).toLocaleDateString()}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Link
              href={`/apps/retirement/plans/${plan.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              View Plan <ArrowRight className="h-3 w-3" />
            </Link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={deletingId === plan.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{plan.plan_name}</strong> and all associated scenarios, settings, and projections.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(plan.id, plan.plan_name)}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {deletingId === plan.id ? 'Deleting…' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  )
}
