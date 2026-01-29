'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from './scenario-context'
import { Plus, Trash2, Check, X, LineChart } from 'lucide-react'

interface Scenario {
  id: number
  scenario_name: string
  is_default: boolean
  created_at?: string
}

interface ScenarioMetrics {
  scenarioId: number
  retirementAge?: number
  retirementStartYear?: number
  overallScore?: number
  riskLevel?: string
  startingNetworth?: number
  endingNetworth?: number
  growthRateBefore?: number
  growthRateDuring?: number
}

interface ScenariosTableProps {
  planId: number
  onAddScenario?: () => void
  onModelScenarios?: () => void
}

export default function ScenariosTable({ planId, onAddScenario, onModelScenarios }: ScenariosTableProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [metrics, setMetrics] = useState<Map<number, ScenarioMetrics>>(new Map())
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadScenarios()
  }, [planId])

  useEffect(() => {
    if (scenarios.length > 0) {
      loadMetrics()
    }
  }, [scenarios])

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
      
      // Auto-select default scenario if exists
      if (data && data.length > 0 && !selectedScenarioId) {
        const defaultScenario = data.find(s => s.is_default) || data[0]
        setSelectedScenarioId(defaultScenario.id)
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    const metricsMap = new Map<number, ScenarioMetrics>()
    
    for (const scenario of scenarios) {
      try {
        // Load settings for retirement age and growth rates
        const { data: settingsData } = await supabase
          .from('rp_calculator_settings')
          .select('retirement_age, retirement_start_year, growth_rate_before_retirement, growth_rate_during_retirement')
          .eq('scenario_id', scenario.id)
          .maybeSingle()

        // Load projections to calculate score
        const { data: projectionsData } = await supabase
          .from('rp_projection_details')
          .select('*')
          .eq('scenario_id', scenario.id)
          .order('year')

        // Calculate score from projections
        let overallScore: number | undefined
        let riskLevel: string | undefined
        let startingNetworth: number | undefined
        let endingNetworth: number | undefined
        
        if (projectionsData && projectionsData.length > 0) {
          // Calculate score based on projections
          const negativeYears = projectionsData.filter((p: any) => (p.gap_excess || 0) < 0).length
          const sustainabilityScore = Math.max(0, 100 - (negativeYears / projectionsData.length) * 100)
          
          const totalTaxes = projectionsData.reduce((sum: number, p: any) => sum + (p.tax || 0), 0)
          const totalIncome = projectionsData.reduce((sum: number, p: any) => sum + (p.total_income || 0), 0)
          const taxEfficiencyScore = totalIncome > 0 ? Math.max(0, 100 - (totalTaxes / totalIncome) * 100 * 2) : 50
          
          const finalNetworth = projectionsData[projectionsData.length - 1]?.networth || 0
          const initialNetworth = projectionsData[0]?.networth || 0
          const longevityScore = initialNetworth > 0 
            ? Math.min(100, (finalNetworth / initialNetworth) * 50 + 50)
            : 0
          
          overallScore = Math.round(
            sustainabilityScore * 0.5 + 
            taxEfficiencyScore * 0.25 + 
            longevityScore * 0.25
          )
          
          if (overallScore < 50) riskLevel = 'High'
          else if (overallScore < 75) riskLevel = 'Medium'
          else riskLevel = 'Low'
          
          // Get starting networth at retirement age, ending networth at final age
          const retirementAge = settingsData?.retirement_age
          if (retirementAge) {
            // Find projection at retirement age
            const retirementProjection = projectionsData.find((p: any) => p.age === retirementAge)
            startingNetworth = retirementProjection?.networth || projectionsData[0]?.networth || 0
          } else {
            // Fallback to first projection if retirement age not found
            startingNetworth = initialNetworth
          }
          endingNetworth = finalNetworth
        }

        metricsMap.set(scenario.id, {
          scenarioId: scenario.id,
          retirementAge: settingsData?.retirement_age,
          retirementStartYear: settingsData?.retirement_start_year,
          overallScore,
          riskLevel,
          startingNetworth,
          endingNetworth,
          growthRateBefore: settingsData?.growth_rate_before_retirement,
          growthRateDuring: settingsData?.growth_rate_during_retirement,
        })
      } catch (error) {
        console.error(`Error loading metrics for scenario ${scenario.id}:`, error)
      }
    }
    
    setMetrics(metricsMap)
  }

  const handleDeleteScenario = async (scenarioId: number) => {
    if (!confirm('Delete this scenario? All associated data (settings, projections) will be deleted.')) {
      return
    }

    setDeleting(scenarioId)
    try {
      // Delete associated data first
      await supabase.from('rp_projection_details').delete().eq('scenario_id', scenarioId)
      await supabase.from('rp_calculator_settings').delete().eq('scenario_id', scenarioId)
      
      // Delete the scenario
      const { error } = await supabase
        .from('rp_scenarios')
        .delete()
        .eq('id', scenarioId)

      if (error) throw error

      // Reload scenarios
      await loadScenarios()
      
      // If deleted scenario was selected, select first remaining scenario
      if (selectedScenarioId === scenarioId) {
        const remaining = scenarios.filter(s => s.id !== scenarioId)
        if (remaining.length > 0) {
          setSelectedScenarioId(remaining[0].id)
        } else {
          setSelectedScenarioId(null)
        }
      }
    } catch (error: any) {
      alert(`Failed to delete scenario: ${error.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteAllScenarios = async () => {
    if (!confirm('Delete ALL scenarios? This will delete all scenarios and their associated data. This action cannot be undone.')) {
      return
    }

    try {
      // Delete all projections and settings for all scenarios
      for (const scenario of scenarios) {
        await supabase.from('rp_projection_details').delete().eq('scenario_id', scenario.id)
        await supabase.from('rp_calculator_settings').delete().eq('scenario_id', scenario.id)
      }
      
      // Delete all scenarios
      const { error } = await supabase
        .from('rp_scenarios')
        .delete()
        .eq('plan_id', planId)

      if (error) throw error

      setSelectedScenarioId(null)
      await loadScenarios()
      alert('All scenarios deleted successfully')
    } catch (error: any) {
      alert(`Failed to delete scenarios: ${error.message}`)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-600">Loading scenarios...</div>
  }

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No scenarios yet. Create your first scenario in Plan Details.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Scenarios</h3>
        <div className="flex gap-2">
          {onModelScenarios && (
            <button
              onClick={onModelScenarios}
              className="flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200"
            >
              <LineChart className="w-4 h-4" />
              Scenario Modeling
            </button>
          )}
          {onAddScenario && (
            <button
              onClick={onAddScenario}
              className="flex items-center gap-2 rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
            >
              <Plus className="w-4 h-4" />
              Add Scenario
            </button>
          )}
          {scenarios.length > 0 && (
            <button
              onClick={handleDeleteAllScenarios}
              className="flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Scenarios
            </button>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 md:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scenario</th>
            <th className="px-2 md:px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Retirement Age</th>
            <th className="hidden md:table-cell px-2 md:px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Growth Rates</th>
            <th className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Starting Networth</th>
            <th className="px-2 md:px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ending Networth</th>
            <th className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score</th>
            <th className="hidden md:table-cell px-2 md:px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
            <th className="px-2 md:px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {scenarios.map((scenario) => {
            const scenarioMetrics = metrics.get(scenario.id)
            const isSelected = selectedScenarioId === scenario.id
            
            return (
              <tr
                key={scenario.id}
                className={`cursor-pointer hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => setSelectedScenarioId(scenario.id)}
              >
                <td className="px-2 md:px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {scenario.scenario_name}
                    </span>
                    {scenario.is_default && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Default
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 md:px-3 py-3 text-right text-sm text-gray-900">
                  {scenarioMetrics?.retirementAge || '-'}
                </td>
                <td className="hidden md:table-cell px-2 md:px-3 py-3 text-center text-sm text-gray-900">
                  {scenarioMetrics?.growthRateBefore !== undefined && scenarioMetrics?.growthRateDuring !== undefined ? (
                    <span>
                      {(scenarioMetrics.growthRateBefore * 100).toFixed(2)}% / {(scenarioMetrics.growthRateDuring * 100).toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-sm text-gray-900">
                  {scenarioMetrics?.startingNetworth !== undefined ? (
                    `$${scenarioMetrics.startingNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 md:px-3 py-3 text-right text-sm text-gray-900">
                  {scenarioMetrics?.endingNetworth !== undefined ? (
                    `$${scenarioMetrics.endingNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="hidden md:table-cell px-2 md:px-3 py-3 text-right text-sm">
                  {scenarioMetrics?.overallScore !== undefined ? (
                    <span className={`font-semibold ${
                      scenarioMetrics.overallScore >= 75 ? 'text-green-600' :
                      scenarioMetrics.overallScore >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {scenarioMetrics.overallScore}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="hidden md:table-cell px-2 md:px-3 py-3 text-center">
                  {scenarioMetrics?.riskLevel ? (
                    <span className={`text-xs px-2 py-1 rounded ${
                      scenarioMetrics.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
                      scenarioMetrics.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {scenarioMetrics.riskLevel}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-2 md:px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedScenarioId(scenario.id)
                      }}
                      className={`flex items-center gap-1.5 text-sm px-2 md:px-3 py-1 rounded ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      title={isSelected ? 'Selected' : 'Select'}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span className="hidden md:inline">{isSelected ? 'Selected' : 'Select'}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteScenario(scenario.id)
                      }}
                      disabled={deleting === scenario.id}
                      className="flex items-center gap-1.5 text-sm px-2 md:px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      title={deleting === scenario.id ? 'Deleting...' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">{deleting === scenario.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
