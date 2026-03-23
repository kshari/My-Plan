import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Plus, Handshake, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAGE_CONTAINER } from "@/lib/constants/css"
import type { PartnershipEntity } from "@/lib/types/partnerships"
import { ENTITY_TYPE_LABELS } from "@/lib/constants/partnerships"

export default async function PartnershipsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: entities } = await supabase
    .from("pt_entities")
    .select("*")
    .order("created_at", { ascending: false })

  const items = (entities ?? []) as PartnershipEntity[]

  return (
    <div className={PAGE_CONTAINER}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partnerships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group investment entities — LLCs, LPs, and more.
          </p>
        </div>
        <Button asChild>
          <Link href="/apps/partnerships/new">
            <Plus className="h-4 w-4 mr-2" />
            New Entity
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 mb-4">
            <Handshake className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold">No entities yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create your first investment entity — an LLC, LP, or informal group — to start tracking shared investments.
          </p>
          <Button asChild className="mt-6">
            <Link href="/apps/partnerships/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Entity
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((entity) => (
            <Link
              key={entity.id}
              href={`/apps/partnerships/${entity.id}`}
              className="group flex flex-col rounded-xl border bg-card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  entity.status === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : entity.status === "forming"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                </span>
              </div>
              <h2 className="text-base font-semibold tracking-tight group-hover:text-blue-600 transition-colors">
                {entity.name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {ENTITY_TYPE_LABELS[entity.entity_type]}
                {entity.state_of_formation ? ` · ${entity.state_of_formation}` : ""}
              </p>
              {entity.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {entity.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
