import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

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

/* ─── Edit Modal ────────────────────────────────── */
function EditModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product.name,
    category: product.category ?? '',
    containers_in_stock: product.containers_in_stock,
    container_size: product.container_size,
    container_unit: product.container_unit,
    mix_rate: product.mix_rate ?? '',
    cost_per_container: product.cost_per_container ?? '',
    low_stock_threshold: product.low_stock_threshold,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('products').update({
      name: form.name.trim(),
      category: form.category.trim() || null,
      containers_in_stock: parseFloat(form.containers_in_stock) || 0,
      container_size: parseFloat(form.container_size) || 0,
      container_unit: form.container_unit.trim(),
      mix_rate: form.mix_rate.trim() || null,
      cost_per_container: form.cost_per_container !== '' ? parseFloat(form.cost_per_container) : null,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 1,
    }).eq('id', product.id)

    if (error) { setError(error.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-forest-900 border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Edit Product</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-white/40 text-xs mb-1 block">Product Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div className="col-span-2">
            <label className="text-white/40 text-xs mb-1 block">Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Containers in Stock</label>
            <input type="number" step="0.01" value={form.containers_in_stock} onChange={e => set('containers_in_stock', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Low Stock Threshold</label>
            <input type="number" step="0.5" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Container Size</label>
            <input type="number" step="0.01" value={form.container_size} onChange={e => set('container_size', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Container Unit</label>
            <input value={form.container_unit} onChange={e => set('container_unit', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div className="col-span-2">
            <label className="text-white/40 text-xs mb-1 block">Mix Rate</label>
            <input value={form.mix_rate} onChange={e => set('mix_rate', e.target.value)}
              placeholder="e.g. 10 fl oz / 100 gal"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
          <div className="col-span-2">
            <label className="text-white/40 text-xs mb-1 block">Cost per Container ($)</label>
            <input type="number" step="0.01" value={form.cost_per_container} onChange={e => set('cost_per_container', e.target.value)}
              placeholder="Leave blank if unknown"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-brand-green text-forest-950 font-bold text-sm transition-all disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Delete Confirm Modal ───────────────────────────── */
function DeleteModal({ product, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('products').delete().eq('id', product.id)
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-forest-900 border border-white/10 rounded-2xl p-6 z-10">
        <div className="text-3xl text-center mb-3">🗑️</div>
        <h2 className="text-white font-bold text-center mb-2">Delete Product?</h2>
        <p className="text-white/40 text-sm text-center mb-6">
          <span className="text-white/70 font-medium">{product.name}</span> will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm transition-all disabled:opacity-40 hover:bg-red-400">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main View ──────────────────────────────────── */
export default function StockView() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()
  const { isManager } = useAuth()

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
                    {/* Manager actions */}
                    {isManager && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditTarget(product)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-brand-green hover:bg-brand-green/10 transition-all text-xs"
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => setDeleteTarget(product)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs"
                          title="Delete"
                        >🗑️</button>
                      </div>
                    )}
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

      {/* Modals */}
      {editTarget && (
        <EditModal
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={loadProducts}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={loadProducts}
        />
      )}
    </div>
  )
}
