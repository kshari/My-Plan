'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'

export default function CreateTeamForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Team name is required'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create team'); return }
      router.push(`/apps/property/teams/${json.team.id}/settings`)
      router.refresh()
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && <ErrorMessage message={error} />}

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="team-name">Team Name <span className="text-destructive">*</span></label>
        <input
          id="team-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Investment Group, Family Portfolio"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="team-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></label>
        <textarea
          id="team-desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this team for?"
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create Team'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
