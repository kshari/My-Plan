'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Expense {
  id?: number
  expense_name: string
  amount_after_65: number
  amount_before_65: number
}

interface ExpensesTabProps {
  planId: number
}

export default function ExpensesTab({ planId }: ExpensesTabProps) {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [planId])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rp_expenses')
        .select('*')
        .eq('plan_id', planId)
        .order('id')

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (expense: Expense) => {
    setSaving(true)
    try {
      if (editingExpense?.id) {
        const { error } = await supabase
          .from('rp_expenses')
          .update(expense)
          .eq('id', editingExpense.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rp_expenses')
          .insert([{ ...expense, plan_id: planId }])
        if (error) throw error
      }
      setShowForm(false)
      setEditingExpense(null)
      loadExpenses()
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try {
      const { error } = await supabase
        .from('rp_expenses')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadExpenses()
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Expenses</h3>
        <button
          onClick={() => {
            setEditingExpense(null)
            setShowForm(true)
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Expense
        </button>
      </div>

      {showForm && (
        <ExpenseForm
          expense={editingExpense || { expense_name: '', amount_after_65: 0, amount_before_65: 0 }}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingExpense(null)
          }}
          saving={saving}
        />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">After 65</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Before 65</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-4 py-3 text-sm">{expense.expense_name}</td>
                <td className="px-4 py-3 text-sm text-right">${expense.amount_after_65.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">${expense.amount_before_65.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => {
                      setEditingExpense(expense)
                      setShowForm(true)
                    }}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => expense.id && handleDelete(expense.id)}
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

function ExpenseForm({ expense, onSave, onCancel, saving }: any) {
  const [formData, setFormData] = useState(expense)

  return (
    <div className="mb-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-3 font-medium">{expense.id ? 'Edit Expense' : 'New Expense'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Expense Name</label>
          <input
            type="text"
            value={formData.expense_name}
            onChange={(e) => setFormData({ ...formData, expense_name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount After 65</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount_after_65}
            onChange={(e) => setFormData({ ...formData, amount_after_65: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount Before 65</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount_before_65}
            onChange={(e) => setFormData({ ...formData, amount_before_65: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onSave(formData)}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
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
