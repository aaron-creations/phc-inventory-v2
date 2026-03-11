import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

/* ─── helpers ────────────────────────────────────── */
function getStatus(p) {
  if (p.containers_in_stock <= 0) return 'out'
  if (p.containers_in_stock <= p.low_stock_threshold) return 'low'
  return 'ok'
}

const statusMeta = {
  ok:  { label: 'In Stock',     bar: '#4ade80', badge: 'bg-brand-green/15 text-brand-green border-brand-green/30' },
  low: { label: 'Low Stock',    bar: '#fb923c', badge: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30' },
  out: { label: 'Out of Stock', bar: '#f87171', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

function stockPercent(p) {
  // Calibrate bar: full = 2× threshold so threshold lands at 50%
  const cap = Math.max(p.low_stock_threshold * 2, 1)
  return Math.min((p.containers_in_stock / cap) * 100, 100)
}

function volumeDisplay(p) {
  const vol = p.containers_in_stock * p.container_size
  return `${vol.toFixed(2)} ${p.container_unit} · ${p.containers_in_stock.toFixed(2)} containers`
}

function exportCSV(products) {
  const headers = ['Name', 'Category', 'Status', 'Containers in Stock', 'Container Size', 'Unit', 'Mix Rate', 'Cost/Container', 'Total Value', 'Low Stock Threshold']
  const rows = products.map(p => {
    const status = getStatus(p)
    const value = p.cost_per_container ? (p.containers_in_stock * p.cost_per_container).toFixed(2) : ''
    return [
      p.name,
      p.category ?? '',
      statusMeta[status].label,
      p.containers_in_stock.toFixed(2),
      p.container_size,
      p.container_unit,
      p.mix_rate ?? '',
      p.cost_per_container ? p.cost_per_container.toFixed(2) : '',
      value,
      p.low_stock_threshold,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  })
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `phc-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Main View ───────────────────────────────────────── */
export default function StockView() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  function toggleFilter(key) {
    setStatusFilter(prev => prev === key ? null : key)
  }

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          (p.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === null || getStatus(p) === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts = {
    ok:  products.filter(p => getStatus(p) === 'ok').length,
    low: products.filter(p => getStatus(p) === 'low').length,
    out: products.filter(p => getStatus(p) === 'out').length,
  }

  const filterCards = [
    { key: 'ok',  label: 'In Stock',     color: '#4ade80', count: counts.ok  },
    { key: 'low', label: 'Low Stock',    color: '#fb923c', count: counts.low },
    { key: 'out', label: 'Out of Stock', color: '#f87171', count: counts.out },
  ]

  const totalValue = products.reduce((s, p) => s + (p.containers_in_stock * (p.cost_per_container || 0)), 0)

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm">← Back</button>
        <h1 className="text-white font-bold text-xl flex-1 text-center">📦 Stock Levels</h1>
        <button
          onClick={() => exportCSV(filtered)}
          title="Export CSV"
          className="text-white/40 hover:text-brand-green transition-colors text-xs flex items-center gap-1 font-medium"
        >
          ⬇ CSV
        </button>
      </div>

      {/* Total value pill */}
      <div className="flex justify-center mb-5">
        <div className="glass rounded-full px-4 py-1.5 flex items-center gap-2">
          <span className="text-white/40 text-xs">Total Value</span>
          <span className="text-brand-green text-sm font-bold">${totalValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="Search products or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-brand-green/50 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xs">✕</button>
        )}
      </div>

      {/* Filter Cards */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {filterCards.map(fc => {
          const isActive = statusFilter === fc.key
          return (
            <button
              key={fc.key}
              onClick={() => toggleFilter(fc.key)}
              style={{
                backgroundColor: isActive ? `${fc.color}18` : 'rgba(255,255,255,0.04)',
                border: isActive ? `2px solid ${fc.color}60` : '1px solid rgba(255,255,255,0.08)',
              }}
              className="rounded-xl p-3 text-center transition-all duration-200 hover:brightness-110"
            >
              <div className="text-2xl font-bold" style={{ color: fc.color }}>{fc.count}</div>
              <div className="text-xs mt-0.5 transition-colors" style={{ color: isActive ? fc.color : 'rgba(255,255,255,0.35)' }}>
                {fc.label}
              </div>
              {isActive && <div className="text-xs mt-1 opacity-60" style={{ color: fc.color }}>✕ clear</div>}
            </button>
          )
        })}
      </div>

      {/* Result count */}
      <p className="text-white/25 text-xs mb-5 h-4">
        {(search || statusFilter) && `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Product Cards */}
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/8 animate-pulse mb-3" />
        ))
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(product => {
            const status = getStatus(product)
            const meta = statusMeta[status]
            const pct = stockPercent(product)

            return (
              <div key={product.id} className="glass rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.07]">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-snug truncate">{product.name}</p>
                    {product.category && (
                      <p className="text-white/30 text-xs mt-0.5">{product.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Volume line */}
                <p className="text-white/35 text-xs mb-2.5">{volumeDisplay(product)}</p>

                {/* Progress bar */}
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: meta.bar, opacity: 0.85 }}
                  />
                </div>

                {/* Stock numbers below bar */}
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-white/20 text-xs font-mono">0</span>
                  <span className="text-white/25 text-xs">
                    {product.containers_in_stock.toFixed(2)}
                    <span className="text-white/15"> / {(product.low_stock_threshold * 2).toFixed(1)} cap</span>
                  </span>
                </div>

                {/* Cost badge (if available) */}
                {product.cost_per_container && (
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-white/25">Cost/container</span>
                    <div className="flex items-center gap-3">
                      <span className="text-white/40 font-mono">${product.cost_per_container.toFixed(2)}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/50 font-mono font-medium">
                        ${(product.containers_in_stock * product.cost_per_container).toFixed(2)} total
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-14">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-white/30 text-sm">
                {statusFilter
                  ? `No products are ${filterCards.find(f => f.key === statusFilter)?.label.toLowerCase()}.`
                  : 'No products match your search.'}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
