'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('pa_portfolios')
        .insert({
          name,
          description: description || null,
          user_id: user.id,
        })

      if (error) throw error

      setName('')
      setDescription('')
      setShowCreateModal(false)
      onUpdate()
    } catch (error: any) {
      alert(`Error creating portfolio: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Portfolios</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Portfolio
        </button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Create New Portfolio</h3>
            <form onSubmit={handleCreatePortfolio}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Portfolio Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setName('')
                    setDescription('')
                  }}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">No portfolios yet. Create your first portfolio to get started!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              onClick={() => onSelectPortfolio(portfolio.id)}
              className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
            >
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{portfolio.name}</h3>
              {portfolio.description && (
                <p className="mb-4 text-sm text-gray-600">{portfolio.description}</p>
              )}
              <p className="text-xs text-gray-400">
                Created {new Date(portfolio.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
