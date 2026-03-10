import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'
import LowStockBanner from '../../../components/LowStockBanner'

export default function ManagerDashboard() {
  const [stats, setStats] = useState({ products: 0, blends: 0, inventoryValue: 0, usageCost: 0 })
  const [activity, setActivity] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRestockModal, setShowRestockModal] = useState(false)

  useEffect(() => {
    async function load() {
      const [prodRes, blendRes, txRes] = await Promise.all([
        supabase.from('products').select('id, name, containers_in_stock, cost_per_container, low_stock_threshold'),
        supabase.from('blends').select('id', { count: 'exact' }),
        supabase.from('transactions').select('*, products(name), blends(name), technicians(first_name, last_initial)').order('date', { ascending: false }).limit(20),
      ])
      const products = prodRes.data || []
      const inventoryValue = products.reduce((sum, p) => sum + (p.containers_in_stock * (p.cost_per_container || 0)), 0)
      const transactions = txRes.data || []
      const usageCost = transactions.reduce((sum, t) => sum + (t.estimated_cost || 0), 0)
      setStats({ products: products.length, blends: blendRes.count || 0, inventoryValue, usageCost })
      setAllProducts(products)
      setActivity(transactions)
      setLoading(false)
    }
    load()
  }, [])

  function getTypeBadge(type) {
    const map = { USAGE: 'bg-blue-500/15 text-blue-400 border-blue-500/20', RESTOCK: 'bg-brand-green/15 text-brand-green border-brand-green/20', BLEND: 'bg-brand-orange/15 text-brand-orange border-brand-orange/20' }
    return map[type] || 'bg-white/10 text-white/50'
  }

  function txLabel(tx) {
    const name = tx.type === 'BLEND' ? tx.blends?.name : tx.products?.name
    const tech = tx.technicians ? `${tx.technicians.first_name} ${tx.technicians.last_initial}.` : ''
    const amount = tx.type === 'RESTOCK' ? `+${tx.amount} containers` : `${tx.amount} ${tx.unit}`
    return { name, tech, amount }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-white font-bold text-xl mb-4">Dashboard</h2>
      {!loading && <LowStockBanner products={allProducts} linkTo="/stock" />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Products',  value: stats.products,                        color: 'text-white' },
          { label: 'Active Blends',   value: stats.blends,                           color: 'text-white' },
          { label: 'Inventory Value', value: `$${stats.inventoryValue.toFixed(2)}`,  color: 'text-brand-green' },
          { label: 'Usage Cost',      value: `$${stats.usageCost.toFixed(2)}`,       color: 'text-brand-orange' },
        ].map(kpi => (
          <div key={kpi.label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{loading ? <span className="inline-block w-16 h-6 bg-white/10 rounded animate-pulse" /> : kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mb-8">
        <button onClick={() => setShowRestockModal(true)} className="px-4 py-2 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/20 text-brand-green text-sm transition-all">+ Log Restock</button>
      </div>
      <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">Recent Activity</h3>
      <div className="glass rounded-xl overflow-hidden">
        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 border-b border-white/5 animate-pulse" />) :
          activity.map((tx, i) => {
            const { name, tech, amount } = txLabel(tx)
            return (
              <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i < activity.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${getTypeBadge(tx.type)}`}>{tx.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{name}</p>
                  <p className="text-white/30 text-xs">{format(new Date(tx.date), 'MMM d, yyyy')}{tech ? ` · ${tech}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white/60 text-xs">{amount}</p>
                  {tx.estimated_cost ? <p className="text-white/30 text-xs">${tx.estimated_cost.toFixed(2)}</p> : null}
                </div>
              </div>
            )
          })}
      </div>
      {showRestockModal && <RestockModal onClose={() => setShowRestockModal(false)} />}
    </div>
  )
}

function RestockModal({ onClose }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ productId: '', containers: '', date: format(new Date(), 'yyyy-MM-dd'), vendor: '', invoice: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { supabase.from('products').select('id, name').order('name').then(({ data }) => setProducts(data || [])) }, [])
  async function save() {
    if (!form.productId || !form.containers) return
    setSaving(true)
    await supabase.from('transactions').insert({ type: 'RESTOCK', product_id: form.productId, amount: parseFloat(form.containers), unit: 'containers', vendor: form.vendor, invoice_notes: form.invoice, date: form.date })
    await supabase.from('products').select('containers_in_stock').eq('id', form.productId).single()
      .then(({ data }) => supabase.from('products').update({ containers_in_stock: (data?.containers_in_stock || 0) + parseFloat(form.containers) }).eq('id', form.productId))
    setSaving(false); onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4"><h3 className="text-white font-semibold">+ Log Restock</h3><button onClick={onClose} className="text-white/30 hover:text-white">✕</button></div>
        <div className="flex flex-col gap-3">
          <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} className="w-full bg-forest-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"><option value="">Select product...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="number" placeholder="Containers added" value={form.containers} onChange={e => setForm(f => ({ ...f, containers: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/30" />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
          <input type="text" placeholder="Vendor (optional)" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/30" />
          <input type="text" placeholder="Invoice # / notes" value={form.invoice} onChange={e => setForm(f => ({ ...f, invoice: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/30" />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-all">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-green text-forest-950 text-sm font-semibold disabled:opacity-40 hover:bg-brand-green/90 transition-all">{saving ? 'Saving...' : 'Save Restock'}</button>
        </div>
      </div>
    </div>
  )
}
