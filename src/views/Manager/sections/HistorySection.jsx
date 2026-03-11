import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'

export default function HistorySection() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    supabase
      .from('transactions')
      .select('*, products(name), blends(name), technicians(first_name, last_initial)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTransactions(data || []); setLoading(false) })
  }, [])

  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.type === filter)

  function typeBadge(type) {
    const map = {
      USAGE:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
      RESTOCK: 'bg-brand-green/15 text-brand-green border-brand-green/20',
      BLEND:   'bg-brand-orange/15 text-brand-orange border-brand-orange/20',
    }
    return map[type] || ''
  }

  function exportCSV() {
    const headers = ['Date', 'Type', 'Product/Blend', 'Technician', 'Amount', 'Unit', 'Cost']
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.type === 'BLEND' ? (t.blends?.name || '') : (t.products?.name || ''),
      t.technicians ? `${t.technicians.first_name} ${t.technicians.last_initial}.` : '',
      t.amount,
      t.unit,
      t.estimated_cost ? `$${t.estimated_cost.toFixed(2)}` : '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `PHC_Transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Transaction History</h2>
        <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg glass text-white/60 hover:text-white text-xs transition-all">
          ↓ Export CSV
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {['ALL', 'USAGE', 'BLEND', 'RESTOCK'].map(type => (
          <button key={type} onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === type ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white glass'
            }`}>
            {type}
          </button>
        ))}
        <span className="ml-auto text-white/30 text-xs self-center">{filtered.length} records</span>
      </div>

      <div className="glass rounded-xl overflow-x-auto">
        <div className="min-w-[600px]">
          {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 border-b border-white/5 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-10">No transactions found.</p>
        ) : filtered.map((tx, i) => {
          const name = tx.type === 'BLEND' ? tx.blends?.name : tx.products?.name
          const tech = tx.technicians ? `${tx.technicians.first_name} ${tx.technicians.last_initial}.` : ''
          return (
            <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i < filtered.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${typeBadge(tx.type)}`}>{tx.type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs truncate">{name}</p>
                <p className="text-white/30 text-xs">{format(new Date(tx.date), 'MMM d, yyyy')}{tech ? ` · ${tech}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/60 text-xs font-mono">{tx.amount} {tx.unit}</p>
                {tx.estimated_cost ? <p className="text-white/30 text-xs">${tx.estimated_cost.toFixed(2)}</p> : null}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
