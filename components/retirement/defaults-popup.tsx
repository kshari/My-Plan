'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DefaultSetting {
  id?: number
  setting_name: string
  setting_value: number
}

interface DefaultsPopupProps {
  planId: number
  isOpen: boolean
  onClose: () => void
}

const defaultSettings = [
  { name: 'Growth rate (return) before retirement', default: 10, unit: '%' },
  { name: 'Loan rate (if borrowed for expenses)', default: 10, unit: '%' },
  { name: 'Growth rate (return) during retirement', default: 5, unit: '%' },
  { name: 'Capital gains & dividends blended tax rate', default: 20, unit: '%' },
  { name: 'Tax rate during retirement', default: 25, unit: '%' },
  { name: 'Inflation', default: 4, unit: '%' },
]

export default function DefaultsPopup({ planId, isOpen, onClose }: DefaultsPopupProps) {
  const supabase = createClient()
  const [settings, setSettings] = useState<DefaultSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [planId, isOpen])

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
      alert('Default settings saved successfully!')
      onClose()
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Default Settings</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {settings.map((setting, index) => {
                  const defaultSetting = defaultSettings.find(d => d.name === setting.setting_name)
                  return (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label className="block text-sm font-medium text-gray-700">
                        {setting.setting_name}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={setting.setting_value}
                          onChange={(e) => {
                            const newSettings = [...settings]
                            newSettings[index].setting_value = parseFloat(e.target.value) || 0
                            setSettings(newSettings)
                          }}
                          className="block w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                        <span className="text-sm text-gray-500">{defaultSetting?.unit || '%'}</span>
                      </div>
                      <button
                        onClick={() => {
                          const newSettings = [...settings]
                          newSettings[index].setting_value = defaultSetting?.default || 0
                          setSettings(newSettings)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Reset to {defaultSetting?.default || 0}%
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
