'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopyToPersonalButtonProps {
  teamId: string
  sharedPropertyId: number
}

export default function CopyToPersonalButton({ teamId, sharedPropertyId }: CopyToPersonalButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCopy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/copy-to-personal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedPropertyId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Copy failed'); return }
      setDone(true)
      // Navigate to the newly copied personal property
      router.push(`/apps/property/properties/${json.propertyId}`)
      router.refresh()
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Button variant="outline" disabled>
        <Check className="h-4 w-4 mr-2 text-emerald-600" />
        Copied to My List
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" onClick={handleCopy} disabled={loading}>
        <Copy className="h-4 w-4 mr-2" />
        {loading ? 'Copying…' : 'Copy to My List'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
