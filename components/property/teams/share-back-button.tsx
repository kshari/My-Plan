'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Team {
  id: string
  name: string
}

interface ShareBackButtonProps {
  propertyId: number
  teams: Team[]
}

export default function ShareBackButton({ propertyId, teams }: ShareBackButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!teams.length) return null

  async function handleShareTo(teamId: string, teamName: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/share-back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Share failed'); return }
      setDone(teamName)
      setOpen(false)
      router.refresh()
    } catch {
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Button variant="outline" disabled size="sm">
        <Check className="h-4 w-4 mr-2 text-emerald-600" />
        Shared to {done}
      </Button>
    )
  }

  if (teams.length === 1) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="outline" size="sm" onClick={() => handleShareTo(teams[0].id, teams[0].name)} disabled={loading}>
          <Share2 className="h-4 w-4 mr-2" />
          {loading ? 'Sharing…' : `Share to ${teams[0].name}`}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen(v => !v)} disabled={loading}>
        <Share2 className="h-4 w-4 mr-2" />
        Share to Team
        <ChevronDown className="h-3.5 w-3.5 ml-1" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 w-56 rounded-lg border bg-background shadow-lg py-1">
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => handleShareTo(team.id, team.name)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
