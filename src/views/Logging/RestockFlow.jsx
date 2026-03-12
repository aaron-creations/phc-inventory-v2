import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'

export default function RestockFlow() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([
    { productId: '', containers: '', vendor: '', invoiceNotes: '', date: format(new Date(), 'yyyy-MM-dd') }
  ])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Use linked tech ID if manager also has a tech record, otherwise null is fine for RESTOCK
  const techId = profile?.technicians?.id ?? null

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('products').select('*').order('name')
      setProducts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function updateEntry(i, field, value) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function addEntry() {
    setEntries(prev => [
      ...prev,
      { productId: '', containers: '', vendor: '', invoiceNotes: '', date: format(new Date(), 'yyyy-MM-dd') }
    ])
  }

  function removeEntry(i) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  function getProduct(id) { return products.find(p => p.id === id) }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      for (const entry of entries) {
        if (!entry.productId || !entry.containers) continue

        const product = getProduct(entry.productId)
        const containers = parseFloat(entry.containers)
        if (!product || isNaN(containers) || containers <= 0) continue

        const estimatedCost = product.cost_per_container
          ? parseFloat((product.cost_per_container * containers).toFixed(2))
          : null

        // Insert RESTOCK transaction
        await supabase.from('transactions').insert({
          type: 'RESTOCK',
          technician_id: techId,
          product_id: entry.productId,
          amount: containers,
          unit: 'containers',
          estimated_cost: estimatedCost,
          vendor: entry.vendor || null,
          invoice_notes: entry.invoiceNotes || null,
          date: entry.date,
        })

        // Increment stock
        await supabase
          .from('products')
          .update({ containers_in_stock: product.containers_in_stock + containers })
          .eq('id', entry.productId)
      }

      setSuccess(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = entries.some(e => e.productId && e.containers && parseFloat(e.containers) > 0)

  if (success) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-semibold text-lg">Restock logged!</p>
          <p className="text-white/40 text-sm mt-1">Returning to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm">← Back</button>
        <h1 className="text-white font-bold text-lg flex-1 text-center">📦 Log Restock</h1>
        <div className="w-16" /> {/* spacer */}
      </div>

      {/* Info banner */}
      <div className="glass rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <span className="text-brand-orange text-lg mt-0.5">ℹ️</span>
        <p className="text-white/50 text-xs leading-relaxed">
          Enter containers received. Stock levels will be updated immediately.
        </p>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="h-40 rounded-xl bg-white/5 animate-pulse w-full mb-4" />
      ) : (
        <div className="flex flex-col gap-4 mb-4">
          {entries.map((entry, i) => (
            <RestockEntry
              key={i}
              entry={entry}
              index={i}
              products={products}
              onUpdate={updateEntry}
              onRemove={entries.length > 1 ? () => removeEntry(i) : null}
            />
          ))}
        </div>
      )}

      {/* Add Another */}
      <button
        onClick={addEntry}
        className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white/60 hover:border-white/40 text-sm transition-all mb-6"
      >
        + Add Another Product
      </button>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting || loading}
        className="w-full py-4 rounded-xl bg-brand-orange text-forest-950 font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-orange/90"
      >
        {submitting ? 'Saving...' : 'Submit Restock'}
      </button>
    </div>
  )
}

function RestockEntry({ entry, index, products, onUpdate, onRemove }) {
  const selectedProduct = products.find(p => p.id === entry.productId)

  return (
    <div className="glass rounded-xl p-4 relative">
      {onRemove && (
        <button onClick={onRemove} className="absolute top-3 right-3 text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
      )}

      {/* Date */}
      <label className="text-white/40 text-xs mb-1 block">Date Received</label>
      <input
        type="date"
        value={entry.date}
        onChange={e => onUpdate(index, 'date', e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-orange/50"
      />

      {/* Product */}
      <label className="text-white/40 text-xs mb-1 block">Product</label>
      <select
        value={entry.productId}
        onChange={e => onUpdate(index, 'productId', e.target.value)}
        className="w-full bg-forest-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-orange/50"
      >
        <option value="">Select a product...</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Current stock indicator */}
      {selectedProduct && (
        <p className="text-white/30 text-xs mb-3 font-mono">
          Current stock: {selectedProduct.containers_in_stock.toFixed(2)} containers
        </p>
      )}

      {/* Containers received */}
      <label className="text-white/40 text-xs mb-1 block">Containers Received</label>
      <input
        type="number"
        step="0.5"
        min="0.01"
        value={entry.containers}
        onChange={e => onUpdate(index, 'containers', e.target.value)}
        placeholder="e.g. 2"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-orange/50"
      />

      {/* Estimated cost preview */}
      {selectedProduct?.cost_per_container && entry.containers && parseFloat(entry.containers) > 0 && (
        <p className="text-brand-orange/70 text-xs mb-3 font-mono">
          Est. cost: ${(selectedProduct.cost_per_container * parseFloat(entry.containers)).toFixed(2)}
        </p>
      )}

      {/* Vendor */}
      <label className="text-white/40 text-xs mb-1 block">Vendor <span className="text-white/20">(optional)</span></label>
      <input
        type="text"
        value={entry.vendor}
        onChange={e => onUpdate(index, 'vendor', e.target.value)}
        placeholder="e.g. ArborJet"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-orange/50"
      />

      {/* Invoice Notes */}
      <label className="text-white/40 text-xs mb-1 block">Invoice Notes <span className="text-white/20">(optional)</span></label>
      <input
        type="text"
        value={entry.invoiceNotes}
        onChange={e => onUpdate(index, 'invoiceNotes', e.target.value)}
        placeholder="e.g. Invoice #1234"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-orange/50"
      />
    </div>
  )
}
