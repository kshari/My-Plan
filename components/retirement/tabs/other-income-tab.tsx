'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOptionalDataService } from '@/lib/storage'
import { Plus, Save } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'

interface OtherIncome {
  id?: number | string
  income_source: string
  annual_amount: number
}

interface OtherIncomeTabProps {
  planId: number
}

export default function OtherIncomeTab({ planId }: OtherIncomeTabProps) {
  const dataService = useOptionalDataService()
  const isLocal = dataService?.mode === 'local'
  const supabase = createClient()
  const [incomes, setIncomes] = useState<OtherIncome[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null)

  useEffect(() => {
    loadIncomes()
  }, [planId])

  const loadIncomes = async () => {
    setLoading(true)
    try {
      if (isLocal && dataService) {
        const data = await dataService.getOtherIncome()
        setIncomes(
          data.map((i) => ({
            id: (i as { id?: number }).id ?? (i as { _localId?: string })._localId,
            income_source: (i as { income_name?: string }).income_name ?? (i as { income_source?: string }).income_source ?? '',
            annual_amount: (i as { amount?: number }).amount ?? (i as { annual_amount?: number }).annual_amount ?? 0,
          }))
        )
        return
      }

      const { data, error } = await supabase
        .from('rp_other_income')
        .select('*')
        .eq('plan_id', planId)
        .order('id')

      if (error) throw error
      setIncomes(data || [])
    } catch (error) {
      console.error('Error loading income:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (income: OtherIncome) => {
    setSaving(true)
    try {
      if (isLocal && dataService) {
        const toSave = {
          income_name: income.income_source,
          amount: income.annual_amount,
          ...(editingIncome?.id != null && { id: editingIncome.id }),
        }
        await dataService.saveOtherIncome(toSave as Parameters<typeof dataService.saveOtherIncome>[0])
        setShowForm(false)
        setEditingIncome(null)
        loadIncomes()
        return
      }

      if (editingIncome?.id) {
        const { error } = await supabase
          .from('rp_other_income')
          .update(income)
          .eq('id', editingIncome.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rp_other_income')
          .insert([{ ...income, plan_id: planId }])
        if (error) throw error
      }
      setShowForm(false)
      setEditingIncome(null)
      loadIncomes()
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number | string) => {
    if (!confirm('Delete this income source?')) return
    try {
      if (isLocal && dataService) {
        await dataService.deleteOtherIncome(id)
        loadIncomes()
        return
      }

      const { error } = await supabase
        .from('rp_other_income')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadIncomes()
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Other Income Sources</h3>
        <button
          onClick={() => {
            setEditingIncome(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
        >
          Add Income Source
        </button>
      </div>

      {showForm && (
        <IncomeForm
          income={editingIncome || { income_source: '', annual_amount: 0 }}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingIncome(null)
          }}
          saving={saving}
        />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Income Source</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Annual Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {incomes.map((income) => (
              <tr key={income.id}>
                <td className="px-4 py-3 text-sm">{income.income_source}</td>
                <td className="px-4 py-3 text-sm text-right">${income.annual_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => {
                      setEditingIncome(income)
                      setShowForm(true)
                    }}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => income.id && handleDelete(income.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IncomeForm({ income, onSave, onCancel, saving }: any) {
  const [formData, setFormData] = useState(income)

  return (
    <div className="mb-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-3 font-medium">{income.id ? 'Edit Income' : 'New Income'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Income Source</label>
          <input
            type="text"
            value={formData.income_source}
            onChange={(e) => setFormData({ ...formData, income_source: e.target.value })}
            placeholder="Options Income, Rental, etc."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.annual_amount}
            onChange={(e) => setFormData({ ...formData, annual_amount: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onSave(formData)}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
