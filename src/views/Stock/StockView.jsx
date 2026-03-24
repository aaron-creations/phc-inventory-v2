import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'

/* ─── helpers ─────────────────────────────────────────── */
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
      p.name, p.category ?? '', statusMeta[status].label,
      p.containers_in_stock.toFixed(2), p.container_size, p.container_unit,
      p.mix_rate ?? '', p.cost_per_container ? p.cost_per_container.toFixed(2) : '',
      value, p.low_stock_threshold,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  })
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `phc-inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

/* ─── Restock Modal (manager only) ───────────────────── */
function RestockModal({ product, allProducts, onClose, onSuccess }) {
  const [form, setForm] = useState({
    product_id: product?.id || '',
    amount: '',
    vendor: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    invoice_notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const selected = allProducts.find(p => p.id === form.product_id)
    if (!selected || !form.amount || Number(form.amount) <= 0) {
      setError('Please select a product and enter a valid amount.')
      setSubmitting(false)
      return
    }
    const containers = Number(form.amount)
    const estimated_cost = selected.cost_per_container ? selected.cost_per_container * containers : null

    const { error: txErr } = await supabase.from('transactions').insert({
      type: 'RESTOCK',
      product_id: selected.id,
      amount: containers,
      unit: 'containers',
      vendor: form.vendor || null,
      date: form.date,
      invoice_notes: form.invoice_notes || null,
      estimated_cost,
    })
    if (txErr) { setError(txErr.message); setSubmitting(false); return }

    await supabase.from('products')
      .update({ containers_in_stock: selected.containers_in_stock + containers })
      .eq('id', selected.id)

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass rounded-2xl p-6 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Log Restock</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Product *</label>
            <select
              value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-green/50 transition-colors"
              required
            >
              <option value="" disabled>Select a product…</option>
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Containers Received *</label>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="e.g. 2"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 block">Vendor</label>
              <input
                type="text"
                placeholder="Supplier name"
                value={form.vendor}
                onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-brand-green/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Invoice Notes</label>
            <input
              type="text"
              placeholder="Invoice # or notes"
              value={form.invoice_notes}
              onChange={e => setForm(f => ({ ...f, invoice_notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-white/50 hover:text-white bg-white/5 hover:bg-white/10 text-sm font-medium transition-all border border-white/8"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 text-forest-950 font-bold text-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Logging…' : '+ Log Restock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Toast ───────────────────────────────────────────── */
function Toast({ message, onDone }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300) }, 2500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-green text-forest-950 font-semibold text-sm shadow-2xl">
        <span>✓</span> {message}
      </div>
    </div>
  )
}

/* ─── Main View ───────────────────────────────────────── */
export default function StockView() {
  const [products, setProducts]       = useState([])
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [restockModal, setRestockModal] = useState(null)
  const [toast, setToast]             = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { isManager } = useAuth()

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  useEffect(() => {
    if (location.state?.restockProductId && products.length > 0) {
      const p = products.find(pr => pr.id === location.state.restockProductId)
      if (p) setRestockModal(p)
    }
  }, [location.state, products])

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

  function handleRestockSuccess() {
    setRestockModal(null)
    setToast('Restock logged!')
    loadProducts()
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {restockModal && isManager && (
        <RestockModal
          product={typeof restockModal === 'object' ? restockModal : null}
          allProducts={products}
          onClose={() => setRestockModal(null)}
          onSuccess={handleRestockSuccess}
        />
      )}

      {/* Header */}
      <div className="flex items-center mb-5">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm flex-1 text-left">← Back</button>
        <h1 className="text-white font-bold text-xl flex-[2] text-center whitespace-nowrap">📦 Stock Levels</h1>
        <div className="flex-1 flex items-center justify-end gap-3">
          <button onClick={() => exportCSV(filtered)} title="Export CSV"
            className="text-white/40 hover:text-brand-green transition-colors text-lg">⬇</button>
          {isManager && (
            <button
              onClick={() => setRestockModal(true)}
              title="Log Restock"
              className="px-3 py-1.5 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/25 text-brand-green text-xs font-semibold transition-all"
            >
              + Restock
            </button>
          )}
          <button onClick={() => navigate('/hub')} className="text-white/40 hover:text-brand-green transition-colors text-lg" title="Hub">🏠</button>
        </div>
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
              <div
                key={product.id}
                className="glass rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.07]"
              >
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
                    {isManager && (
                      <button
                        onClick={() => setRestockModal(product)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/10 hover:bg-brand-green/20 text-brand-green border border-brand-green/20 font-semibold transition-all"
                      >
                        + Restock
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-white/35 text-xs mb-2.5">{volumeDisplay(product)}</p>

                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: meta.bar, opacity: 0.85 }}
                  />
                </div>

                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-white/20 text-xs font-mono">0</span>
                  <span className="text-white/25 text-xs">
                    {product.containers_in_stock.toFixed(2)}
                    <span className="text-white/15"> / {(product.low_stock_threshold * 2).toFixed(1)} cap</span>
                  </span>
                </div>

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
