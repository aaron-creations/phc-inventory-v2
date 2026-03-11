import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

/* ─── helpers ─────────────────────────────────────────── */
function getStatus(p) {
  if (p.containers_in_stock <= 0) return 'out'
  if (p.containers_in_stock <= p.low_stock_threshold) return 'low'
  return 'ok'
}

const statusMeta = {
  ok:  { label: '✓ In stock',  bar: '#4ade80', cls: 'text-brand-green' },
  low: { label: '⚠ Low stock', bar: '#fb923c', cls: 'text-brand-orange' },
  out: { label: '✕ Out of stock', bar: '#f87171', cls: 'text-red-400' },
}

function stockPercent(p) {
  const cap = Math.max(p.low_stock_threshold * 2, 1)
  return Math.min((p.containers_in_stock / cap) * 100, 100)
}

function formatVolume(containers, size, unit) {
  if (!containers || !size || !unit) return '—'
  const total = containers * size
  if (unit === 'gal') {
    return `${(total * 128).toLocaleString(undefined, { maximumFractionDigits: 1 })} fl oz`
  }
  if (unit === 'pint') {
    return `${(total * 473.176).toLocaleString(undefined, { maximumFractionDigits: 1 })} mL`
  }
  if (unit === 'liter') {
    return `${(total * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} mL`
  }
  if (unit === 'oz' || unit === 'fl oz') {
    return `${total.toLocaleString(undefined, { maximumFractionDigits: 1 })} fl oz`
  }
  return `${total.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
}

function parseMixRate(mixRate) {
  if (!mixRate) return { amount: '', unit: 'fl oz', per: '100' }
  const match = mixRate.match(/^([\d.]+)\s*(.+?)\/(\d+)\s*gal$/)
  if (match) {
    return { amount: match[1], unit: match[2].trim(), per: match[3] }
  }
  return { amount: '', unit: 'fl oz', per: '100' }
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

/* ─── Product Modal ──────────────────────────────────────── */
function ProductModal({ product, onClose, onSaved }) {
  const isNew = !product
  const parsedMix = parseMixRate(product?.mix_rate)

  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || '',
    containers_in_stock: product?.containers_in_stock ?? '',
    container_size: product?.container_size ?? '',
    container_unit: product?.container_unit || 'gal',
    unit_type: product?.unit_type || 'mixed',
    mixAmt: parsedMix.amount,
    mixUnit: parsedMix.unit,
    mixPer: parsedMix.per,
    cost_per_container: product?.cost_per_container ?? '',
    low_stock_threshold: product?.low_stock_threshold ?? 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    
    let finalMixRate = null
    if (form.unit_type === 'mixed' && form.mixAmt) {
      finalMixRate = `${form.mixAmt} ${form.mixUnit}/${form.mixPer} gal`
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      containers_in_stock: parseFloat(form.containers_in_stock) || 0,
      container_size: parseFloat(form.container_size) || 0,
      container_unit: form.container_unit.trim(),
      unit_type: form.unit_type,
      mix_rate: finalMixRate,
      cost_per_container: form.cost_per_container !== '' ? parseFloat(form.cost_per_container) : null,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 1,
    }

    let err
    if (isNew) {
      const { error } = await supabase.from('products').insert(payload)
      err = error
    } else {
      const { error } = await supabase.from('products').update(payload).eq('id', product.id)
      err = error
    }

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#fdfcfa] text-[#333] border border-black/10 rounded-2xl p-8 max-h-[90vh] overflow-y-auto z-10 mx-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-2xl font-serif text-[#1e293b]">{isNew ? 'Add New Product' : 'Edit Product'}</h2>
          <button onClick={onClose} className="text-black/30 hover:text-black transition-colors text-xl font-bold p-1 leading-none -mt-2">✕</button>
        </div>

        <div className="space-y-6">
          {/* PRODUCT INFO */}
          <div>
            <h3 className="text-brand-green font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="text-lg leading-none">⛭</span> PRODUCT INFO
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-black/60 text-xs font-bold mb-1.5 block">PRODUCT NAME</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. BioPro ArborPlex 14-4-5"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block">CATEGORY</label>
                <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Pesticide"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block">COST PER CONTAINER ($)</label>
                <input type="number" step="0.01" value={form.cost_per_container} onChange={e => set('cost_per_container', e.target.value)} placeholder="0.00"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
            </div>
          </div>

          <hr className="border-black/5" />

          {/* CONTAINER INFO */}
          <div>
            <h3 className="text-brand-green font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="text-lg leading-none">⛭</span> CONTAINER
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block"># CONTAINERS</label>
                <input type="number" step="0.01" value={form.containers_in_stock} onChange={e => set('containers_in_stock', e.target.value)} placeholder="e.g. 2.5"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block">CONTAINER SIZE</label>
                <input type="number" step="0.01" value={form.container_size} onChange={e => set('container_size', e.target.value)} placeholder="e.g. 2.5"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block">CONTAINER UNIT</label>
                <input value={form.container_unit} onChange={e => set('container_unit', e.target.value)} placeholder="e.g. gal"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-black/60 text-xs font-bold mb-1.5 block text-brand-orange truncate" title="LOW STOCK ALARM">LOW STOCK ALARM</label>
                <input type="number" step="0.5" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} placeholder="e.g. 1"
                  className="w-full bg-orange-50/50 border border-brand-orange/30 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-orange transition-colors shadow-sm" />
              </div>
            </div>
          </div>

          <hr className="border-black/5" />

          {/* APPLICATION TYPE */}
          <div>
            <h3 className="text-brand-green font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="text-lg leading-none">⛭</span> APPLICATION TYPE
            </h3>
            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => set('unit_type', 'mixed')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2
                  ${form.unit_type === 'mixed' ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-sm' : 'bg-white border-black/10 text-black/50 hover:bg-black/5'}`}>
                🧪 Mixed
              </button>
              <button 
                onClick={() => set('unit_type', 'direct')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2
                  ${form.unit_type === 'direct' ? 'bg-brand-blue/10 border-brand-blue text-brand-blue shadow-sm' : 'bg-white border-black/10 text-black/50 hover:bg-black/5'}`}>
                💉 Direct use
              </button>
            </div>

            {form.unit_type === 'mixed' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-black/60 text-xs font-bold mb-1.5 block">MIX RATE</label>
                    <input value={form.mixAmt} onChange={e => set('mixAmt', e.target.value)} placeholder="64"
                      className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
                  </div>
                  <div>
                    <label className="text-black/60 text-xs font-bold mb-1.5 block">MIX UNIT</label>
                    <input value={form.mixUnit} onChange={e => set('mixUnit', e.target.value)} placeholder="fl oz"
                      className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
                  </div>
                  <div>
                    <label className="text-black/60 text-xs font-bold mb-1.5 block">PER (GAL)</label>
                    <input value={form.mixPer} onChange={e => set('mixPer', e.target.value)} placeholder="100"
                      className="w-full bg-white border border-black/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-green/50 transition-colors shadow-sm" />
                  </div>
                </div>

                <div className="bg-brand-green/10 border border-brand-green/30 rounded-lg p-3 flex items-center gap-2 text-brand-green text-xs font-medium">
                  ✓ {form.mixUnit === 'fl oz' ? '1 gal = 128 fl oz' : 'Double check your conversion rates'}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mt-4 p-3 bg-red-50 rounded-lg border border-red-200">{error}</p>}

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 font-bold text-sm transition-all focus:outline-none focus:ring-2 ring-black/10">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-[#448c4a] hover:bg-[#36703b] text-white font-bold text-sm transition-all disabled:opacity-50 shadow-md focus:outline-none focus:ring-2 ring-brand-green/50">
            {saving ? 'Saving…' : (isNew ? 'Add Product' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Delete Confirm ──────────────────────────────────── */
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
      <div className="relative w-full max-w-sm bg-forest-900 border border-white/10 rounded-2xl p-6 z-10 mx-auto">
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

/* ─── Main Section ────────────────────────────────────── */
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
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="text-white font-bold text-xl flex-1">Inventory</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass rounded-lg px-3 py-1.5 hidden sm:block">
            <span className="text-white/40 text-xs">Total Value: </span>
            <span className="text-brand-green text-sm font-bold">${totalValue.toFixed(2)}</span>
          </div>
          <button
            onClick={() => exportCSV(filtered)}
            className="glass rounded-lg px-3 py-1.5 text-white/50 hover:text-brand-green text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={() => setEditTarget({ isNew: true })}
            className="bg-brand-green text-forest-950 font-bold rounded-lg px-4 py-1.5 text-sm hover:bg-brand-green/80 transition-colors flex items-center gap-1.5 shadow-md"
          >
            <span className="text-lg leading-none">+</span> Add Product
          </button>
        </div>
      </div>

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

      <div className="glass rounded-xl overflow-x-auto shadow-xl">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#f0ece1]/5">
            <tr className="border-b border-white/10 uppercase tracking-widest text-[10px] text-white/40">
              <th className="text-left font-bold px-5 py-4 min-w-[220px]">PRODUCT</th>
              <th className="text-left font-bold px-4 py-4 min-w-[120px]">STOCK STATUS</th>
              <th className="text-left font-bold px-4 py-4">CONTAINERS</th>
              <th className="text-left font-bold px-4 py-4">TOTAL VOLUME</th>
              <th className="text-left font-bold px-4 py-4">MIX RATE</th>
              <th className="text-left font-bold px-4 py-4">COST/CONTAINER</th>
              <th className="text-left font-bold px-4 py-4">TOTAL VALUE</th>
              <th className="px-4 py-4 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td colSpan={8} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-white/30 text-sm">No products match your search.</td>
              </tr>
            ) : filtered.map((p, i) => {
              const status = getStatus(p)
              const meta = statusMeta[status]
              const pct = stockPercent(p)
              const value = p.cost_per_container ? `$${(p.containers_in_stock * p.cost_per_container).toFixed(2)}` : '—'

              return (
                <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group">
                  <td className="px-5 py-4">
                    <p className="text-white text-sm font-semibold truncate leading-tight w-full max-w-[250px]">{p.name}</p>
                    {p.category && <p className="text-white/40 text-xs mt-1 flex items-center gap-1">🧪 {p.category}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-sm font-bold ${meta.cls}`}>{meta.label}</div>
                    <div className="w-full max-w-[50px] bg-white/5 rounded-full h-[3px] mt-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.bar }} />
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-bold text-white text-sm">{p.containers_in_stock.toFixed(2)}</span>
                    <span className="text-white/40 text-xs ml-1.5">{p.container_unit}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-white/70 text-sm">{formatVolume(p.containers_in_stock, p.container_size, p.container_unit)}</span>
                  </td>
                  <td className="px-4 py-4">
                    {p.unit_type === 'direct' ? (
                      <span className="text-white/30 text-xs font-medium">Direct</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 text-xs font-semibold whitespace-nowrap">
                        {p.mix_rate || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-white/60 text-sm font-mono whitespace-nowrap">
                    {p.cost_per_container ? `$${p.cost_per_container.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-4 text-white font-bold text-sm font-mono whitespace-nowrap">
                    {value}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(p)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-brand-orange hover:bg-white/10 hover:border-brand-orange/30 transition-all shadow-sm">
                        ✏️
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 text-red-400 hover:bg-white/10 hover:border-red-400/30 transition-all shadow-sm">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <ProductModal product={editTarget.isNew ? null : editTarget} onClose={() => setEditTarget(null)} onSaved={loadProducts} />
      )}
      {deleteTarget && (
        <DeleteModal product={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={loadProducts} />
      )}
    </div>
  )
}
