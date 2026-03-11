import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

/* ─── helpers ────────────────────────────────────── */
function getStatus(p) {
  if (p.containers_in_stock <= 0) return 'out'
  if (p.containers_in_stock <= p.low_stock_threshold) return 'low'
  return 'ok'
}

const statusMeta = {
  ok:  { label: 'OK',  bar: '#4ade80', cls: 'text-brand-green bg-brand-green/10 border-brand-green/25' },
  low: { label: 'Low', bar: '#fb923c', cls: 'text-brand-orange bg-brand-orange/10 border-brand-orange/25' },
  out: { label: 'Out', bar: '#f87171', cls: 'text-red-400 bg-red-400/10 border-red-400/25' },
}

function stockPercent(p) {
  const cap = Math.max(p.low_stock_threshold * 2, 1)
  return Math.min((p.containers_in_stock / cap) * 100, 100)
}

function exportCSV(products) {
  const headers = ['Name', 'Category', 'Status', 'Containers', 'Container Size', 'Unit', 'Mix Rate', 'Cost/Container', 'Total Value', 'Low Stock Threshold']
  const rows = products.map(p => {
    const s = getStatus(p)
    return [
      p.name, p.category ?? '', statusMeta[s].label,
      p.containers_in_stock.toFixed(2), p.container_size, p.container_unit,
      p.mix_rate ?? '',
      p.cost_per_container ? p.cost_per_container.toFixed(2) : '',
      p.cost_per_container ? (p.containers_in_stock * p.cost_per_container).toFixed(2) : '',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-forest-900 border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto z-10 mx-4">
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

/* ─── Delete Confirm ────────────────────────────────── */
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
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-400 transition-all disabled:opacity-40">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Section ──────────────────────────────────── */
export default function InventorySection() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        (p.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || getStatus(p) === statusFilter
    return matchSearch && matchStatus
  })

  const counts = {
    ok:  products.filter(p => getStatus(p) === 'ok').length,
    low: products.filter(p => getStatus(p) === 'low').length,
    out: products.filter(p => getStatus(p) === 'out').length,
  }

  const totalValue = products.reduce((s, p) => s + (p.containers_in_stock * (p.cost_per_container || 0)), 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="text-white font-bold text-xl flex-1">Inventory</h2>
        <div className="flex items-center gap-3">
          <div className="glass rounded-lg px-3 py-1.5">
            <span className="text-white/40 text-xs">Total Value: </span>
            <span className="text-brand-green text-sm font-bold">${totalValue.toFixed(2)}</span>
          </div>
          <button
            onClick={() => exportCSV(filtered)}
            className="glass rounded-lg px-3 py-1.5 text-white/50 hover:text-brand-green text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Search + Filter Row */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Search products or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:border-brand-green/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors text-xs">✕</button>
          )}
        </div>

        <div className="flex gap-2">
          {[
            { key: 'ok',  label: `✅ OK (${counts.ok})`,   color: '#4ade80' },
            { key: 'low', label: `⚠️ Low (${counts.low})`, color: '#fb923c' },
            { key: 'out', label: `🔴 Out (${counts.out})`, color: '#f87171' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(prev => prev === f.key ? null : f.key)}
              style={{
                backgroundColor: statusFilter === f.key ? `${f.color}18` : 'rgba(255,255,255,0.04)',
                border: statusFilter === f.key ? `1.5px solid ${f.color}50` : '1px solid rgba(255,255,255,0.08)',
                color: statusFilter === f.key ? f.color : 'rgba(255,255,255,0.45)',
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:brightness-110 whitespace-nowrap"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {(search || statusFilter) && (
        <p className="text-white/25 text-xs mb-3">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['Product', 'Status', 'Stock', 'Mix Rate', 'Cost/Container', 'Value', ''].map(h => (
                <th key={h} className="text-left text-white/30 text-xs font-semibold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-white/5 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-white/30 text-sm">No products match your search.</p>
                </td>
              </tr>
            ) : filtered.map((p, i) => {
              const status = getStatus(p)
              const meta = statusMeta[status]
              const pct = stockPercent(p)
              const value = p.cost_per_container
                ? `$${(p.containers_in_stock * p.cost_per_container).toFixed(2)}`
                : '—'

              return (
                <tr
                  key={p.id}
                  className={`${i < filtered.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/[0.03] transition-colors group`}
                >
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="text-white text-xs font-medium truncate">{p.name}</p>
                    {p.category && <p className="text-white/30 text-xs mt-0.5">{p.category}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <span className="text-white/60 text-xs font-mono w-8 flex-shrink-0">{p.containers_in_stock.toFixed(2)}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden min-w-[60px]">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: meta.bar, opacity: 0.8 }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs max-w-[140px]">
                    <span className="truncate block">{p.mix_rate ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs font-mono">
                    {p.cost_per_container ? `$${p.cost_per_container.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs font-mono font-medium">{value}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditTarget(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-brand-green hover:bg-brand-green/10 transition-all text-xs"
                        title="Edit"
                      >✏️</button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs"
                        title="Delete"
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditModal product={editTarget} onClose={() => setEditTarget(null)} onSaved={loadProducts} />
      )}
      {deleteTarget && (
        <DeleteModal product={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={loadProducts} />
      )}
    </div>
  )
}
