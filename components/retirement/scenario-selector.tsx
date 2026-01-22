'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from './scenario-context'

interface Scenario {
  id: number
  scenario_name: string
  is_default: boolean
}

interface ScenarioSelectorProps {
  planId: number
  selectedScenarioId: number | null
  onScenarioChange: (scenarioId: number) => void
}

// Standalone version for use outside context
export default function ScenarioSelector({ planId, selectedScenarioId, onScenarioChange }: ScenarioSelectorProps) {
  const supabase = createClient()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')

  useEffect(() => {
    loadScenarios()
  }, [planId])

  const loadScenarios = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('*')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setScenarios(data || [])
      
      // Auto-select default scenario or first scenario
      if (data && data.length > 0 && !selectedScenarioId) {
        const defaultScenario = data.find(s => s.is_default) || data[0]
        onScenarioChange(defaultScenario.id)
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateScenario = async () => {
    if (!newScenarioName.trim()) {
      alert('Please enter a scenario name')
      return
    }

    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .insert([{
          plan_id: planId,
          scenario_name: newScenarioName.trim(),
          is_default: scenarios.length === 0 // First scenario is default
        }])
        .select()
        .single()

      if (error) throw error
      
      setNewScenarioName('')
      setShowForm(false)
      loadScenarios()
      onScenarioChange(data.id)
    } catch (error: any) {
      alert(`Failed to create scenario: ${error.message}`)
    }
  }

  const handleDeleteScenario = async (scenarioId: number) => {
    if (!confirm('Delete this scenario? All associated data will be deleted.')) return
    
    try {
      const { error } = await supabase
        .from('rp_scenarios')
        .delete()
        .eq('id', scenarioId)

      if (error) throw error
      
      loadScenarios()
      // Select first remaining scenario
      const remaining = scenarios.filter(s => s.id !== scenarioId)
      if (remaining.length > 0) {
        onScenarioChange(remaining[0].id)
      }
    } catch (error: any) {
      alert(`Failed to delete scenario: ${error.message}`)
    }
  }

  const handleSetDefault = async (scenarioId: number) => {
    try {
      // Remove default from all scenarios
      await supabase
        .from('rp_scenarios')
        .update({ is_default: false })
        .eq('plan_id', planId)

      // Set new default
      const { error } = await supabase
        .from('rp_scenarios')
        .update({ is_default: true })
        .eq('id', scenarioId)

      if (error) throw error
      loadScenarios()
    } catch (error: any) {
      alert(`Failed to set default: ${error.message}`)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-600">Loading scenarios...</div>
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">Scenario:</label>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Scenario'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newScenarioName}
            onChange={(e) => setNewScenarioName(e.target.value)}
            placeholder="Scenario name"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateScenario()}
          />
          <button
            onClick={handleCreateScenario}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Create
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
              selectedScenarioId === scenario.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white'
            }`}
          >
            <button
              onClick={() => onScenarioChange(scenario.id)}
              className="text-sm font-medium text-gray-900"
            >
              {scenario.scenario_name}
              {scenario.is_default && (
                <span className="ml-2 text-xs text-gray-500">(Default)</span>
              )}
            </button>
            {scenarios.length > 1 && (
              <>
                {!scenario.is_default && (
                  <button
                    onClick={() => handleSetDefault(scenario.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    title="Set as default"
                  >
                    ⭐
                  </button>
                )}
                <button
                  onClick={() => handleDeleteScenario(scenario.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                  title="Delete scenario"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {scenarios.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">
          No scenarios yet. Create your first scenario to get started.
        </p>
      )}
    </div>
  )
}
