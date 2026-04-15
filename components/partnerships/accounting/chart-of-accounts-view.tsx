"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Account, AccountType } from "@/lib/types/partnerships"

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-blue-100 text-blue-800",
  liability: "bg-red-100 text-red-800",
  equity: "bg-purple-100 text-purple-800",
  income: "bg-green-100 text-green-800",
  expense: "bg-orange-100 text-orange-800",
}

const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"]
const TYPE_LABELS: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
}

function buildTree(flat: Account[]): Account[] {
  const map: Record<string, Account> = {}
  for (const a of flat) map[a.id] = { ...a, children: [] }
  const roots: Account[] = []
  for (const a of flat) {
    if (a.parent_id && map[a.parent_id]) {
      map[a.parent_id].children!.push(map[a.id])
    } else {
      roots.push(map[a.id])
    }
  }
  return roots
}

interface AddAccountForm {
  account_code: string
  name: string
  type: AccountType
  subtype: string
  description: string
  parent_id: string
}

const EMPTY_FORM: AddAccountForm = {
  account_code: "",
  name: "",
  type: "asset",
  subtype: "",
  description: "",
  parent_id: "",
}

export function ChartOfAccountsView() {
  const { entityId } = useParams<{ entityId: string }>()
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [tree, setTree] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddAccountForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/accounts`)
    const json = await res.json()
    const flat: Account[] = json.accounts ?? []
    setAccounts(flat)
    setTree(buildTree(flat))
    setLoading(false)
  }, [entityId])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/partnerships/${entityId}/accounting/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShowAdd(false)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  async function handleDeactivate(id: string) {
    await fetch(`/api/partnerships/${entityId}/accounting/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    })
    load()
  }

  async function handleRename(id: string) {
    await fetch(`/api/partnerships/${entityId}/accounting/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    })
    setEditId(null)
    load()
  }

  const grouped: Record<AccountType, Account[]> = { asset: [], liability: [], equity: [], income: [], expense: [] }
  for (const a of tree) {
    if (grouped[a.type as AccountType]) grouped[a.type as AccountType].push(a)
  }

  function AccountRow({ account, depth = 0 }: { account: Account; depth?: number }) {
    const isEditing = editId === account.id
    return (
      <>
        <tr className={`border-b border-gray-100 ${!account.is_active ? "opacity-40" : "hover:bg-gray-50"}`}>
          <td className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  className="text-sm border rounded px-2 py-0.5 w-48"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(account.id); if (e.key === "Escape") setEditId(null) }}
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium text-gray-900">{account.name}</span>
              )}
              {account.is_system && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">system</span>
              )}
              {!account.is_active && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inactive</span>
              )}
            </div>
          </td>
          <td className="px-4 py-2 text-xs text-gray-500 font-mono">{account.account_code}</td>
          <td className="px-4 py-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[account.type as AccountType]}`}>
              {account.type}
            </span>
          </td>
          <td className="px-4 py-2 text-xs text-gray-500">{account.subtype ?? "—"}</td>
          <td className="px-4 py-2">
            <div className="flex gap-2">
              {!account.is_system && account.is_active && (
                <>
                  <button
                    onClick={() => { setEditId(account.id); setEditName(account.name) }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeactivate(account.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Deactivate
                  </button>
                </>
              )}
              {isEditing && (
                <>
                  <button onClick={() => handleRename(account.id)} className="text-xs text-green-600 hover:underline">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </>
              )}
            </div>
          </td>
        </tr>
        {account.children?.map(child => (
          <AccountRow key={child.id} account={child} depth={depth + 1} />
        ))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Chart of Accounts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {accounts.filter(a => a.is_active).length} active accounts
          </p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Account
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <p className="text-sm font-semibold text-gray-800">New Account</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Account Code</label>
              <input required className="mt-1 block w-full border rounded px-2 py-1.5 text-sm"
                value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Name</label>
              <input required className="mt-1 block w-full border rounded px-2 py-1.5 text-sm"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Type</label>
              <select required className="mt-1 block w-full border rounded px-2 py-1.5 text-sm"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
                {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Parent Account (optional)</label>
              <select className="mt-1 block w-full border rounded px-2 py-1.5 text-sm"
                value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                <option value="">— None —</option>
                {accounts.filter(a => a.type === form.type && !a.parent_id).map(a => (
                  <option key={a.id} value={a.id}>{a.account_code} — {a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Description (optional)</label>
            <input className="mt-1 block w-full border rounded px-2 py-1.5 text-sm"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add Account"}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setError(null); setForm(EMPTY_FORM) }}
              className="px-4 py-1.5 text-sm border rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading accounts…</div>
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map(type => {
            const group = grouped[type]
            if (group.length === 0) return null
            return (
              <div key={type} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className={`px-4 py-2 flex items-center gap-2 border-b ${TYPE_COLORS[type]} border-b-transparent bg-opacity-30`}>
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_COLORS[type]}`}>
                    {TYPE_LABELS[type]}
                  </span>
                  <span className="text-xs text-gray-500">{accounts.filter(a => a.type === type && a.is_active).length} accounts</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtype</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(a => <AccountRow key={a.id} account={a} />)}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
