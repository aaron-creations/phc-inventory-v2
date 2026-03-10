import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function StockView() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('products').select('*').order('name').then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  function getStatus(p) {
    if (p.containers_in_stock <= 0) return 'out'
    if (p.containers_in_stock <= p.low_stock_threshold) return 'low'
    return 'ok'
  }

  function getBarWidth(p) { return Math.min((p.containers_in_stock / 10) * 100, 100) }

  const statusStyles = {
    ok:  { bar: 'bg-brand-green',  badge: 'bg-brand-green/20 text-brand-green border-brand-green/30',   label: 'In Stock' },
    low: { bar: 'bg-brand-orange', badge: 'bg-brand-orange/20 text-brand-orange border-brand-orange/30', label: 'Low Stock' },
    out: { bar: 'bg-red-500',      badge: 'bg-red-500/20 text-red-400 border-red-500/30',                label: 'Out of Stock' },
  }

  function volumeDisplay(p) {
    const vol = p.containers_in_stock * p.container_size
    return `${vol.toFixed(2)} ${p.container_unit} (${p.containers_in_stock.toFixed(2)} containers)`
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm">← Back</button>
        <h1 className="text-white font-bold text-xl flex-1 text-center">📦 Stock Levels</h1>
        <div className="w-10" />
      </div>
      <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm mb-4 outline-none focus:border-brand-green/50" />
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'In Stock',    count: products.filter(p => getStatus(p) === 'ok').length,  color: 'text-brand-green' },
          { label: 'Low Stock',   count: products.filter(p => getStatus(p) === 'low').length, color: 'text-brand-orange' },
          { label: 'Out of Stock',count: products.filter(p => getStatus(p) === 'out').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl glass animate-pulse mb-3" />) : (
        <div className="flex flex-col gap-3">
          {filtered.map(product => {
            const status = getStatus(product)
            const s = statusStyles[status]
            return (
              <div key={product.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm font-medium leading-snug flex-1">{product.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${s.badge}`}>{s.label}</span>
                </div>
                <p className="text-white/40 text-xs mb-2">{volumeDisplay(product)}</p>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${s.bar}`} style={{ width: `${getBarWidth(product)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
