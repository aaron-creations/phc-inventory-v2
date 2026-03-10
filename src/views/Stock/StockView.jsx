import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function StockView() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null) // null | 'ok' | 'low' | 'out'
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setLoading(false)
      })
  }, [])

  function getStatus(p) {
    if (p.containers_in_stock <= 0) return 'out'
    if (p.containers_in_stock <= p.low_stock_threshold) return 'low'
    return 'ok'
  }

  function getBarWidth(p) {
    return Math.min((p.containers_in_stock / 10) * 100, 100)
  }

  function volumeDisplay(p) {
    const vol = p.containers_in_stock * p.container_size
    return `${vol.toFixed(2)} ${p.container_unit} (${p.containers_in_stock.toFixed(2)} containers)`
  }

  function toggleFilter(key) {
    setStatusFilter(prev => prev === key ? null : key)
  }

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === null || getStatus(p) === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts = {
    ok:  products.filter(p => getStatus(p) === 'ok').length,
    low: products.filter(p => getStatus(p) === 'low').length,
    out: products.filter(p => getStatus(p) === 'out').length,
  }

  const statusStyles = {
    ok:  { bar: 'bg-brand-green',  badge: 'bg-brand-green/20 text-brand-green border-brand-green/30',   label: 'In Stock' },
    low: { bar: 'bg-brand-orange', badge: 'bg-brand-orange/20 text-brand-orange border-brand-orange/30', label: 'Low Stock' },
    out: { bar: 'bg-red-500',      badge: 'bg-red-500/20 text-red-400 border-red-500/30',                label: 'Out of Stock' },
  }

  // Use inline styles for dynamic active colors so Tailwind JIT doesn't purge them
  const filterCards = [
    { key: 'ok',  label: 'In Stock',     color: '#4ade80', count: counts.ok  },
    { key: 'low', label: 'Low Stock',    color: '#fb923c', count: counts.low },
    { key: 'out', label: 'Out of Stock', color: '#f87171', count: counts.out },
  ]

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h1 className="text-white font-bold text-xl flex-1 text-center">📦 Stock Levels</h1>
        <div className="w-10" />
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm mb-4 outline-none focus:border-brand-green/50 transition-colors"
      />

      {/* Summary Stats — clickable filter buttons */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {filterCards.map(fc => {
          const isActive = statusFilter === fc.key
          return (
            <button
              key={fc.key}
              type="button"
              onClick={() => toggleFilter(fc.key)}
              style={{
                backgroundColor: isActive ? `${fc.color}18` : 'rgba(255,255,255,0.05)',
                border: isActive ? `2px solid ${fc.color}70` : '1px solid rgba(255,255,255,0.10)',
                boxShadow: isActive ? `0 0 0 1px ${fc.color}30` : 'none',
                cursor: 'pointer',
              }}
              className="rounded-xl p-3 text-center transition-all duration-200 hover:brightness-110 relative z-10"
            >
              <div className="text-2xl font-bold" style={{ color: fc.color }}>{fc.count}</div>
              <div
                className="text-xs mt-0.5 transition-colors"
                style={{ color: isActive ? fc.color : 'rgba(255,255,255,0.4)' }}
              >
                {fc.label}
              </div>
              {isActive && (
                <div className="text-xs mt-1" style={{ color: fc.color, opacity: 0.7 }}>✕ clear</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Active filter result count */}
      <p className="text-white/30 text-xs mb-5 h-4">
        {statusFilter && (
          <>
            Showing{' '}
            <span className="text-white/60 font-medium">
              {filterCards.find(f => f.key === statusFilter)?.label}
            </span>
            {' '}· {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </>
        )}
      </p>

      {/* Product Cards */}
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse mb-3" />
        ))
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(product => {
            const status = getStatus(product)
            const s = statusStyles[status]
            return (
              <div key={product.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm font-medium leading-snug flex-1">{product.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-white/40 text-xs mb-2">{volumeDisplay(product)}</p>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${s.bar}`}
                    style={{ width: `${getBarWidth(product)}%` }}
                  />
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-white/30 text-sm text-center py-10">
              {statusFilter
                ? `No products are ${filterCards.find(f => f.key === statusFilter)?.label.toLowerCase()}.`
                : 'No products match your search.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
