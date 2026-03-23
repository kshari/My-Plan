"use client"

import { cn } from "@/lib/utils"
import { WORKFLOW_STAGES, WORKFLOW_STAGE_LABELS } from "@/lib/constants/partnerships"
import type { WorkflowStage } from "@/lib/types/partnerships"
import { Check } from "lucide-react"

interface WorkflowStepperProps {
  currentStage: WorkflowStage
  compact?: boolean
}

export function WorkflowStepper({ currentStage, compact = false }: WorkflowStepperProps) {
  const currentIndex = WORKFLOW_STAGES.indexOf(currentStage)

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {WORKFLOW_STAGES.map((stage, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <div key={stage} className="flex items-center gap-0.5 shrink-0">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  done ? "bg-emerald-500 w-6" : active ? "bg-blue-600 w-6" : "bg-muted w-4"
                )}
              />
            </div>
          )
        })}
        <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
          {WORKFLOW_STAGE_LABELS[currentStage]}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-start min-w-max">
        {WORKFLOW_STAGES.map((stage, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const isLast = i === WORKFLOW_STAGES.length - 1
          return (
            <div key={stage} className="flex items-start">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : active
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-background border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] text-center w-16 leading-tight",
                    active ? "text-blue-600 font-semibold" : done ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  {WORKFLOW_STAGE_LABELS[stage]}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mt-3.5 h-0.5 w-8 transition-all",
                    done ? "bg-emerald-500" : "bg-border"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
