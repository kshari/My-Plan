'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileSpreadsheet, FileText, Trash2, Eye, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
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
import { toast } from 'sonner'

interface ImportLoad {
  id: string
  name: string
  file_name: string | null
  file_type: string | null
  property_count: number
  status: string
  created_at: string
}

interface ImportLoadsListProps {
  initialLoads: ImportLoad[]
}

export function ImportLoadsList({ initialLoads }: ImportLoadsListProps) {
  const router = useRouter()
  const [loads, setLoads] = useState(initialLoads)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(loadId: string, deleteProperties: boolean) {
    setDeletingId(loadId)
    try {
      const params = new URLSearchParams({ id: loadId })
      if (deleteProperties) params.set('deleteProperties', 'true')

      const res = await fetch(`/api/property/import-loads?${params}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to delete')
      }
      setLoads((prev) => prev.filter((l) => l.id !== loadId))
      toast.success('Import load deleted')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  if (loads.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        message="No imports yet"
        description="Upload a CSV or PDF file to import properties in bulk."
      />
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="divide-y">
        {loads.map((load) => {
          const FileIcon = load.file_type === 'pdf' ? FileText : FileSpreadsheet
          const busy = deletingId === load.id
          return (
            <div key={load.id} className="flex items-center gap-4 px-4 py-3">
              <FileIcon className={cn(
                'h-5 w-5 shrink-0',
                load.file_type === 'pdf' ? 'text-red-500' : 'text-emerald-500'
              )} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{load.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {load.file_name && <span>{load.file_name}</span>}
                  <span>·</span>
                  <span>{new Date(load.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {load.property_count} {load.property_count === 1 ? 'property' : 'properties'}
              </Badge>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/apps/property/dashboard?load=${load.id}`}>
                  <Button variant="ghost" size="icon-sm" aria-label="View properties">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/apps/property/imports/upload?append=${load.id}`}>
                  <Button variant="ghost" size="icon-sm" aria-label="Append to load">
                    <Upload className="h-4 w-4" />
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="Delete load">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete import &ldquo;{load.name}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Choose whether to also delete the {load.property_count} imported properties or just remove the import record.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-muted text-foreground hover:bg-muted/80"
                        onClick={() => handleDelete(load.id, false)}
                      >
                        Remove Record Only
                      </AlertDialogAction>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => handleDelete(load.id, true)}
                      >
                        Delete Properties Too
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
