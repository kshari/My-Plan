'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Account {
  id?: number
  account_name: string
  owner: string
  balance: number
  account_type?: string
}

interface AccountsTabProps {
  planId: number
}

export default function AccountsTab({ planId }: AccountsTabProps) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [planId])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rp_accounts')
        .select('*')
        .eq('plan_id', planId)
        .order('id')

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (account: Account) => {
    setSaving(true)
    try {
      if (editingAccount?.id) {
        const { error } = await supabase
          .from('rp_accounts')
          .update(account)
          .eq('id', editingAccount.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rp_accounts')
          .insert([{ ...account, plan_id: planId }])
        if (error) throw error
      }
      setShowForm(false)
      setEditingAccount(null)
      loadAccounts()
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return
    try {
      const { error } = await supabase
        .from('rp_accounts')
        .delete()
        .eq('id', id)
      if (error) throw error
      loadAccounts()
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Retirement Accounts</h3>
        <button
          onClick={() => {
            setEditingAccount(null)
            setShowForm(true)
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Account
        </button>
      </div>

      {showForm && (
        <AccountForm
          account={editingAccount || { account_name: '', owner: '', balance: 0 }}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingAccount(null)
          }}
          saving={saving}
        />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-4 py-3 text-sm">{account.account_name}</td>
                <td className="px-4 py-3 text-sm">{account.owner}</td>
                <td className="px-4 py-3 text-sm text-right">${account.balance.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{account.account_type || '-'}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => {
                      setEditingAccount(account)
                      setShowForm(true)
                    }}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => account.id && handleDelete(account.id)}
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

function AccountForm({ account, onSave, onCancel, saving }: any) {
  const [formData, setFormData] = useState(account)

  return (
    <div className="mb-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-3 font-medium">{account.id ? 'Edit Account' : 'New Account'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Name</label>
          <input
            type="text"
            value={formData.account_name}
            onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Owner</label>
          <input
            type="text"
            value={formData.owner}
            onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Balance</label>
          <input
            type="number"
            step="0.01"
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Type</label>
          <select
            value={formData.account_type || ''}
            onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Select type</option>
            <option value="IRA">IRA</option>
            <option value="401k">401k</option>
            <option value="Roth IRA">Roth IRA</option>
            <option value="HSA">HSA</option>
            <option value="Taxable">Taxable</option>
            <option value="Other">Other</option>
          </select>
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
