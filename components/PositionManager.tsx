'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTickerInfo } from '@/lib/utils/market-data'

interface PositionManagerProps {
  portfolioId: string
  positions: any[]
  onUpdate: () => void
}

export default function PositionManager({ portfolioId, positions, onUpdate }: PositionManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    costBasis: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    positionType: 'stock' as 'stock' | 'option',
    // Option fields
    strikePrice: '',
    expirationDate: '',
    optionType: 'call' as 'call' | 'put',
    premium: '',
    contracts: '1',
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // First, get or create ticker
      let tickerData: any
      const { data: existingTicker } = await supabase
        .from('pa_tickers')
        .select('*')
        .eq('symbol', formData.symbol.toUpperCase())
        .single()

      if (existingTicker) {
        tickerData = existingTicker
      } else {
        // Fetch ticker info from market data API
        const tickerInfo = await getTickerInfo(formData.symbol.toUpperCase())
        const tickerName = tickerInfo?.name || formData.symbol.toUpperCase()
        
        const { data: newTicker, error: tickerError } = await supabase
          .from('pa_tickers')
          .insert({
            symbol: formData.symbol.toUpperCase(),
            name: tickerName,
          })
          .select()
          .single()

        if (tickerError) throw tickerError
        tickerData = newTicker
      }

      // Create position
      const { data: position, error: positionError } = await supabase
        .from('pa_positions')
        .insert({
          portfolio_id: portfolioId,
          ticker_id: tickerData.id,
          quantity: parseFloat(formData.quantity),
          cost_basis: parseFloat(formData.costBasis),
          purchase_date: formData.purchaseDate,
          position_type: formData.positionType,
        })
        .select()
        .single()

      if (positionError) throw positionError

      // If option, create options position
      if (formData.positionType === 'option') {
        const { error: optionError } = await supabase
          .from('pa_options_positions')
          .insert({
            position_id: position.id,
            strike_price: parseFloat(formData.strikePrice),
            expiration_date: formData.expirationDate,
            option_type: formData.optionType,
            premium: parseFloat(formData.premium),
            contracts: parseInt(formData.contracts),
          })

        if (optionError) throw optionError
      }

      // Reset form
      setFormData({
        symbol: '',
        quantity: '',
        costBasis: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        positionType: 'stock',
        strikePrice: '',
        expirationDate: '',
        optionType: 'call',
        premium: '',
        contracts: '1',
      })
      setShowAddModal(false)
      onUpdate()
    } catch (error: any) {
      alert(`Error adding position: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return

    try {
      const { error } = await supabase
        .from('pa_positions')
        .delete()
        .eq('id', positionId)

      if (error) throw error
      onUpdate()
    } catch (error: any) {
      alert(`Error deleting position: ${error.message}`)
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Positions</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Position
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">Add New Position</h3>
            <form onSubmit={handleAddPosition}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Position Type
                </label>
                <select
                  value={formData.positionType}
                  onChange={(e) => setFormData({ ...formData, positionType: e.target.value as 'stock' | 'option' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="stock">Stock</option>
                  <option value="option">Option</option>
                </select>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    required
                    placeholder="AAPL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cost Basis *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costBasis}
                    onChange={(e) => setFormData({ ...formData, costBasis: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {formData.positionType === 'option' && (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Strike Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.strikePrice}
                        onChange={(e) => setFormData({ ...formData, strikePrice: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        required={formData.positionType === 'option'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Expiration Date *
                      </label>
                      <input
                        type="date"
                        value={formData.expirationDate}
                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        required={formData.positionType === 'option'}
                      />
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Option Type *
                      </label>
                      <select
                        value={formData.optionType}
                        onChange={(e) => setFormData({ ...formData, optionType: e.target.value as 'call' | 'put' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        required={formData.positionType === 'option'}
                      >
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Premium *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.premium}
                        onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        required={formData.positionType === 'option'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Contracts *
                      </label>
                      <input
                        type="number"
                        value={formData.contracts}
                        onChange={(e) => setFormData({ ...formData, contracts: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        required={formData.positionType === 'option'}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">No positions yet. Add your first position to get started!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cost Basis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Purchase Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Options Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {positions.map((position) => (
                <tr key={position.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {position.tickers?.symbol || 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      position.position_type === 'option' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {position.position_type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {parseFloat(position.quantity).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    ${parseFloat(position.cost_basis).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(position.purchase_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {position.options_positions && position.options_positions.length > 0 ? (
                      <div className="text-xs">
                        {position.options_positions[0].option_type.toUpperCase()} ${position.options_positions[0].strike_price} 
                        <br />
                        Exp: {new Date(position.options_positions[0].expiration_date).toLocaleDateString()}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <button
                      onClick={() => handleDeletePosition(position.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
