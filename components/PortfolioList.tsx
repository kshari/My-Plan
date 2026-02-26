'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Briefcase, Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface Portfolio {
  id: string
  name: string
  description?: string
  created_at: string
}

interface PortfolioListProps {
  portfolios: Portfolio[]
  onSelectPortfolio: (id: string) => void
  onUpdate: () => void
}

export default function PortfolioList({ portfolios, onSelectPortfolio, onUpdate }: PortfolioListProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('pa_portfolios').insert({
        name,
        description: description || null,
        user_id: user.id,
      })
      if (error) throw error
      toast.success(`Portfolio "${name}" created`)
      setName('')
      setDescription('')
      setShowForm(false)
      onUpdate()
    } catch (error: any) {
      toast.error(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Your Portfolios</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Create Portfolio'}
        </Button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-xl border bg-muted/30 p-5">
          <h3 className="mb-4 font-semibold text-sm">New Portfolio</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="port-name">Portfolio Name *</Label>
              <Input
                id="port-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Growth Portfolio"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port-desc">Description (optional)</Label>
              <Textarea
                id="port-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Long-term growth strategy…"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowForm(false); setName(''); setDescription('') }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Creating…' : 'Create Portfolio'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 py-16 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No portfolios yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create your first portfolio to get started.</p>
          {!showForm && (
            <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Create Portfolio
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              onClick={() => onSelectPortfolio(portfolio.id)}
              className="group text-left rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Briefcase className="h-4 w-4 text-primary" />
                </div>
                <Badge variant="secondary" className="text-[10px]">Portfolio</Badge>
              </div>
              <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-1">
                {portfolio.name}
              </h3>
              {portfolio.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{portfolio.description}</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Calendar className="h-3 w-3" />
                {new Date(portfolio.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
