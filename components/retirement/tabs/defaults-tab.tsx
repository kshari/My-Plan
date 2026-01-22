'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DefaultSetting {
  id?: number
  setting_name: string
  setting_value: number
}

interface DefaultsTabProps {
  planId: number
}

const defaultSettings = [
  { name: 'Growth rate (return) before retirement', default: 0.1 },
  { name: 'Loan rate (if borrowed for expenses)', default: 0.1 },
  { name: 'Growth rate (return) during retirement', default: 0.05 },
  { name: 'Capital gains & dividends blended tax rate', default: 0.2 },
  { name: 'Tax rate during retirement', default: 0.25 },
  { name: 'Inflation', default: 0.04 },
]

export default function DefaultsTab({ planId }: DefaultsTabProps) {
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

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Default Settings</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
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
