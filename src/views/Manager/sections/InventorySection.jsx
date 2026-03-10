import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function InventorySection() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('products').select('*').order('name').then(({ data }) => { setProducts(data || []); setLoading(false) }) }, [])
  function getStatus(p) {
    if (p.containers_in_stock <= 0) return { label: 'Out', cls: 'text-red-400 bg-red-400/10 border-red-400/20' }
    if (p.containers_in_stock <= p.low_stock_threshold) return { label: 'Low', cls: 'text-brand-orange bg-brand-orange/10 border-brand-orange/20' }
    return { label: 'OK', cls: 'text-brand-green bg-brand-green/10 border-brand-green/20' }
  }
  const totalValue = products.reduce((s, p) => s + (p.containers_in_stock * (p.cost_per_container || 0)), 0)
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Inventory</h2>
        <div className="glass rounded-lg px-3 py-1.5"><span className="text-white/40 text-xs">Total Value: </span><span className="text-brand-green text-sm font-bold">${totalValue.toFixed(2)}</span></div>
      </div>
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-white/10">{['Product','Status','Containers','Mix Rate','Cost/Container','Value'].map(h => <th key={h} className="text-left text-white/30 text-xs font-semibold px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => <tr key={i} className="border-b border-white/5"><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>) :
              products.map((p, i) => {
                const status = getStatus(p)
                return (
                  <tr key={p.id} className={`${i < products.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/2 transition-colors`}>
                    <td className="px-4 py-3 text-white text-xs max-w-[200px]"><p className="truncate">{p.name}</p><p className="text-white/30 text-xs">{p.category}</p></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded border ${status.cls}`}>{status.label}</span></td>
                    <td className="px-4 py-3 text-white/60 text-xs font-mono">{p.containers_in_stock.toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{p.mix_rate}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{p.cost_per_container ? `$${p.cost_per_container.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-white/70 text-xs font-mono">{p.cost_per_container ? `$${(p.containers_in_stock * p.cost_per_container).toFixed(2)}` : '—'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
