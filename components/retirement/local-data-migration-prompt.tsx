'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLocalPlanData, migrateLocalToSupabase } from '@/lib/storage/migration'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, X, Loader2 } from 'lucide-react'

/**
 * Shown on the dashboard when a logged-in user has local plan data in localStorage.
 * Offers to import the data into their account.
 */
export default function LocalDataMigrationPrompt() {
  const router = useRouter()
  const [hasLocalData, setHasLocalData] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const data = getLocalPlanData()
    setHasLocalData(data !== null)
  }, [])

  if (!hasLocalData || dismissed) return null

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const localData = getLocalPlanData()
      if (!localData) return

      const planId = await migrateLocalToSupabase(supabase, user.id, localData)
      if (planId) {
        setHasLocalData(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Migration error:', error)
    } finally {
      setMigrating(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  return (
    <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50 shrink-0 mt-0.5">
            <Upload className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Import your local plan data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              We found plan data saved in your browser from before you signed up.
              Import it into your account to keep it permanently.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={handleDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2 mt-3 ml-12">
        <Button size="sm" onClick={handleMigrate} disabled={migrating} className="gap-1.5">
          {migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {migrating ? 'Importing…' : 'Import Data'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={migrating}>
          Not now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={migrating}
          onClick={() => {
            try { localStorage.removeItem('rp_local_plan') } catch {}
            setHasLocalData(false)
            toast.success('Try mode data cleared.')
          }}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Clear Data
        </Button>
      </div>
    </div>
  )
}
