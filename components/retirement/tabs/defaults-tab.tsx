'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOptionalDataService } from '@/lib/storage'
import { DEFAULT_SETTINGS_LIST } from '@/lib/constants/retirement-defaults'
import { Save } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'

/** Maps DEFAULT_SETTINGS_LIST names to CalculatorSettings keys for DataService */
const SETTING_NAME_TO_KEY: Record<string, string> = {
  'Growth rate (return) before retirement': 'growth_rate_before_retirement',
  'Loan rate (if borrowed for expenses)': 'debt_interest_rate',
  'Growth rate (return) during retirement': 'growth_rate_during_retirement',
  'Capital gains & dividends blended tax rate': 'capital_gains_tax_rate',
  'Tax rate during retirement': 'income_tax_rate_retirement',
  'Inflation': 'inflation_rate',
}

interface DefaultSetting {
  id?: number
  setting_name: string
  setting_value: number
}

interface DefaultsTabProps {
  planId: number
}

const defaultSettings = DEFAULT_SETTINGS_LIST.map(s => ({ name: s.name, default: s.default }))

export default function DefaultsTab({ planId }: DefaultsTabProps) {
  const dataService = useOptionalDataService()
  const isLocal = dataService?.mode === 'local'
  const supabase = createClient()
  const [settings, setSettings] = useState<DefaultSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [planId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      if (isLocal && dataService) {
        const stored = await dataService.getSettings()
        const allSettings = defaultSettings.map((def) => {
          const key = SETTING_NAME_TO_KEY[def.name]
          const value = key && stored && (stored as Record<string, number>)[key]
          return {
            setting_name: def.name,
            setting_value: typeof value === 'number' ? value : def.default,
            plan_id: planId,
          }
        })
        setSettings(allSettings)
        return
      }

      const { data, error } = await supabase
        .from('rp_default_settings')
        .select('*')
        .eq('plan_id', planId)

      if (error) throw error

      // Initialize with defaults if not present
      const existingSettings = data || []
      const allSettings = defaultSettings.map((def) => {
        const existing = existingSettings.find((s: DefaultSetting) => s.setting_name === def.name)
        return existing || { setting_name: def.name, setting_value: def.default, plan_id: planId }
      })

      setSettings(allSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isLocal && dataService) {
        const toSave: Record<string, number> = {}
        for (const s of settings) {
          const key = SETTING_NAME_TO_KEY[s.setting_name]
          if (key) toSave[key] = s.setting_value
        }
        await dataService.saveSettings(toSave)
        alert('Settings saved successfully!')
        return
      }

      for (const setting of settings) {
        const { error } = await supabase
          .from('rp_default_settings')
          .upsert({
            plan_id: planId,
            setting_name: setting.setting_name,
            setting_value: setting.setting_value,
          }, {
            onConflict: 'plan_id,setting_name'
          })

        if (error) throw error
      }
      alert('Settings saved successfully!')
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Default Settings</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      <div className="space-y-4">
        {settings.map((setting, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <label className="block text-sm font-medium text-gray-700">
              {setting.setting_name}
            </label>
            <input
              type="number"
              step="0.01"
              value={setting.setting_value}
              onChange={(e) => {
                const newSettings = [...settings]
                newSettings[index].setting_value = parseFloat(e.target.value) || 0
                setSettings(newSettings)
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
