import { Skeleton } from "@/components/ui/skeleton"

export default function RetirementPlanLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Tab list skeleton */}
      <div className="flex gap-1 mb-6 border-b pb-px">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl border p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-6 h-64">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}
