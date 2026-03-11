import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function BlendsSection() {
  const [blends, setBlends] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function loadData() {
    supabase
      .from('blends')
      .select('*, blend_components(*, products(name, mix_rate, cost_per_container, container_size, container_unit))')
      .order('name')
      .then(({ data }) => { setBlends(data || []); setLoading(false) })
  }

  useEffect(() => {
    loadData()
  }, [])

  const badgeColors = {
    green:  'border-brand-green/40 text-brand-green bg-brand-green/5',
    orange: 'border-brand-orange/40 text-brand-orange bg-brand-orange/5',
    blue:   'border-brand-blue/40 text-brand-blue bg-brand-blue/5',
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-white font-bold text-xl">Blends</h2>
        <div className="flex items-center gap-4">
          <span className="text-white/30 text-sm hidden sm:block">{blends.length} active</span>
          <button
            onClick={() => setEditTarget({ name: '', emoji: '🧪', badge_color: 'green', isNew: true })}
            className="glass rounded-xl px-4 py-2 text-brand-green text-sm font-bold hover:bg-brand-green/10 transition-colors flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New Blend
          </button>
        </div>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse mb-3" />)
      ) : (
        <div className="flex flex-col gap-3">
          {blends.map(blend => (
            <div key={blend.id} className="glass rounded-xl overflow-x-auto">
              <div
                className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-white/5 transition-all group"
                onClick={() => setExpanded(e => ({ ...e, [blend.id]: !e[blend.id] }))}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${badgeColors[blend.badge_color] || badgeColors.green}`}>
                    {blend.emoji} {blend.name}
                  </span>
                  <span className="text-white/30 text-xs hidden sm:inline">{blend.blend_components?.length || 0} products</span>
                </div>
                <div className="flex items-center gap-4">
                  <BlendCostBadge components={blend.blend_components} />
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setEditTarget(blend)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-brand-green hover:bg-brand-green/10"
                      title="Edit Blend"
                    >✏️</button>
                    <button
                      onClick={() => setDeleteTarget(blend)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10"
                      title="Delete Blend"
                    >🗑️</button>
                  </div>

                  <span className="text-white/30 text-sm hidden sm:block">{expanded[blend.id] ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded[blend.id] && (
                <div className="border-t border-white/5 px-4 pb-4 bg-black/20">
                  <CostBreakdownTable 
                    components={blend.blend_components} 
                    blendId={blend.id} 
                    onChanged={loadData}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editTarget && (
        <EditBlendModal 
          blend={editTarget} 
          onClose={() => setEditTarget(null)} 
          onSaved={loadData} 
        />
      )}
      {deleteTarget && (
        <DeleteBlendModal 
          blend={deleteTarget} 
          onClose={() => setDeleteTarget(null)} 
          onDeleted={loadData} 
        />
      )}
    </div>
  )
}

/**
 * Calculates cost per 100 gallons for one blend component.
 * Formula:
 *   cost_per_fl_oz = cost_per_container / (container_size converted to fl oz)
 *   cost_for_component = cost_per_fl_oz * rate_fl_oz_per_100_gal
 *
 * Container unit → fl oz conversion table:
 *   gal  = 128 fl oz
 *   qt   = 32  fl oz
 *   pint = 16  fl oz
 *   oz   = 1   fl oz (already fl oz)
 *   liter= 33.814 fl oz
 */
const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, liter: 33.814 }

function componentCost(bc) {
  const p = bc.products
  if (!p?.cost_per_container || !p?.container_size || !bc.rate_fl_oz_per_100_gal) return null
  const containerFlOz = p.container_size * (UNIT_TO_FL_OZ[p.container_unit] || 128)
  const costPerFlOz   = p.cost_per_container / containerFlOz
  return costPerFlOz * bc.rate_fl_oz_per_100_gal
}

function blendTotalCost(components = []) {
  let total = 0
  let hasCost = false
  for (const bc of components) {
    const c = componentCost(bc)
    if (c !== null) { total += c; hasCost = true }
  }
  return hasCost ? total : null
}

function BlendCostBadge({ components = [] }) {
  const total = blendTotalCost(components)
  if (total === null) return null
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 font-mono font-semibold">
      ${total.toFixed(2)} / 100 gal
    </span>
  )
}

function CostBreakdownTable({ components = [], blendId, onChanged }) {
  const total = blendTotalCost(components)
  const hasCostData = components.some(bc => componentCost(bc) !== null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ product_id: '', rate: '' })
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (editing && products.length === 0) {
      supabase.from('products').select('id, name').order('name').then(({ data }) => setProducts(data || []))
    }
  }, [editing, products.length])

  async function handleAdd() {
    if (!form.product_id || !form.rate) return
    await supabase.from('blend_components').insert({
      blend_id: blendId,
      product_id: form.product_id,
      amount_fl_oz_per_100_gal: parseFloat(form.rate)
    })
    setForm({ product_id: '', rate: '' })
    onChanged()
  }

  async function handleRemove(id) {
    if (!confirm('Remove this product from the blend?')) return
    await supabase.from('blend_components').delete().eq('id', id)
    onChanged()
  }

  return (
    <div className="overflow-x-auto mt-3">
      <div className="flex justify-between items-end mb-2">
        <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Formula Components</h4>
        <button 
          onClick={() => setEditing(!editing)} 
          className="text-brand-orange text-xs hover:text-white transition-colors"
        >
          {editing ? 'Done Editing' : '✏️ Edit Components'}
        </button>
      </div>

      <table className="w-full min-w-[400px] mb-3">
        <thead>
          <tr>
            <th className="text-left text-white/30 text-xs pb-2 border-b border-white/5">Product</th>
            <th className="text-right text-white/30 text-xs pb-2 border-b border-white/5">Rate</th>
            {hasCostData && <th className="text-right text-white/30 text-xs pb-2 border-b border-white/5">Cost / 100 gal</th>}
            {editing && <th className="w-8 border-b border-white/5"></th>}
          </tr>
        </thead>
        <tbody>
          {components?.map(bc => {
            const cost = componentCost(bc)
            return (
              <tr key={bc.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="text-white/70 text-xs py-2">{bc.products?.name}</td>
                <td className="text-right text-brand-orange text-xs font-mono py-2">{bc.rate_fl_oz_per_100_gal} fl oz</td>
                {hasCostData && (
                  <td className="text-right text-xs font-mono py-2">
                    {cost !== null
                      ? <span className="text-brand-green">${cost.toFixed(3)}</span>
                      : <span className="text-white/20">—</span>}
                  </td>
                )}
                {editing && (
                  <td className="text-right pr-1">
                    <button onClick={() => handleRemove(bc.id)} className="text-white/20 hover:text-red-400">✕</button>
                  </td>
                )}
              </tr>
            )
          })}
          {components?.length === 0 && (
             <tr>
               <td colSpan={editing ? 4 : 3} className="text-center text-white/30 text-xs italic py-4 border-b border-white/5">No products added yet.</td>
             </tr>
          )}
        </tbody>
        {hasCostData && total !== null && (
          <tfoot>
            <tr>
              <td colSpan={2} className="text-white/40 text-xs pt-3 font-semibold">Total / 100 gal</td>
              <td className="text-right text-brand-green text-sm pt-3 font-bold font-mono">${total.toFixed(2)}</td>
              {editing && <td></td>}
            </tr>
          </tfoot>
        )}
      </table>

      {/* Inline Add Form */}
      {editing && (
        <div className="flex flex-wrap gap-2 items-center bg-white/5 p-3 rounded-lg border border-brand-orange/20 mt-2">
          <select
            className="flex-1 min-w-[150px] bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none"
            value={form.product_id}
            onChange={e => setForm({ ...form, product_id: e.target.value })}
          >
            <option value="">-- Select Product --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          
          <input
            type="number"
            placeholder="fl oz"
            className="w-20 bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none text-right font-mono"
            value={form.rate}
            onChange={e => setForm({ ...form, rate: e.target.value })}
          />
          <button
            onClick={handleAdd}
            className="bg-brand-orange/20 hover:bg-brand-orange text-brand-orange hover:text-forest-950 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Edit Blend Modal ────────────────────────────────── */
function EditBlendModal({ blend, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: blend?.name || '',
    emoji: blend?.emoji || '🧪',
    badge_color: blend?.badge_color || 'green',
  })
  const [saving, setSaving] = useState(false)
  const isNew = blend?.isNew

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    
    if (isNew) {
      await supabase.from('blends').insert({
        name: form.name.trim(),
        emoji: form.emoji,
        badge_color: form.badge_color
      })
    } else {
      await supabase.from('blends').update({
        name: form.name.trim(),
        emoji: form.emoji,
        badge_color: form.badge_color
      }).eq('id', blend.id)
    }
    
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-forest-900 border border-white/10 rounded-2xl p-6 z-10 mx-auto">
        <h2 className="text-white font-bold text-lg mb-5">{isNew ? 'New Blend' : 'Edit Blend'}</h2>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-white/40 text-xs mb-1 block">Emoji Icon</label>
            <div className="flex gap-2">
              {['🧪', '🧬', '🌿', '🌲', '🐛', '💧'].map(e => (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, emoji: e })}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${form.emoji === e ? 'bg-white/20 border border-white/30' : 'bg-white/5 border border-white/5 hover:bg-white/10'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs mb-1 block">Badge Color</label>
            <div className="flex gap-2">
              {['green', 'orange', 'blue'].map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, badge_color: c })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all 
                    ${c === 'green' ? 'text-brand-green' : c === 'orange' ? 'text-brand-orange' : 'text-brand-blue'}
                    ${form.badge_color === c ? 'bg-white/10 border border-white/20' : 'bg-white/5 border border-transparent opacity-50 hover:opacity-100'}
                  `}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs mb-1 block">Blend Name</label>
            <input 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" 
              placeholder="e.g. Summer Fertilizer"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-green text-forest-950 font-bold text-sm transition-all disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Delete Blend Modal ──────────────────────────────── */
function DeleteBlendModal({ blend, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    // Dependencies (blend_components) will cascade if set in Supabase, 
    // otherwise manual deletion is required. Assuming cascade for simplicity,
    // but running component delete first just in case.
    await supabase.from('blend_components').delete().eq('blend_id', blend.id)
    await supabase.from('blends').delete().eq('id', blend.id)
    
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-forest-900 border border-white/10 rounded-2xl p-6 z-10 mx-auto">
        <div className="text-3xl text-center mb-3">🗑️</div>
        <h2 className="text-white font-bold text-center mb-2">Delete Blend?</h2>
        <p className="text-white/40 text-sm text-center mb-6">
          <span className="text-white/70 font-medium">{blend.name}</span> and all its component formulas will be permanently removed.
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
